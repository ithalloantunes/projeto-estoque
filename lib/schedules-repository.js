import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { validateEntry, plannedHours, weekDate, entryInWeek, addDays, templateEntry } from './schedules.js';
import { checkWorkforcePolicy } from './workforce-policy.js';
export const scheduleError=(statusCode,message)=>{throw Object.assign(new Error(message),{statusCode});};
export async function migrateSchedules(pool) {
  const c=await pool.connect();
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock(19283101)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for(const name of ['001-schedules','002-schedules-complete','003-workforce']) {
      if(!(await c.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount){
        await c.query(await fs.readFile(new URL(`../db/migrations/${name}.sql`,import.meta.url),'utf8'));
        await c.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
      }
    }
    await c.query('COMMIT');
  } catch(e){await c.query('ROLLBACK');throw e;} finally{c.release();}
}
export function schedulesRepository(getPool) {
  const query=(sql,args=[])=>getPool().query(sql,args);
  const transaction=async fn=>{
    const c=await getPool().connect();
    try{await c.query('BEGIN');
      // Serialize schedule mutations, including publication/copy, across server instances.
      // Employee locks still protect the rows shared with employee maintenance.
      await c.query('SELECT pg_advisory_xact_lock(19283102)');
      const value=await fn(c);await c.query('COMMIT');return value;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  };
  const audit=(c,actor,period,action,before,after,reason='')=>c.query('INSERT INTO schedule_audit(id,period_id,actor_user_id,action,before_data,after_data,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),period,actor,action,before==null?null:JSON.stringify(before),after==null?null:JSON.stringify(after),String(reason).slice(0,500)]);
  const employees=async()=> (await query('SELECT * FROM employees ORDER BY name')).rows;
  const getWeek=async(week,userId=null)=>{
    if(!weekDate(week))scheduleError(400,'Escolha uma segunda-feira válida.');
    const team=userId?(await query('SELECT * FROM employees WHERE user_id=$1',[userId])).rows:await employees();
    if(userId && !team.length)scheduleError(403,'Solicite ao administrador o vínculo do seu usuário a um funcionário.');
    const period=(await query(`SELECT * FROM schedule_periods WHERE week_start=$1 ${userId?"AND status='published'":''}`,[week])).rows[0] || null;
    const entries=period?(await query(`SELECT * FROM schedule_entries WHERE period_id=$1 AND cancelled_at IS NULL ${userId?'AND employee_id=$2':''} ORDER BY starts_at`,userId?[period.id,team[0].id]:[period.id])).rows:[];
    return {period,employees:team,entries:entries.map(e=>({...e,hours:plannedHours(e)}))};
  };
  const periodFor=async(c,week,version,create=false)=>{
    if(!weekDate(week))scheduleError(400,'Semana inválida.');
    if(create)await c.query('INSERT INTO schedule_periods(id,week_start) VALUES($1,$2) ON CONFLICT(week_start) DO NOTHING',[randomUUID(),week]);
    const p=(await c.query('SELECT * FROM schedule_periods WHERE week_start=$1 FOR UPDATE',[week])).rows[0];
    if(!p)scheduleError(404,'Semana não encontrada.');
    if(!Number.isInteger(version) || p.version!==version)scheduleError(409,'A escala mudou. Atualize a tela antes de salvar.');
    return p;
  };
  const checkAll=async(c,period)=>{
    const entries=(await c.query('SELECT * FROM schedule_entries WHERE period_id=$1 AND cancelled_at IS NULL ORDER BY employee_id,starts_at',[period.id])).rows;
    for(const entry of entries){
      const valid=validateEntry({...entry,starts_at:new Date(entry.starts_at).toISOString(),ends_at:new Date(entry.ends_at).toISOString(),break_starts_at:entry.break_starts_at?new Date(entry.break_starts_at).toISOString():null,break_ends_at:entry.break_ends_at?new Date(entry.break_ends_at).toISOString():null});
      if(!entryInWeek(valid,period.week_start instanceof Date?period.week_start.toISOString().slice(0,10):period.week_start))scheduleError(400,'Entrada fora da semana.');
      const conflict=(await c.query('SELECT starts_at,ends_at,kind FROM schedule_entries WHERE employee_id=$1 AND cancelled_at IS NULL AND id<>$2 AND starts_at<$3 AND ends_at>$4 LIMIT 1',[entry.employee_id,entry.id,entry.ends_at,entry.starts_at])).rows[0];
      if(conflict)scheduleError(409,`Conflito com ${new Date(conflict.starts_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} até ${new Date(conflict.ends_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}.`);
    }
    return checkWorkforcePolicy(c,entries);
  };
  const applyChanges=async(c,actor,period,changes,reason)=>{
    if(!Array.isArray(changes)||!changes.length||changes.length>200)scheduleError(400,'Informe de 1 a 200 alterações.');
    const ids=changes.filter(b=>b.id).map(b=>b.id);
    if(new Set(ids).size!==ids.length)scheduleError(400,'Um lançamento não pode ser alterado duas vezes no mesmo envio.');
    const originals=new Map();
    for(const b of changes){
      const old=b.id?(await c.query('SELECT * FROM schedule_entries WHERE id=$1 AND period_id=$2 AND cancelled_at IS NULL',[b.id,period.id])).rows[0]:null;
      if((b.id||b.cancel)&&!old)scheduleError(404,'Lançamento não encontrado nesta semana.');
      originals.set(b,old);
    }
    const employeeIds=[...new Set(changes.flatMap(b=>[b.employee_id,originals.get(b)?.employee_id]).filter(Boolean))].sort();
    for(const id of employeeIds)await c.query('SELECT id FROM employees WHERE id=$1 FOR UPDATE',[id]);
    // Apply the whole set before checking conflicts so swaps work atomically.
    const saved=[];
    for(const b of changes){
      const old=originals.get(b);let row;
      if(b.cancel)row=(await c.query('UPDATE schedule_entries SET cancelled_at=now(),updated_at=now(),updated_by=$2 WHERE id=$1 RETURNING *',[b.id,actor])).rows[0];
      else{
        const entry=validateEntry(b),employee=(await c.query('SELECT * FROM employees WHERE id=$1',[b.employee_id])).rows[0];
        if(!employee)scheduleError(404,'Funcionário não encontrado.');
        if(!employee.active)scheduleError(400,'Funcionário inativo não pode receber lançamentos.');
        if(entry.kind==='work'&&!b.unit_id&&(await c.query('SELECT 1 FROM employee_units WHERE employee_id=$1',[employee.id])).rowCount)scheduleError(400,'Selecione uma unidade para o funcionário associado a unidades.');
        if(!entryInWeek(entry,typeof period.week_start==='string'?period.week_start:period.week_start.toISOString().slice(0,10)))scheduleError(400,'A entrada deve pertencer à semana selecionada.');
        if(b.template_id && !(await c.query('SELECT id FROM schedule_templates WHERE id=$1 AND active=TRUE',[b.template_id])).rowCount)scheduleError(400,'Modelo de turno inativo ou inexistente.');
        row=(await c.query(`INSERT INTO schedule_entries(id,period_id,employee_id,kind,starts_at,ends_at,break_starts_at,break_ends_at,notes,template_id,created_by,updated_by,unit_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12) ON CONFLICT(id) DO UPDATE SET employee_id=$3,kind=$4,starts_at=$5,ends_at=$6,break_starts_at=$7,break_ends_at=$8,notes=$9,template_id=$10,unit_id=$12,updated_by=$11,updated_at=now() RETURNING *`,
          [b.id||randomUUID(),period.id,b.employee_id,entry.kind,entry.starts_at,entry.ends_at,entry.break_starts_at,entry.break_ends_at,entry.notes,b.template_id||null,actor,b.unit_id||null])).rows[0];
      }
      await audit(c,actor,period.id,b.cancel?'cancel':old?'edit':'create',old,row,reason);saved.push(row);
    }
    await checkAll(c,period);return saved;
  };
  return {query,employees,getWeek,transaction,audit,applyChanges,checkAll,periodFor,
    async employee(actor,b,id){return transaction(async c=>{
      const name=String(b.name||'').trim();if(name.length<2||name.length>120)scheduleError(400,'Nome deve ter entre 2 e 120 caracteres.');
      if(b.user_id && !(await c.query('SELECT id FROM users WHERE id=$1 AND approved=TRUE',[b.user_id])).rowCount)scheduleError(400,'Selecione um usuário aprovado.');
      const before=id?(await c.query('SELECT * FROM employees WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;
      if(id&&!before)scheduleError(404,'Funcionário não encontrado.');
      const row=(await c.query(`INSERT INTO employees(id,name,job,user_id,active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=$2,job=$3,user_id=$4,active=$5,updated_at=now() RETURNING *`,[id||randomUUID(),name,String(b.job||'').slice(0,120),b.user_id||null,b.active!==false])).rows[0];
      await audit(c,actor,null,'employee',before,row);return {row,userIds:[before?.user_id,row.user_id].filter(Boolean)};
    });},
    async template(actor,b,id){return transaction(async c=>{
      templateEntry(b);if(!String(b.name||'').trim())scheduleError(400,'Informe o nome do modelo.');
      const before=id?(await c.query('SELECT * FROM schedule_templates WHERE id=$1',[id])).rows[0]:null;
      if(id&&!before)scheduleError(404,'Modelo não encontrado.');
      const row=(await c.query(`INSERT INTO schedule_templates(id,name,start_time,end_time,next_day,break_start_time,break_end_time,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(id) DO UPDATE SET name=$2,start_time=$3,end_time=$4,next_day=$5,break_start_time=$6,break_end_time=$7,active=$8,updated_at=now() RETURNING *`,[id||randomUUID(),String(b.name).trim().slice(0,100),b.start_time,b.end_time,b.next_day===true,b.break_start_time||null,b.break_end_time||null,b.active!==false])).rows[0];
      await audit(c,actor,null,'template',before,row);return row;
    });},
    async change(actor,b,batch=false){return transaction(async c=>{
      const period=await periodFor(c,b.week,b.version,true);
      if(period.status==='published'&&!String(b.reason||'').trim())scheduleError(400,'Justifique a correção da escala publicada.');
      const requested=batch?b.changes:[b];
      if(!Array.isArray(requested)||!requested.length||requested.length>200)scheduleError(400,'Informe de 1 a 200 alterações.');
      const groups=new Map([[b.week,[]]]);
      for(const change of requested){
        if(change.cancel||change.kind==='work'){groups.get(b.week).push(change);continue;}
        const valid=validateEntry(change);if(!entryInWeek(valid,b.week))scheduleError(400,'A entrada deve pertencer à semana selecionada.');
        let week=b.week,start=valid.starts_at,first=true;
        while(new Date(start)<new Date(valid.ends_at)){
          if(groups.size>52)scheduleError(400,'Divida indisponibilidades maiores que um ano em períodos menores.');
          const boundary=new Date(addDays(week,7)+'T00:00:00-03:00').toISOString();
          const end=+new Date(valid.ends_at)>+new Date(boundary)?boundary:valid.ends_at;
          if(!groups.has(week))groups.set(week,[]);
          groups.get(week).push({...change,id:first?change.id:undefined,starts_at:start,ends_at:end});
          first=false;start=end;week=addDays(week,7);
        }
      }
      const saved=[],periodIds=[];
      for(const [week,changes] of groups){
        const existing=week===b.week?period:(await c.query('SELECT * FROM schedule_periods WHERE week_start=$1',[week])).rows[0];
        const p=week===b.week?period:await periodFor(c,week,existing?.version||0,true);
        if(p.status==='published'&&!String(b.reason||'').trim())scheduleError(400,'O período inclui outra semana publicada. Informe justificativa para republicar.');
        saved.push(...await applyChanges(c,actor,p,changes,b.reason));periodIds.push(p.id);
        if(week!==b.week){const after=(await c.query('UPDATE schedule_periods SET version=version+1,updated_at=now(),published_at=CASE WHEN status=\'published\' THEN now() ELSE published_at END WHERE id=$1 RETURNING *',[p.id])).rows[0];if(p.status==='published')await audit(c,actor,p.id,'republish',p,after,b.reason);}
      }
      const next=(await c.query('UPDATE schedule_periods SET version=version+1,updated_at=now(),published_at=CASE WHEN status=\'published\' THEN now() ELSE published_at END WHERE id=$1 RETURNING *',[period.id])).rows[0];
      if(period.status==='published')await audit(c,actor,period.id,'republish',period,next,b.reason);
      return {period:next,periodIds,entries:saved};
    });},
    async publish(actor,b){return transaction(async c=>{
      const before=(await c.query('SELECT * FROM schedule_periods WHERE id=$1 FOR UPDATE',[b.id])).rows[0];if(!before)scheduleError(404,'Crie lançamentos antes de publicar.');
      if(before.version!==b.version)scheduleError(409,'A escala mudou. Atualize antes de publicar.');
      await checkAll(c,before);
      const after=(await c.query("UPDATE schedule_periods SET status='published',version=version+1,published_at=now(),published_by=$2,updated_at=now() WHERE id=$1 RETURNING *",[before.id,actor])).rows[0];
      await audit(c,actor,before.id,'publish',before,after);return after;
    });},
    async copy(actor,b){return transaction(async c=>{
      if(!weekDate(b.week))scheduleError(400,'Semana inválida.');
      const source=(await c.query('SELECT * FROM schedule_periods WHERE week_start=$1 FOR UPDATE',[addDays(b.week,-7)])).rows[0];if(!source)scheduleError(404,'A semana anterior não possui escala.');
      const target=(await c.query('SELECT * FROM schedule_periods WHERE week_start=$1 FOR UPDATE',[b.week])).rows[0];
      if(target?.status==='published')scheduleError(409,'Não é possível copiar para uma semana publicada.');
      const originals=(await c.query('SELECT * FROM schedule_entries WHERE period_id=$1 AND cancelled_at IS NULL ORDER BY employee_id,starts_at',[source.id])).rows;
      const shifted=originals.map(e=>{const row={...e,id:undefined};for(const key of ['starts_at','ends_at','break_starts_at','break_ends_at'])row[key]=e[key]?new Date(+new Date(e[key])+7*86400000).toISOString():null;return row;});
      const conflicts=[];
      for(const e of shifted){
        const employee=(await c.query('SELECT * FROM employees WHERE id=$1 FOR UPDATE',[e.employee_id])).rows[0];
        const overlapping=await c.query('SELECT id FROM schedule_entries WHERE employee_id=$1 AND cancelled_at IS NULL AND starts_at<$2 AND ends_at>$3',[e.employee_id,e.ends_at,e.starts_at]);
        if(!employee?.active||overlapping.rowCount)conflicts.push({employee:employee?.name||e.employee_id,starts_at:e.starts_at,reason:!employee?.active?'Funcionário inativo':'Horário já ocupado'});
        if(e.template_id && !(await c.query('SELECT 1 FROM schedule_templates WHERE id=$1 AND active=TRUE',[e.template_id])).rowCount)e.template_id=null;
      }
      if(b.preview!==false)return {entries:shifted,conflicts,sourceVersion:source.version,targetVersion:target?.version||0};
      if(b.sourceVersion!==source.version||b.version!==(target?.version||0))scheduleError(409,'Uma das semanas mudou. Gere a prévia novamente.');
      if(conflicts.length)scheduleError(409,'A cópia possui conflitos. Ajuste os horários ou funcionários antes de copiar.');
      if(!shifted.length)scheduleError(400,'A semana anterior não possui lançamentos ativos.');
      const p=await periodFor(c,b.week,b.version,true);await applyChanges(c,actor,p,shifted,'Cópia da semana anterior');
      const after=(await c.query('UPDATE schedule_periods SET version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[p.id])).rows[0];
      await audit(c,actor,p.id,'copy',null,{source:source.id,count:shifted.length});return {period:after,count:shifted.length};
    });}
  };
}

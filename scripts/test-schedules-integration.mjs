import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool} from 'pg';
import jwt from 'jsonwebtoken';
const require=createRequire(import.meta.url);
const WebSocket=require('ws');
import {EventEmitter} from 'node:events';
const local=JSON.parse(fs.readFileSync(new URL('../.runtime/local-config.json',import.meta.url),'utf8'));
const opts={host:'127.0.0.1',port:local.databasePort,user:local.databaseUser,password:local.databasePassword,connectionTimeoutMillis:5000};
const adminPool=new Pool({...opts,database:'postgres'}), name='acai_schedule_test_'+randomUUID().replaceAll('-','');
const secret=randomUUID(), ids={admin:randomUUID(),a:randomUUID(),b:randomUUID(),pending:randomUUID()};
let pool,child,logs='',base;const sockets=[];let passed=0;
const token=id=>'session='+jwt.sign({userId:id},secret,{expiresIn:'10m'});
async function api(path,body,expected=200,user=ids.admin,method='POST'){
 const r=await fetch(base+'/api/'+path,{headers:{'Content-Type':'application/json',Cookie:user?token(user):''},...(body?{method,body:JSON.stringify(body)}:{})});const result=await r.json();assert.equal(r.status,expected,JSON.stringify({path,result}));return result;
}
const report=text=>{passed++;console.log('PASS '+text);};
const entry=(employee,week,start='14:00',end='18:00')=>({employee_id:employee.id,kind:'work',week,version:0,starts_at:week+'T'+start+':00-03:00',ends_at:week+'T'+end+':00-03:00'});
const get=week=>api('schedules/week?week='+week);
function socket(user){
 const s=new EventEmitter(),ws=new WebSocket(base.replace('http:','ws:')+'/socket.io/?EIO=4&transport=websocket',{headers:{Cookie:token(user)}});
 ws.on('message',buffer=>{const packet=buffer.toString();if(packet.startsWith('0'))ws.send('40');else if(packet==='2')ws.send('3');else if(packet.startsWith('40'))s.emit('connect');else if(packet.startsWith('44'))s.emit('connect_error',new Error(packet));else if(packet.startsWith('42')){const [name,...args]=JSON.parse(packet.slice(2));s.emit(name,...args);}});
 ws.on('error',e=>s.emit('connect_error',e));s.disconnect=()=>ws.close();sockets.push(s);return s;
}
const connected=s=>new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);setTimeout(()=>reject(new Error('Socket timeout')),5000).unref();});
try{
 await adminPool.query(`CREATE DATABASE ${name}`);pool=new Pool({...opts,database:name});
 const portServer=net.createServer();await new Promise(r=>portServer.listen(0,'127.0.0.1',r));const port=portServer.address().port;await new Promise(r=>portServer.close(r));base='http://127.0.0.1:'+port;
 child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),LOCAL_DATABASE_ONLY:'true',DATABASE_SSL:'disable',JWT_SECRET:secret,DATABASE_URL:`postgresql://${encodeURIComponent(opts.user)}:${encodeURIComponent(opts.password)}@127.0.0.1:${opts.port}/${name}`}});
 child.stdout.on('data',b=>{logs=(logs+b).slice(-6000);});child.stderr.on('data',b=>{logs=(logs+b).slice(-6000);});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,logs);
 for(const [role,id] of Object.entries(ids))await pool.query("INSERT INTO users(id,username,username_lower,password_hash,role,approved) VALUES($1,$2,$2,'test', $3,$4)",[id,'test-'+role,role==='admin'?'admin':'user',role!=='pending']);
 const a=await api('schedules/employees',{name:'Ana',user_id:ids.a}),b=await api('schedules/employees',{name:'Bruno',user_id:ids.b});
 await api('schedules/employees',null,401,null);await api('schedules/employees',null,403,ids.a);await api('schedules/me?week=2030-01-07',null,401,ids.pending);await api('users/'+ids.a,{},409,ids.admin,'DELETE');report('autorização, aprovação e bloqueio de exclusão vinculada');
 const template=await api('schedules/templates',{name:'Noturno',start_time:'22:00',end_time:'06:00',next_day:true,break_start_time:'02:00',break_end_time:'03:00'});
 await api('schedules/templates/'+template.id,{...template,start_time:'21:00',break_start_time:'01:00',active:false},200,ids.admin,'PUT');report('modelos com intervalo, edição e inativação');
 const w='2030-01-07', next='2030-01-14';
 const values=await Promise.all([1,2].map(()=>fetch(base+'/api/schedules/entries',{method:'POST',headers:{'Content-Type':'application/json',Cookie:token(ids.admin)},body:JSON.stringify(entry(a,w))}).then(r=>r.status)));assert.deepEqual(values.sort(),[200,409]);
 let state=await get(w);await api('schedules/entries',{...entry(b,w),version:state.period.version});state=await get(w);
 await api('schedules/entries',{...entry(a,w),kind:'dayoff',version:state.period.version},409);report('concorrência PostgreSQL e conflito entre trabalho e folga');
 const mine=await api('schedules/me?week='+w,null,200,ids.a);assert.equal(mine.entries.length,0);
 await api('schedules/publish',{id:state.period.id,version:state.period.version});const own=await api('schedules/me?week='+w+'&employee_id='+b.id,null,200,ids.a);assert.equal(own.entries.length,1);assert.equal(own.entries[0].employee_id,a.id);report('rascunho privado e consulta limitada ao proprietário');
 const sa=socket(ids.a),sb=socket(ids.b),sad=socket(ids.admin);await Promise.all([sa,sb,sad].map(connected));let gotA=0,gotB=0,gotAdmin=0;sa.on('schedulesUpdated',()=>gotA++);sb.on('schedulesUpdated',()=>gotB++);sad.on('schedulesUpdated',()=>gotAdmin++);
 state=await get(w);const old=state.entries;
 await api('schedules/corrections',{week:w,version:state.period.version,reason:'Teste de rollback',changes:[{...old[0],starts_at:'2030-01-07T19:00:00-03:00',ends_at:'2030-01-07T20:00:00-03:00'},{...old[1],ends_at:old[1].starts_at}]},400);
 const unchanged=await get(w);assert.equal(unchanged.period.version,state.period.version);assert.equal(unchanged.entries[0].starts_at,old[0].starts_at);
 await api('schedules/corrections',{week:w,version:state.period.version,reason:'Troca atômica',changes:old.map(e=>({...e,employee_id:e.employee_id===a.id?b.id:a.id}))});
 await delay(100);assert.ok(gotA>0&&gotB>0&&gotAdmin>0);report('rollback integral, troca em lote, republicação e avisos autenticados');
 const preview=await api('schedules/copy',{week:next,preview:true});assert.equal(preview.conflicts.length,0);assert.equal(preview.entries.length,2);
 await api('schedules/copy',{week:next,preview:false,sourceVersion:preview.sourceVersion,version:preview.targetVersion});state=await get(next);assert.equal(state.period.status,'draft');assert.equal((await api('schedules/me?week='+next,null,200,ids.a)).entries.length,0);
 const conflictPreview=await api('schedules/copy',{week:next,preview:true});assert.ok(conflictPreview.conflicts.length>0);await api('schedules/copy',{week:next,preview:false,sourceVersion:conflictPreview.sourceVersion,version:conflictPreview.targetVersion},409);report('cópia com prévia, rascunho e bloqueio de duplicação');
 const sunday='2030-01-13';state=await get(w);await api('schedules/corrections',{week:w,version:state.period.version,reason:'Turno atravessa a semana',changes:[{...entry(a,w),starts_at:sunday+'T22:00:00-03:00',ends_at:next+'T06:00:00-03:00',break_starts_at:next+'T02:00:00-03:00',break_ends_at:next+'T03:00:00-03:00'}]});
 state=await get(next);await api('schedules/entries',{...entry(a,next,'05:00','09:00'),version:state.period.version},409);report('turno noturno e conflito entre semanas');
 const published=await get(w);assert.ok(published.entries.some(e=>e.hours===7));const history=await api('schedules/audit?period='+published.period.id);assert.ok(history.some(e=>e.action==='republish'&&e.before_data&&e.after_data));
 await api('schedules/employees/'+a.id,{...a,active:false},200,ids.admin,'PUT');state=await get(next);await api('schedules/entries',{...entry(a,next,'08:00','10:00'),version:state.period.version},400);report('horas previstas, auditoria e inativação preservando histórico');
 // An unrelated employee with no entries in this published week must not receive its event.
 let unrelated=0;await api('schedules/employees/'+b.id,{...b,user_id:null},200,ids.admin,'PUT');await delay(100);gotB=0;sb.on('schedulesUpdated',()=>unrelated++);state=await get(w);const changes=state.entries.filter(e=>e.employee_id===a.id).map(e=>({...e,cancel:true}));await api('schedules/corrections',{week:w,version:state.period.version,reason:'Teste de destinatários',changes});await delay(150);assert.equal(gotB,0);assert.equal(unrelated,0);report('avisos privados sem broadcast de escalas');
 const noSession=socket(ids.pending);await assert.rejects(connected(noSession));report('socket recusa usuário não aprovado');
 const splitWeek='2030-02-04';await api('schedules/entries',{employee_id:b.id,kind:'unavailable',week:splitWeek,version:0,starts_at:'2030-02-10T08:00:00-03:00',ends_at:'2030-02-12T18:00:00-03:00'});
 const first=await get(splitWeek),second=await get('2030-02-11');assert.equal(first.entries.length,1);assert.equal(second.entries.length,1);assert.equal(first.entries[0].ends_at,second.entries[0].starts_at);assert.equal(second.period.status,'draft');report('indisponibilidade dividida entre semanas em uma transação');

 await api('schedules/employees/'+a.id,{...a,active:true},200,ids.admin,'PUT');await api('schedules/employees/'+b.id,{...b,user_id:ids.b},200,ids.admin,'PUT');
 const u1=await api('schedules/workforce/units',{name:'Matriz'}),u2=await api('schedules/workforce/units',{name:'Filial'});
 await api('schedules/workforce/memberships',{employee_id:a.id,unit_ids:[u1.id,u2.id]});await api('schedules/workforce/memberships',{employee_id:b.id,unit_ids:[u1.id]});
 await api('schedules/workforce/units',{name:'Sem permissão'},403,ids.a);
 await api('schedules/workforce/rules',{daily_hours:3,weekly_hours:8,rest_hours:11,mode:'block'});
 const model=await api('schedules/templates',{name:'Tarde',start_time:'14:00',end_time:'18:00',next_day:false});
 const demand={week:'2030-03-04',unit_id:u1.id,template_id:model.id,count:1,days:[0,1],preview:true};
 const blocked=await api('schedules/workforce/generate',demand);assert.equal(blocked.unfilled.length,2);assert.equal((await get(demand.week)).period,null);
 await api('schedules/workforce/rules',{daily_hours:8,weekly_hours:8,rest_hours:11,mode:'block'});
 const avA=await api('schedules/workforce/availability',{kind:'available',starts_at:'2030-03-04T14:00:00-03:00',ends_at:'2030-03-04T18:00:00-03:00'},200,ids.a);
 await api('schedules/workforce/availability/'+avA.id+'/review',{status:'approved',reason:'Janela informada'});
 const gen=await api('schedules/workforce/generate',demand);assert.equal(gen.proposals.length,2);assert.equal(gen.unfilled.length,0);
 await api('schedules/workforce/generate',{...demand,preview:false,token:gen.token,version:gen.version});
 const generated=await get(demand.week);assert.equal(generated.entries.length,2);assert.equal(generated.period.status,'draft');
 await api('schedules/publish',{id:generated.period.id,version:generated.period.version});report('unidades, associações, limites e geração automática com prévia');
 const ae=generated.entries.find(e=>e.employee_id===a.id),be=generated.entries.find(e=>e.employee_id===b.id);assert.ok(ae&&be);
 await api('schedules/entries',{...entry(a,demand.week,'14:00','18:00'),unit_id:u2.id,reason:'Teste entre unidades',version:(await get(demand.week)).period.version},409);report('conflitos entre unidades');
 const request=await api('schedules/workforce/swaps',{entry_id:ae.id,target_entry_id:be.id,notes:'Troca de teste'},200,ids.a);
 await api('schedules/workforce/swaps/'+request.id+'/decision',{action:'approve',reason:'Ainda falta colega'},403);
 await api('schedules/workforce/swaps/'+request.id+'/decision',{action:'accept'},200,ids.b);
 await api('schedules/workforce/swaps/'+request.id+'/decision',{action:'approve',reason:'Fora da janela'},409);
 const expanded=await api('schedules/workforce/availability',{kind:'available',starts_at:'2030-03-04T00:00:00-03:00',ends_at:'2030-03-11T00:00:00-03:00'},200,ids.a);await api('schedules/workforce/availability/'+expanded.id+'/review',{status:'approved',reason:'Disponibilidade ampliada'});
 await api('schedules/workforce/swaps/'+request.id+'/decision',{action:'approve',reason:'Aprovado pela gestão'});
 assert.equal((await get(demand.week)).entries.find(e=>e.id===ae.id).employee_id,b.id);report('troca solicitada, aceite do colega e aprovação administrativa');
 const occupied=(await get(demand.week)).entries.find(e=>e.employee_id===b.id);
 const unavailable=await api('schedules/workforce/availability',{kind:'unavailable',starts_at:occupied.starts_at,ends_at:occupied.ends_at},200,ids.b);
 await api('schedules/workforce/availability/'+unavailable.id+'/review',{status:'approved',reason:'Conflita'},409);
 await api('schedules/workforce/availability/'+unavailable.id+'/review',{status:'rejected',reason:'Remanejar primeiro'});report('disponibilidade aprovada e indisponibilidade conflitante recusada');
 const punch=await api('schedules/workforce/attendance/punch',{action:'in',unit_id:u1.id},200,ids.a);
 await api('schedules/workforce/attendance/punch',{action:'in'},409,ids.a);
 await api('schedules/workforce/attendance/punch',{action:'break_start'},200,ids.a);
 await api('schedules/workforce/attendance/punch',{action:'out'},409,ids.a);
 await api('schedules/workforce/attendance/punch',{action:'break_end'},200,ids.a);
 await api('schedules/workforce/attendance/punch',{action:'out'},200,ids.a);
 const adjustment={started_at:'2020-01-06T09:00:00-03:00',ended_at:'2020-01-06T17:00:00-03:00',break_started_at:'2020-01-06T12:00:00-03:00',break_ended_at:'2020-01-06T13:00:00-03:00',reason:'Correção administrativa de teste'};
 await api('schedules/workforce/attendance/'+punch.id+'/adjust',adjustment,403,ids.a);
 await api('schedules/workforce/attendance/'+punch.id+'/adjust',adjustment);
 const attendance=await api('schedules/workforce/attendance?month=2020-01&employee_id='+a.id);assert.equal(attendance.sessions.length,1);assert.equal(attendance.events.length,5);report('ponto sequencial, relógio do servidor e correção com eventos preservados');
 const profile={employee_id:a.id,pay_type:'hourly',salary:0,hourly_rate:10,monthly_hours:5,overtime_percent:50,overtime_mode:'pay',allowances:10,deductions:5};
 await api('schedules/workforce/payroll/profile',profile);let payroll=await api('schedules/workforce/payroll?month=2020-01&employee_id='+a.id);assert.equal(payroll.total,85);assert.equal(payroll.actualHours,7);
 await api('schedules/workforce/payroll/profile',{...profile,overtime_mode:'bank'});payroll=await api('schedules/workforce/payroll?month=2020-01&employee_id='+a.id);assert.equal(payroll.total,55);assert.equal(payroll.bankHours,2);
 const privatePayroll=await api('schedules/workforce/payroll?month=2020-01&employee_id='+a.id,null,200,ids.b);assert.equal(privatePayroll.employee.id,b.id);assert.equal(privatePayroll.configured,false);
 await api('schedules/workforce/payroll/close',{month:'2020-01',employee_id:a.id});await api('schedules/workforce/payroll/profile',{...profile,overtime_mode:'bank',hourly_rate:100});
 payroll=await api('schedules/workforce/payroll?month=2020-01&employee_id='+a.id);assert.equal(payroll.total,55);assert.equal(payroll.closed,true);
 await api('schedules/workforce/attendance/'+punch.id+'/adjust',adjustment,409);
 await api('schedules/workforce/payroll/reopen',{month:'2020-01',employee_id:a.id,reason:'Revisão autorizada'});
 payroll=await api('schedules/workforce/payroll?month=2020-01&employee_id='+a.id);assert.equal(payroll.total,505);assert.equal(payroll.closed,false);report('folha, horas extras, banco, privacidade, fechamento e reabertura');


 await api('schedules/workforce/rules',{daily_hours:3,weekly_hours:8,rest_hours:11,mode:'warn'});
 await api('schedules/entries',{...entry(a,'2030-04-08'),unit_id:u1.id});const warns=await api('schedules/workforce/warnings?week=2030-04-08');assert.ok(warns.length>0);
 await api('schedules/workforce/rules',{daily_hours:8,weekly_hours:8,rest_hours:11,mode:'block'});
 const staleDemand={...demand,week:'2030-04-15'};const stale=await api('schedules/workforce/generate',staleDemand);await api('schedules/entries',{...entry(a,'2030-04-15','08:00','10:00'),unit_id:u1.id});await api('schedules/workforce/generate',{...staleDemand,preview:false,token:stale.token,version:stale.version},409);report('modo de aviso e rejeição de prévia automática desatualizada');
 const manual={employee_id:b.id,started_at:'2020-02-03T09:00:00-03:00',ended_at:'2020-02-03T17:00:00-03:00',reason:'Inclusão de jornada esquecida'};await api('schedules/workforce/attendance/manual',manual,403,ids.b);await api('schedules/workforce/attendance/manual',manual);await api('schedules/workforce/attendance/manual',manual,409);report('inclusão manual de ponto protegida e sem sobreposição');
 const forged=await api('schedules/workforce/availability',{employee_id:a.id,kind:'unavailable',starts_at:'2030-07-01T00:00:00-03:00',ends_at:'2030-07-02T00:00:00-03:00'},200,ids.b);assert.equal(forged.employee_id,b.id);await api('schedules/workforce/availability/'+forged.id+'/review',{status:'approved',reason:'Tentativa de autoaprovação'},403,ids.b);await api('schedules/workforce/availability/'+forged.id+'/cancel',{},200,ids.b);report('funcionário não solicita em nome de outro nem aprova a própria solicitação');

 console.log(`${passed} grupos de integração passaram em banco separado.`);
}catch(e){console.error(logs);throw e;}finally{
 for(const s of sockets)s.disconnect();
 if(child){child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);}
 if(pool)await pool.end();
 if(!/^acai_schedule_test_[a-f0-9]{32}$/.test(name))throw new Error('Nome de teste inválido');
 await adminPool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await adminPool.end();
}

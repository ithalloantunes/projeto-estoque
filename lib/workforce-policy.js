import { plannedHours, saoPauloDate, addDays } from './schedules.js';
export function coversInterval(windows,start,end){let cursor=+new Date(start);const stop=+new Date(end);for(const w of [...windows].sort((a,b)=>+new Date(a.starts_at)-+new Date(b.starts_at))){const from=+new Date(w.starts_at),to=+new Date(w.ends_at);if(from>cursor)return false;if(to>cursor)cursor=to;if(cursor>=stop)return true;}return false;}
export async function checkWorkforcePolicy(c,entries,{strict=false}={}){
 const warnings=[];
 for(const e of entries){
  if(e.kind!=='work'||e.cancelled_at)continue;
  if(e.unit_id && !(await c.query('SELECT 1 FROM employee_units m JOIN workforce_units u ON u.id=m.unit_id WHERE m.employee_id=$1 AND m.unit_id=$2 AND u.active=TRUE',[e.employee_id,e.unit_id])).rowCount)throw Object.assign(new Error('Funcionário não está associado a esta unidade ativa.'),{statusCode:400});
  const unavailable=await c.query("SELECT 1 FROM workforce_availability WHERE employee_id=$1 AND status='approved' AND kind='unavailable' AND starts_at<$2 AND ends_at>$3",[e.employee_id,e.ends_at,e.starts_at]);
  if(unavailable.rowCount)throw Object.assign(new Error('O horário conflita com uma indisponibilidade aprovada.'),{statusCode:409});
  const rules=(await c.query("SELECT * FROM workforce_rules WHERE scope='global' OR unit_id=$1",[e.unit_id||null])).rows;
  const day=saoPauloDate(e.starts_at),d=new Date(day+'T12:00:00Z');const week=addDays(day,-((d.getUTCDay()+6)%7));
  const availability=(await c.query("SELECT starts_at,ends_at FROM workforce_availability WHERE employee_id=$1 AND status='approved' AND kind='available' AND starts_at<$2 AND ends_at>$3",[e.employee_id,addDays(week,7)+'T00:00:00-03:00',week+'T00:00:00-03:00'])).rows;
  if(availability.length&&!coversInterval(availability,e.starts_at,e.ends_at))throw Object.assign(new Error('O turno está fora das janelas de disponibilidade aprovadas na semana.'),{statusCode:409});
  const all=(await c.query("SELECT * FROM schedule_entries WHERE employee_id=$1 AND kind='work' AND cancelled_at IS NULL",[e.employee_id])).rows;
  for(const rule of rules){
   const errors=[];
   const daily=all.filter(a=>saoPauloDate(a.starts_at)===day).reduce((s,a)=>s+plannedHours(a),0);
   const weekly=all.filter(a=>{const x=saoPauloDate(a.starts_at);return x>=week&&x<addDays(week,7);}).reduce((s,a)=>s+plannedHours(a),0);
   if(rule.daily_hours!=null&&daily>Number(rule.daily_hours)+0.0001)errors.push(`Carga diária de ${daily.toFixed(2)} h excede ${rule.daily_hours} h`);
   if(rule.weekly_hours!=null&&weekly>Number(rule.weekly_hours)+0.0001)errors.push(`Carga semanal de ${weekly.toFixed(2)} h excede ${rule.weekly_hours} h`);
   if(rule.rest_hours!=null)for(const a of all){if(a.id===e.id)continue;const gap=Math.max(+new Date(a.starts_at)-+new Date(e.ends_at),+new Date(e.starts_at)-+new Date(a.ends_at))/3600000;if(gap>=0&&gap<Number(rule.rest_hours))errors.push(`Descanso inferior a ${rule.rest_hours} h`);}
   if(errors.length){const message=[...new Set(errors)].join('; ');if(strict||rule.mode==='block')throw Object.assign(new Error(message),{statusCode:409});warnings.push(message);}
  }
 }
 return [...new Set(warnings)];
}
export function payrollMath({profile,actualHours,plannedHours:planned,openSessions=0}){
 const expected=profile?.monthly_hours!=null?Number(profile.monthly_hours):planned;
 const balance=actualHours-expected,extra=Math.max(0,balance),round=n=>Math.round((n+Number.EPSILON)*100)/100;
 if(!profile)return {actualHours:round(actualHours),plannedHours:round(planned),expectedHours:round(expected),balanceHours:round(balance),bankHours:round(balance),openSessions,configured:false};
 const rate=profile.pay_type==='hourly'?Number(profile.hourly_rate):Number(profile.salary)/Number(profile.monthly_hours);
 const base=profile.pay_type==='monthly'?Number(profile.salary):Math.max(0,actualHours-extra)*rate;
 const overtimePay=profile.overtime_mode==='pay'?extra*rate*(1+Number(profile.overtime_percent)/100):0;
 return {actualHours:round(actualHours),plannedHours:round(planned),expectedHours:round(expected),balanceHours:round(balance),bankHours:round(profile.overtime_mode==='bank'?balance:Math.min(0,balance)),openSessions,configured:true,payType:profile.pay_type,base:round(base),hourlyRate:round(rate),overtimeHours:round(extra),overtimePay:round(overtimePay),allowances:Number(profile.allowances),deductions:Number(profile.deductions),total:round(base+overtimePay+Number(profile.allowances)-Number(profile.deductions))};
}

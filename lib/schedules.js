export function validateEntry(input) {
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!['work', 'dayoff', 'unavailable'].includes(input.kind)) fail('Tipo de lançamento inválido.');
  for (const key of ['starts_at','ends_at','break_starts_at','break_ends_at']) {
    const value=input[key];
    if (value != null && value !== '' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value))) fail('Informe data, horário e fuso completos.');
    if(value){const day=new Date(value.slice(0,10)+'T12:00:00Z');if(!Number.isFinite(+day)||day.toISOString().slice(0,10)!==value.slice(0,10)||Number(value.slice(11,13))>23||Number(value.slice(14,16))>59)fail('Data ou horário inexistente.');}
  }
  if (!input.starts_at || !input.ends_at) fail('Informe início e fim.');
  const start = new Date(input.starts_at), end = new Date(input.ends_at);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) fail('A saída deve ser posterior à entrada, com datas explícitas.');
  const hasStart = Boolean(input.break_starts_at), hasEnd = Boolean(input.break_ends_at);
  if (hasStart !== hasEnd) fail('Informe início e fim do intervalo.');
  let breakStart = null, breakEnd = null;
  if (hasStart) {
    breakStart = new Date(input.break_starts_at); breakEnd = new Date(input.break_ends_at);
    if (input.kind !== 'work' || !Number.isFinite(+breakStart) || !Number.isFinite(+breakEnd) || breakEnd <= breakStart || breakStart < start || breakEnd > end) fail('O intervalo deve estar dentro do turno.');
  }
  return { kind: input.kind, starts_at: start.toISOString(), ends_at: end.toISOString(),
    break_starts_at: breakStart?.toISOString() || null, break_ends_at: breakEnd?.toISOString() || null,
    notes: String(input.notes || '').trim().slice(0, 500) };
}
export function plannedHours(entry) {
  if (entry.kind !== 'work' || entry.cancelled_at) return 0;
  return (+new Date(entry.ends_at) - +new Date(entry.starts_at) - (entry.break_starts_at ? +new Date(entry.break_ends_at) - +new Date(entry.break_starts_at) : 0)) / 3600000;
}
export function weekDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1 ? value : null;
}

export function saoPauloDate(value) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
export function addDays(day, count) { const d=new Date(day+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+count); return d.toISOString().slice(0,10); }
export function entryInWeek(entry, week) { const day=saoPauloDate(entry.starts_at); return day>=week && day<addDays(week,7); }
export function templateEntry(input, day='2026-01-05') {
  const time=value=>typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value) ? value.slice(0,5) : null;
  const start=time(input.start_time), end=time(input.end_time);
  if(!start || !end)throw Object.assign(new Error('Horário de turno inválido.'),{statusCode:400});
  const startAt=day+'T'+start+':00-03:00', endAt=addDays(day,input.next_day===true?1:0)+'T'+end+':00-03:00';
  const interval=(value)=>{const t=time(value);if(!t)throw Object.assign(new Error('Intervalo do modelo inválido.'),{statusCode:400});return addDays(day,t<start?1:0)+'T'+t+':00-03:00';};
  return validateEntry({kind:'work',starts_at:startAt,ends_at:endAt,
    break_starts_at:input.break_start_time?interval(input.break_start_time):null,
    break_ends_at:input.break_end_time?interval(input.break_end_time):null});
}

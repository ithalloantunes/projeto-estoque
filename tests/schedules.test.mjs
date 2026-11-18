import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, plannedHours, weekDate, templateEntry, entryInWeek, saoPauloDate } from '../lib/schedules.js';
const entry={kind:'work',starts_at:'2026-11-23T22:00:00-03:00',ends_at:'2026-11-24T06:00:00-03:00',break_starts_at:'2026-11-24T02:00:00-03:00',break_ends_at:'2026-11-24T03:00:00-03:00'};
test('turno noturno desconta intervalo e soma sete horas',()=>assert.equal(plannedHours(validateEntry(entry)),7));
test('recusa saída anterior e intervalo incompleto ou fora do turno',()=>{
 assert.throws(()=>validateEntry({...entry,ends_at:entry.starts_at}));
 assert.throws(()=>validateEntry({...entry,break_ends_at:null}));
 assert.throws(()=>validateEntry({...entry,break_ends_at:'2026-11-24T08:00:00-03:00'}));
});
test('folgas e cancelamentos não somam horas de trabalho',()=>{
 assert.equal(plannedHours({...entry,kind:'dayoff'}),0);
 assert.equal(plannedHours({...entry,cancelled_at:new Date()}),0);
 assert.throws(()=>validateEntry({...entry,kind:'dayoff'}));
});
test('semana precisa começar em uma segunda-feira real',()=>{
 assert.equal(weekDate('2026-11-23'),'2026-11-23');
 for(const value of ['2026-11-24','2026-02-30','abc','2026-99-01'])assert.equal(weekDate(value),null);
});
test('modelos noturnos posicionam intervalo no dia seguinte',()=>{
 const e=templateEntry({start_time:'22:00',end_time:'06:00',next_day:true,break_start_time:'02:00',break_end_time:'03:00'});
 assert.equal(plannedHours(e),7);
 assert.equal(saoPauloDate(e.break_starts_at),'2026-01-06');
 assert.throws(()=>templateEntry({start_time:'14:00',end_time:'22:00',break_start_time:'23:00',break_end_time:'23:30'}));
 assert.throws(()=>templateEntry({start_time:'25:00',end_time:'26:00'}));
});
test('semana usa a data local e não a data UTC',()=>{
 assert.equal(saoPauloDate('2026-11-24T01:00:00Z'),'2026-11-23');
 assert.ok(entryInWeek({starts_at:'2026-11-30T01:00:00Z'},'2026-11-23'));
 assert.equal(entryInWeek({starts_at:'2026-11-30T04:00:00Z'},'2026-11-23'),false);
});
test('API rejeita datas sem fuso ou campos ausentes',()=>{
 assert.throws(()=>validateEntry({...entry,starts_at:'2026-11-23T22:00'}));
 assert.throws(()=>validateEntry({...entry,starts_at:null}));
 assert.throws(()=>validateEntry({...entry,starts_at:'2026-02-30T22:00:00-03:00'}));
});

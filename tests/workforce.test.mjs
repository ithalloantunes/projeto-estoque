import test from 'node:test';
import assert from 'node:assert/strict';
import {payrollMath,coversInterval} from '../lib/workforce-policy.js';
const profile={pay_type:'hourly',salary:0,hourly_rate:10,monthly_hours:5,overtime_percent:50,overtime_mode:'pay',allowances:10,deductions:5};
test('folha por hora separa base, adicional e descontos',()=>{const r=payrollMath({profile,actualHours:7,plannedHours:5});assert.equal(r.base,50);assert.equal(r.overtimePay,30);assert.equal(r.total,85);assert.equal(r.bankHours,0);});
test('hora destinada ao banco não é paga duas vezes',()=>{const r=payrollMath({profile:{...profile,overtime_mode:'bank'},actualHours:7,plannedHours:5});assert.equal(r.base,50);assert.equal(r.overtimePay,0);assert.equal(r.bankHours,2);assert.equal(r.total,55);});
test('mensalista mantém salário base e usa carga configurada',()=>{const r=payrollMath({profile:{...profile,pay_type:'monthly',salary:1000,monthly_hours:100},actualHours:110,plannedHours:90});assert.equal(r.base,1000);assert.equal(r.hourlyRate,10);assert.equal(r.overtimePay,150);assert.equal(r.total,1155);});
test('sem remuneração configurada ainda calcula saldo de horas',()=>{const r=payrollMath({profile:null,actualHours:6,plannedHours:8});assert.equal(r.configured,false);assert.equal(r.bankHours,-2);assert.equal(r.expectedHours,8);});
test('apuração informa jornadas abertas e arredonda centavos',()=>{const r=payrollMath({profile:{...profile,hourly_rate:12.35,monthly_hours:10},actualHours:1/3,plannedHours:10,openSessions:1});assert.equal(r.openSessions,1);assert.equal(r.base,4.12);});
test('disponibilidades adjacentes se unem, mas lacunas não são permitidas',()=>{
 const day='2026-11-18T',t=h=>day+h+':00-03:00';const windows=[{starts_at:t('09:00'),ends_at:t('12:00')},{starts_at:t('12:00'),ends_at:t('17:00')}];assert.ok(coversInterval(windows,t('09:00'),t('17:00')));assert.equal(coversInterval([{...windows[0],ends_at:t('11:00')},windows[1]],t('09:00'),t('17:00')),false);
});

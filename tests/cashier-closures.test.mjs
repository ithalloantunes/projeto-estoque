import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTotalSistema,
  calculateVariavelCaixa,
  normalizeClosureLabels,
  sanitizeClosurePayload,
} from '../lib/cashier-closures.js';

test('calculateTotalSistema soma os meios do sistema', () => {
  const total = calculateTotalSistema({
    dinheiroSistema: 120.5,
    creditoSistema: 30,
    debitoSistema: 49.5,
    pagOnline: 10,
    pix: 5,
  });
  assert.equal(total, 215);
});

test('calculateVariavelCaixa considera abertura, reforço, gastos e depósito', () => {
  const variavel = calculateVariavelCaixa({
    abertura: 100,
    reforco: 25,
    dinheiroSistema: 80,
    gastos: 30,
    valorParaDeposito: 40,
    totalCaixaDinheiro: 120,
  });
  assert.equal(variavel, 15);
});

test('normalizeClosureLabels converte rótulos da planilha para campos canônicos', () => {
  const normalized = normalizeClosureLabels({
    'TOTAL SITEMA': '250',
    'Din.sist.': '100',
    'ENTREGA CARTÃO (td menos $)': '3',
    'PICOLÉS SIST': '4',
    'Infomações': 'OK',
  });
  assert.equal(normalized.totalSistema, '250');
  assert.equal(normalized.dinheiroSistema, '100');
  assert.equal(normalized.entregaCartao, '3');
  assert.equal(normalized.picolesSist, '4');
  assert.equal(normalized.informacoes, 'OK');
});

test('sanitizeClosurePayload calcula total do sistema e variável do caixa', () => {
  const payload = sanitizeClosurePayload({
    dataOperacao: '2024-02-10',
    funcionarioNome: 'Ana Clara',
    dinheiroSistema: '100,00',
    creditoSistema: '20',
    debitoSistema: '30',
    pagOnline: '10',
    pix: '5',
    totalCaixaDinheiro: '145',
    abertura: '50',
    reforco: '10',
    gastos: '5',
    valorParaDeposito: '15',
  }, { defaultFuncionarioNome: 'Ana Clara' });

  assert.equal(payload.totalSistema, 165);
  assert.equal(payload.variavelCaixa, -5);
});

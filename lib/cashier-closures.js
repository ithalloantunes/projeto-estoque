import { sanitizeText } from './utils.js';

const DECIMAL_SCALE = 100;

const roundCurrency = value => Math.round(value * DECIMAL_SCALE) / DECIMAL_SCALE;

const normalizeLabelKey = label => {
  if (!label && label !== 0) return '';
  const raw = typeof label === 'string' ? label : String(label);
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
};

const FIELD_ALIASES = new Map([
  ['data', 'dataOperacao'],
  ['dataoperacao', 'dataOperacao'],
  ['funcionario', 'funcionarioNome'],
  ['funcionariorresponsavel', 'funcionarioNome'],
  ['responsavel', 'funcionarioNome'],
  ['dinheirosistema', 'dinheiroSistema'],
  ['dinheirosist', 'dinheiroSistema'],
  ['dinheirodosistema', 'dinheiroSistema'],
  ['dinheirodosist', 'dinheiroSistema'],
  ['dinsist', 'dinheiroSistema'],
  ['dinheiro', 'dinheiroSistema'],
  ['credito', 'creditoSistema'],
  ['creditosist', 'creditoSistema'],
  ['creditodosistema', 'creditoSistema'],
  ['credito(sist)', 'creditoSistema'],
  ['creditosistema', 'creditoSistema'],
  ['debito', 'debitoSistema'],
  ['debitosist', 'debitoSistema'],
  ['debitodosistema', 'debitoSistema'],
  ['debito(sist)', 'debitoSistema'],
  ['debitosistema', 'debitoSistema'],
  ['credito(maq)', 'creditoMaquina'],
  ['creditomaq', 'creditoMaquina'],
  ['creditomaquina', 'creditoMaquina'],
  ['debito(maq)', 'debitoMaquina'],
  ['debitomaq', 'debitoMaquina'],
  ['debitomaquina', 'debitoMaquina'],
  ['pagonline', 'pagOnline'],
  ['pag.online', 'pagOnline'],
  ['pagamentoonline', 'pagOnline'],
  ['pix', 'pix'],
  ['totalsistema', 'totalSistema'],
  ['totalsitema', 'totalSistema'],
  ['totalcaixadinheiro', 'totalCaixaDinheiro'],
  ['totalcaixa(dinheiro)', 'totalCaixaDinheiro'],
  ['dinheirocaixa', 'totalCaixaDinheiro'],
  ['abertura', 'abertura'],
  ['reforco', 'reforco'],
  ['reforcos', 'reforco'],
  ['gastos', 'gastos'],
  ['gasto', 'gastos'],
  ['paradeposito', 'valorParaDeposito'],
  ['valorparadeposito', 'valorParaDeposito'],
  ['deposito', 'valorParaDeposito'],
  ['variaveldinheiro', 'variavelCaixa'],
  ['variaveldocaixa', 'variavelCaixa'],
  ['variaveld$', 'variavelCaixa'],
  ['variaveldinheirocaixa', 'variavelCaixa'],
  ['variaveldo$', 'variavelCaixa'],
  ['variavelcaixa', 'variavelCaixa'],
  ['entregacartao', 'entregaCartao'],
  ['entregacartaotdmenos', 'entregaCartao'],
  ['entregacartaotdmenos$', 'entregaCartao'],
  ['picoles', 'picolesSist'],
  ['picolessist', 'picolesSist'],
  ['picolessistema', 'picolesSist'],
  ['informacoes', 'informacoes'],
  ['infomacoes', 'informacoes'],
  ['obs', 'informacoes'],
]);

export const normalizeClosureLabels = payload => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [key, value] of Object.entries(payload)) {
    const trimmedKey = sanitizeText(key);
    if (!trimmedKey) continue;
    const canonical = FIELD_ALIASES.get(trimmedKey) || FIELD_ALIASES.get(normalizeLabelKey(trimmedKey)) || trimmedKey;
    normalized[canonical] = value;
  }
  return normalized;
};

const normalizeNumberString = value => {
  const raw = sanitizeText(value);
  if (!raw) return '';
  if (raw.includes('.') && raw.includes(',')) {
    return raw.replace(/\./g, '').replace(',', '.');
  }
  if (!raw.includes('.') && raw.includes(',')) {
    return raw.replace(',', '.');
  }
  return raw;
};

const parseMoney = (value, { allowNegative = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const numeric = typeof value === 'number' ? value : Number.parseFloat(normalizeNumberString(value));
  if (!Number.isFinite(numeric)) {
    throw new Error('Valor monetário inválido.');
  }
  if (!allowNegative && numeric < 0) {
    throw new Error('Valor não pode ser negativo.');
  }
  return roundCurrency(numeric);
};

const parseInteger = (value, { allowNegative = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const numeric = typeof value === 'number' ? value : Number.parseInt(normalizeNumberString(value), 10);
  if (!Number.isFinite(numeric)) {
    throw new Error('Valor inteiro inválido.');
  }
  if (!allowNegative && numeric < 0) {
    throw new Error('Valor não pode ser negativo.');
  }
  return numeric;
};

export const calculateTotalSistema = closure => {
  return roundCurrency(
    (closure.dinheiroSistema ?? 0) +
    (closure.creditoSistema ?? 0) +
    (closure.debitoSistema ?? 0) +
    (closure.pagOnline ?? 0) +
    (closure.pix ?? 0)
  );
};

export const calculateDinheiroEmGaveta = closure => {
  return roundCurrency(
    (closure.abertura ?? 0) +
    (closure.reforco ?? 0) +
    (closure.dinheiroSistema ?? 0) -
    (closure.gastos ?? 0) -
    (closure.valorParaDeposito ?? 0)
  );
};

export const calculateVariavelCaixa = closure => {
  const dinheiroCalculado = calculateDinheiroEmGaveta(closure);
  const totalContado = closure.totalCaixaDinheiro ?? 0;
  return roundCurrency(dinheiroCalculado - totalContado);
};

export const sanitizeClosurePayload = (rawPayload, { defaultFuncionarioNome } = {}) => {
  const payload = normalizeClosureLabels(rawPayload);
  const errors = [];

  const parseWithContext = (fn, value, field, options) => {
    try {
      return fn(value, options);
    } catch (error) {
      errors.push(`${field}: ${error.message}`);
      return 0;
    }
  };

  const dataOperacao = payload.dataOperacao ? new Date(payload.dataOperacao) : new Date();
  if (Number.isNaN(dataOperacao.getTime())) {
    errors.push('Data da operação inválida.');
  }

  const closure = {
    dataOperacao,
    funcionarioNome: sanitizeText(payload.funcionarioNome) || defaultFuncionarioNome || null,
    dinheiroSistema: parseWithContext(parseMoney, payload.dinheiroSistema, 'Dinheiro do sistema'),
    creditoSistema: parseWithContext(parseMoney, payload.creditoSistema, 'Crédito (sistema)'),
    debitoSistema: parseWithContext(parseMoney, payload.debitoSistema, 'Débito (sistema)'),
    creditoMaquina: parseWithContext(parseMoney, payload.creditoMaquina, 'Crédito (máquina)'),
    debitoMaquina: parseWithContext(parseMoney, payload.debitoMaquina, 'Débito (máquina)'),
    pagOnline: parseWithContext(parseMoney, payload.pagOnline, 'Pagamentos on-line'),
    pix: parseWithContext(parseMoney, payload.pix, 'PIX'),
    totalCaixaDinheiro: parseWithContext(parseMoney, payload.totalCaixaDinheiro, 'Total caixa (dinheiro)'),
    abertura: parseWithContext(parseMoney, payload.abertura, 'Abertura'),
    reforco: parseWithContext(parseMoney, payload.reforco, 'Reforço'),
    gastos: parseWithContext(parseMoney, payload.gastos, 'Gastos'),
    valorParaDeposito: parseWithContext(parseMoney, payload.valorParaDeposito, 'Valor para depósito'),
    entregaCartao: parseWithContext(parseInteger, payload.entregaCartao, 'Entrega cartão'),
    picolesSist: parseWithContext(parseInteger, payload.picolesSist, 'Picolés sist'),
    informacoes: sanitizeText(payload.informacoes) || null,
  };

  if (closure.funcionarioNome && closure.funcionarioNome.length < 3) {
    errors.push('Nome do funcionário deve possuir ao menos 3 caracteres.');
  }

  const totalSistema = calculateTotalSistema(closure);
  const variavelCaixa = calculateVariavelCaixa({ ...closure, totalSistema });

  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    throw error;
  }

  return {
    ...closure,
    totalSistema,
    variavelCaixa,
  };
};

export const diffClosures = (anterior, atual) => {
  const diff = {};
  for (const key of [
    'dataOperacao',
    'funcionarioNome',
    'dinheiroSistema',
    'creditoSistema',
    'debitoSistema',
    'creditoMaquina',
    'debitoMaquina',
    'pagOnline',
    'pix',
    'totalSistema',
    'totalCaixaDinheiro',
    'abertura',
    'reforco',
    'gastos',
    'valorParaDeposito',
    'variavelCaixa',
    'entregaCartao',
    'picolesSist',
    'informacoes',
  ]) {
    const beforeValue = anterior?.[key];
    const afterValue = atual?.[key];
    let changed = false;
    if (beforeValue instanceof Date || afterValue instanceof Date) {
      const beforeTime = beforeValue instanceof Date ? beforeValue.getTime() : new Date(beforeValue ?? '').getTime();
      const afterTime = afterValue instanceof Date ? afterValue.getTime() : new Date(afterValue ?? '').getTime();
      changed = beforeTime !== afterTime;
    } else {
      changed = beforeValue !== afterValue;
    }
    if (changed) {
      diff[key] = { antes: beforeValue ?? null, depois: afterValue ?? null };
    }
  }
  return diff;
};

export const buildClosureResponse = closure => {
  if (!closure) return null;
  return {
    ...closure,
    dinheiroEmGavetaCalculado: calculateDinheiroEmGaveta(closure),
  };
};


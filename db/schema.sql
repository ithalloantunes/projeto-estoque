-- Esquema base para o banco PostgreSQL 17
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  photo TEXT,
  photo_mime TEXT,
  photo_data BYTEA,
  CONSTRAINT users_username_unique UNIQUE (username),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'user')),
  CONSTRAINT users_username_format CHECK (char_length(username) >= 3),
  CONSTRAINT users_username_lower_format CHECK (username_lower = lower(username))
)
TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY,
  produto TEXT NOT NULL,
  tipo TEXT,
  lote TEXT,
  quantidade INTEGER NOT NULL CHECK (quantidade >= 0),
  validade DATE,
  custo NUMERIC(12,2) NOT NULL CHECK (custo >= 0),
  image TEXT,
  image_mime TEXT,
  image_data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS movimentacoes (
  id UUID PRIMARY KEY,
  produto_id UUID,
  produto TEXT NOT NULL,
  tipo TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  quantidade_anterior INTEGER NOT NULL CHECK (quantidade_anterior >= 0),
  quantidade_atual INTEGER NOT NULL CHECK (quantidade_atual >= 0),
  motivo TEXT,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario TEXT NOT NULL DEFAULT 'desconhecido',
  CONSTRAINT movimentacoes_produto_fk FOREIGN KEY (produto_id) REFERENCES inventory(id) ON DELETE SET NULL,
  CONSTRAINT movimentacoes_tipo_check CHECK (tipo IN ('adicao', 'entrada', 'saida', 'edicao', 'exclusao')),
  CONSTRAINT movimentacoes_quantidade_check CHECK (
    (tipo = 'entrada' AND quantidade > 0) OR
    (tipo = 'saida' AND quantidade < 0) OR
    (tipo = 'edicao' AND quantidade = 0) OR
    (tipo IN ('adicao', 'exclusao') AND quantidade >= 0)
  ),
  CONSTRAINT movimentacoes_produto_nome CHECK (char_length(produto) > 0)
)
TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS cashier_settings (
  id TEXT PRIMARY KEY,
  logo TEXT,
  cash_limit TEXT,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS cashier_movements (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  funcionario TEXT NOT NULL,
  observacoes TEXT,
  forma_pagamento TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS cashier_closures (
  id UUID PRIMARY KEY,
  data_operacao DATE NOT NULL UNIQUE,
  funcionario_id UUID REFERENCES users(id) ON DELETE SET NULL,
  funcionario_nome TEXT,
  dinheiro_sistema NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (dinheiro_sistema >= 0),
  credito_sistema NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credito_sistema >= 0),
  debito_sistema NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debito_sistema >= 0),
  credito_maquina NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credito_maquina >= 0),
  debito_maquina NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debito_maquina >= 0),
  pag_online NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pag_online >= 0),
  pix NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pix >= 0),
  total_sistema NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_sistema >= 0),
  total_caixa_dinheiro NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_caixa_dinheiro >= 0),
  abertura NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (abertura >= 0),
  reforco NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reforco >= 0),
  gastos NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gastos >= 0),
  valor_para_deposito NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_para_deposito >= 0),
  variavel_caixa NUMERIC(12,2) NOT NULL,
  entrega_cartao INTEGER NOT NULL DEFAULT 0 CHECK (entrega_cartao >= 0),
  picoles_sist INTEGER NOT NULL DEFAULT 0 CHECK (picoles_sist >= 0),
  informacoes TEXT,
  criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  atualizado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS cashier_closure_logs (
  id UUID PRIMARY KEY,
  closure_id UUID NOT NULL REFERENCES cashier_closures(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_inventory_produto ON inventory(produto) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_cashier_movements_date ON cashier_movements(data DESC, created_at DESC) TABLESPACE pg_default;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashier_closures_date ON cashier_closures(data_operacao) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_cashier_closures_funcionario ON cashier_closures(funcionario_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_cashier_closure_logs_closure ON cashier_closure_logs(closure_id, created_at DESC) TABLESPACE pg_default;

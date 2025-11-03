-- Esquema base para o banco PostgreSQL 17
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  photo TEXT,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_inventory_produto ON inventory(produto) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_cashier_movements_date ON cashier_movements(data DESC, created_at DESC) TABLESPACE pg_default;

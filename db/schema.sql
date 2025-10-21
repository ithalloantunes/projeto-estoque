-- Esquema base para o banco PostgreSQL 17
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  photo TEXT
)
TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY,
  produto TEXT NOT NULL,
  tipo TEXT,
  lote TEXT,
  quantidade INTEGER NOT NULL,
  validade DATE,
  custo NUMERIC(12,2) NOT NULL,
  image TEXT,
  image_data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS movimentacoes (
  id UUID PRIMARY KEY,
  produto_id UUID,
  produto TEXT,
  tipo TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  quantidade_anterior INTEGER,
  quantidade_atual INTEGER,
  motivo TEXT,
  data TIMESTAMPTZ NOT NULL,
  usuario TEXT
)
TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_inventory_produto ON inventory(produto) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data) TABLESPACE pg_default;

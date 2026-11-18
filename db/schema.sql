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

-- Modulo de escalas consolidado
CREATE TABLE IF NOT EXISTS employees (
 id UUID PRIMARY KEY, user_id UUID UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120), job TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS schedule_templates (
 id UUID PRIMARY KEY, name TEXT NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
 next_day BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS schedule_periods (
 id UUID PRIMARY KEY, week_start DATE NOT NULL UNIQUE CHECK(extract(isodow FROM week_start)=1),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')), version INTEGER NOT NULL DEFAULT 0,
 published_at TIMESTAMPTZ, published_by UUID REFERENCES users(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS schedule_entries (
 id UUID PRIMARY KEY, period_id UUID NOT NULL REFERENCES schedule_periods(id), employee_id UUID NOT NULL REFERENCES employees(id),
 kind TEXT NOT NULL CHECK(kind IN ('work','dayoff','unavailable')), starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
 break_starts_at TIMESTAMPTZ, break_ends_at TIMESTAMPTZ, notes TEXT NOT NULL DEFAULT '', cancelled_at TIMESTAMPTZ,
 CHECK(ends_at > starts_at), CHECK((break_starts_at IS NULL AND break_ends_at IS NULL) OR
 (kind='work' AND break_starts_at IS NOT NULL AND break_ends_at IS NOT NULL AND break_ends_at>break_starts_at AND break_starts_at>=starts_at AND break_ends_at<=ends_at))
);
CREATE INDEX IF NOT EXISTS schedule_entries_employee_start ON schedule_entries(employee_id, starts_at) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS schedule_entries_period ON schedule_entries(period_id);
CREATE TABLE IF NOT EXISTS schedule_audit (
 id UUID PRIMARY KEY, period_id UUID REFERENCES schedule_periods(id), actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 action TEXT NOT NULL, before_data JSONB, after_data JSONB, reason TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedule_audit_period ON schedule_audit(period_id, created_at);

ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS break_start_time TIME;
ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS break_end_time TIME;
ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE schedule_periods ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE schedule_periods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES schedule_templates(id) ON DELETE RESTRICT;
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();


-- Gestao completa de pessoas
CREATE TABLE IF NOT EXISTS workforce_units(id UUID PRIMARY KEY,name TEXT NOT NULL UNIQUE,active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS employee_units(employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,unit_id UUID REFERENCES workforce_units(id) ON DELETE RESTRICT,PRIMARY KEY(employee_id,unit_id));
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES workforce_units(id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS workforce_rules(scope TEXT PRIMARY KEY,unit_id UUID UNIQUE REFERENCES workforce_units(id),daily_hours NUMERIC(6,2),weekly_hours NUMERIC(6,2),rest_hours NUMERIC(6,2),mode TEXT NOT NULL DEFAULT 'block' CHECK(mode IN ('block','warn')),CHECK(daily_hours>0),CHECK(weekly_hours>0),CHECK(rest_hours>=0));
CREATE TABLE IF NOT EXISTS workforce_availability(id UUID PRIMARY KEY,employee_id UUID NOT NULL REFERENCES employees(id),kind TEXT NOT NULL CHECK(kind IN ('available','unavailable')),starts_at TIMESTAMPTZ NOT NULL,ends_at TIMESTAMPTZ NOT NULL,notes TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),reviewed_by UUID REFERENCES users(id),reason TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),CHECK(ends_at>starts_at));
CREATE INDEX IF NOT EXISTS workforce_availability_employee ON workforce_availability(employee_id,starts_at);
CREATE TABLE IF NOT EXISTS workforce_swaps(id UUID PRIMARY KEY,requester_id UUID NOT NULL REFERENCES employees(id),target_id UUID NOT NULL REFERENCES employees(id),entry_id UUID NOT NULL REFERENCES schedule_entries(id),target_entry_id UUID REFERENCES schedule_entries(id),snapshot JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'awaiting_employee' CHECK(status IN ('awaiting_employee','pending_admin','approved','rejected','cancelled')),notes TEXT NOT NULL DEFAULT '',reason TEXT NOT NULL DEFAULT '',reviewed_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),CHECK(requester_id<>target_id));
CREATE TABLE IF NOT EXISTS attendance_sessions(id UUID PRIMARY KEY,employee_id UUID NOT NULL REFERENCES employees(id),unit_id UUID REFERENCES workforce_units(id),started_at TIMESTAMPTZ NOT NULL,break_started_at TIMESTAMPTZ,break_ended_at TIMESTAMPTZ,ended_at TIMESTAMPTZ,CHECK(ended_at IS NULL OR ended_at>started_at));
CREATE UNIQUE INDEX IF NOT EXISTS attendance_one_open ON attendance_sessions(employee_id) WHERE ended_at IS NULL;
CREATE TABLE IF NOT EXISTS attendance_events(id UUID PRIMARY KEY,session_id UUID NOT NULL REFERENCES attendance_sessions(id),employee_id UUID NOT NULL REFERENCES employees(id),actor_user_id UUID NOT NULL REFERENCES users(id),action TEXT NOT NULL CHECK(action IN ('in','break_start','break_end','out','adjust')),recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),details JSONB);
CREATE TABLE IF NOT EXISTS payroll_profiles(employee_id UUID PRIMARY KEY REFERENCES employees(id),pay_type TEXT NOT NULL CHECK(pay_type IN ('hourly','monthly')),salary NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(salary>=0),hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(hourly_rate>=0),monthly_hours NUMERIC(7,2) CHECK(monthly_hours>0),overtime_percent NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK(overtime_percent>=0),overtime_mode TEXT NOT NULL DEFAULT 'bank' CHECK(overtime_mode IN ('bank','pay')),allowances NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(allowances>=0),deductions NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(deductions>=0));
CREATE TABLE IF NOT EXISTS payroll_runs(id UUID PRIMARY KEY,month TEXT NOT NULL CHECK(month ~ '^\d{4}-\d{2}$'),employee_id UUID NOT NULL REFERENCES employees(id),snapshot JSONB NOT NULL,created_by UUID NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),status TEXT NOT NULL DEFAULT 'closed' CHECK(status IN ('draft','closed')),UNIQUE(month,employee_id));

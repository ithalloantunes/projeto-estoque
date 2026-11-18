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

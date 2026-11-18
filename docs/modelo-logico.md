# Modelo Lógico de Dados

O modelo lógico traduz o DER em um esquema relacional compatível com PostgreSQL, garantindo a preservação das restrições de integridade identificadas na etapa conceitual.

## Esquema Relacional

### `users`
- `id` UUID **PK**
- `username` TEXT NOT NULL UNIQUE
- `username_lower` TEXT NOT NULL UNIQUE (armazenado em minúsculas para busca case-insensitive)
- `password_hash` TEXT NOT NULL
- `role` TEXT NOT NULL CHECK (`role` ∈ {`admin`, `user`})
- `approved` BOOLEAN NOT NULL DEFAULT FALSE
- `photo` TEXT NULL
- `photo_mime` TEXT NULL
- `photo_data` BYTEA NULL

Índices adicionais: `idx_users_username_lower` sobre `username_lower` para autenticação e busca eficiente.

### `inventory`
- `id` UUID **PK**
- `produto` TEXT NOT NULL
- `tipo` TEXT NULL
- `lote` TEXT NULL
- `quantidade` INTEGER NOT NULL CHECK (≥ 0)
- `validade` DATE NULL
- `custo` NUMERIC(12,2) NOT NULL CHECK (≥ 0)
- `image` TEXT NULL
- `image_mime` TEXT NULL (MIME type persistido junto ao binário)
- `image_data` BYTEA NULL (armazenamento binário da imagem)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

Índices adicionais: `idx_inventory_produto` para acelerar filtros por nome do produto.

### `movimentacoes`
- `id` UUID **PK**
- `produto_id` UUID NULL **FK** → `inventory.id` (ON DELETE SET NULL)
- `produto` TEXT NOT NULL
- `tipo` TEXT NOT NULL CHECK (`tipo` ∈ {`adicao`, `entrada`, `saida`, `edicao`, `exclusao`})
- `quantidade` INTEGER NOT NULL com regra sinalizada por tipo de movimentação
- `quantidade_anterior` INTEGER NOT NULL CHECK (≥ 0)
- `quantidade_atual` INTEGER NOT NULL CHECK (≥ 0)
- `motivo` TEXT NULL
- `data` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `usuario` TEXT NOT NULL DEFAULT 'desconhecido'

Índices adicionais: `idx_movimentacoes_data` para consultas cronológicas.

## Regras de Integridade Representadas

- Chaves primárias garantem unicidade dos registros.
- Chaves estrangeiras controlam a associação de movimentações a itens do estoque, preservando históricos mesmo após exclusões.
- Restrições CHECK asseguram consistência de valores (papéis válidos, quantidades não negativas, coerência com o tipo de movimentação).
- Restrições UNIQUE evitam duplicidade de usuários e apoiam autenticação case-insensitive.

## Correspondência com o Modelo Conceitual

- Entidades **Users**, **Inventory** e **Movimentacoes** foram mapeadas diretamente para tabelas homônimas.
- Relacionamentos 1:N foram representados pelas chaves estrangeiras (`movimentacoes.produto_id` e referência lógica a `usuario`).
- Atributos derivados (`username_lower`) e metadados (`created_at`, `updated_at`) foram incorporados para atender aos requisitos de auditoria e desempenho.

## Módulo de escalas implementado

Employees representa funcionários e possui vínculo opcional único com users. Schedule_templates contém modelos de turno, intervalo e situação. Schedule_periods representa semanas com rascunho/publicação e versão. Schedule_entries associa funcionário e semana e guarda trabalho, folga ou indisponibilidade com datas, intervalo, autores e cancelamento lógico. Schedule_audit registra ações, autor, antes/depois e justificativa.

Relacionamentos: users 0..1 — 0..1 employees; employees 1 — N schedule_entries; schedule_periods 1 — N schedule_entries; schedule_templates 1 — N schedule_entries (opcional); schedule_periods 1 — N schedule_audit. Histórico e vínculos usam restrições de exclusão. Tabelas e migrações exatas em db/schema.sql e db/migrations. Guia funcional em MODULO-ESCALAS.md.

## Gestão completa de pessoas

Unidades e funcionários têm relação N:N por employee_units. Workforce_rules guarda limites globais/por unidade. Workforce_availability e workforce_swaps registram solicitações e decisões. Attendance_sessions representa jornadas; attendance_events preserva marcações e correções. Payroll_profiles mantém os parâmetros de remuneração por funcionário; payroll_runs guarda o demonstrativo mensal fechado e auditado. Referências a usuários e funcionários preservam históricos. A definição executável está na migração 003-workforce.sql.

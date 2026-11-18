# Modelo Conceitual de Dados

Este documento apresenta o Modelo Conceitual de Dados do sistema de controle de estoque. O objetivo Ã© descrever as principais entidades, atributos e relacionamentos identificados a partir dos requisitos funcionais da aplicaÃ§Ã£o web existente.

## Diagrama Entidade-Relacionamento (DER)

```mermaid
erDiagram
    USERS ||--o{ MOVIMENTACOES : "realiza"
    INVENTORY ||--o{ MOVIMENTACOES : "origina"

    USERS {
        UUID id PK
        TEXT username
        TEXT username_lower
        TEXT password_hash
        TEXT role
        BOOLEAN approved
        TEXT photo
        TEXT photo_mime
        BYTEA photo_data
    }

    INVENTORY {
        UUID id PK
        TEXT produto
        TEXT tipo
        TEXT lote
        INTEGER quantidade
        DATE validade
        NUMERIC custo
        TEXT image
        TEXT image_mime
        BYTEA image_data
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    MOVIMENTACOES {
        UUID id PK
        UUID produto_id FK
        TEXT produto
        TEXT tipo
        INTEGER quantidade
        INTEGER quantidade_anterior
        INTEGER quantidade_atual
        TEXT motivo
        TIMESTAMPTZ data
        TEXT usuario
    }
```

## Entidades

- **Users**: representa os usuários autenticados do sistema. Os atributos contemplam identificação (`id`), credenciais (`username`, `password_hash`), papéis (`role`), status de aprovação (`approved`) e referência opcional à foto de perfil (`photo`, `photo_mime`, `photo_data`). O atributo `username_lower` é derivado para facilitar buscas case-insensitive.
- **Inventory**: corresponde ao catálogo de itens controlados no estoque. Inclui dados de identificação (`id`, `produto`, `tipo`, `lote`), controle quantitativo (`quantidade`, `custo`, `validade`) e recursos multimídia (`image`, `image_mime`, `image_data`, `created_at`, `updated_at`).
- **Movimentacoes**: registra o histÃ³rico das movimentaÃ§Ãµes de estoque. Armazena o identificador do registro (`id`), referÃªncia ao item movimentado (`produto_id`), descriÃ§Ã£o textual (`produto`), classificaÃ§Ã£o da movimentaÃ§Ã£o (`tipo`), variaÃ§Ã£o de quantidades, motivo, usuÃ¡rio responsÃ¡vel e carimbo temporal.

## Relacionamentos

- **Users 1:N Movimentacoes** â€“ cada movimentaÃ§Ã£o Ã© executada por um Ãºnico usuÃ¡rio autenticado, enquanto um usuÃ¡rio pode gerar diversas movimentaÃ§Ãµes ao longo do tempo.
- **Inventory 1:N Movimentacoes** â€“ cada movimentaÃ§Ã£o estÃ¡ associada a um item especÃ­fico do estoque, porÃ©m o histÃ³rico de um item pode conter vÃ¡rias movimentaÃ§Ãµes (entradas, saÃ­das, ediÃ§Ãµes e exclusÃµes).

As cardinalidades opcionais ("zero ou mais") refletem o fato de que movimentaÃ§Ãµes podem manter o campo `produto_id` nulo quando o item correspondente Ã© removido fisicamente do estoque, mantendo-se apenas a descriÃ§Ã£o textual para fins histÃ³ricos.




## Módulo de escalas implementado

Employees representa funcionários e possui vínculo opcional único com users. Schedule_templates contém modelos de turno, intervalo e situação. Schedule_periods representa semanas com rascunho/publicação e versão. Schedule_entries associa funcionário e semana e guarda trabalho, folga ou indisponibilidade com datas, intervalo, autores e cancelamento lógico. Schedule_audit registra ações, autor, antes/depois e justificativa.

Relacionamentos: users 0..1 — 0..1 employees; employees 1 — N schedule_entries; schedule_periods 1 — N schedule_entries; schedule_templates 1 — N schedule_entries (opcional); schedule_periods 1 — N schedule_audit. Histórico e vínculos usam restrições de exclusão. Tabelas e migrações exatas em db/schema.sql e db/migrations. Guia funcional em MODULO-ESCALAS.md.

## Gestão completa de pessoas

Unidades e funcionários têm relação N:N por employee_units. Workforce_rules guarda limites globais/por unidade. Workforce_availability e workforce_swaps registram solicitações e decisões. Attendance_sessions representa jornadas; attendance_events preserva marcações e correções. Payroll_profiles mantém os parâmetros de remuneração por funcionário; payroll_runs guarda o demonstrativo mensal fechado e auditado. Referências a usuários e funcionários preservam históricos. A definição executável está na migração 003-workforce.sql.

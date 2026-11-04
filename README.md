# Projeto Barbearia (BarberSaaS)

## Estrutura principal

- `web/`: aplicacao Next.js + Prisma.
- `contexto_ia/`: planejamento, diagnostico, checklist e diario de execucao.

## Setup rapido (desenvolvimento local)

Observacao: o frontend/backend Next.js roda via Node (`npm run dev`); no XAMPP usamos MySQL (e opcionalmente Apache para proxy).

1. Entre na aplicacao:
   - `cd web`
2. Inicie o XAMPP:
   - abra o XAMPP Control Panel
   - inicie `Apache` e `MySQL`
3. Crie o banco local (uma vez):
   - no `phpMyAdmin` (`http://localhost/phpmyadmin`), crie o banco `barbersaas`
4. Configure ambiente:
   - copie `.env.example` para `.env`
   - use ao menos `DATABASE_URL` e `SESSION_SECRET`
   - padrao XAMPP: `DATABASE_URL="mysql://root@localhost:3306/barbersaas"`
5. Instale dependencias:
   - `npm.cmd install`
6. Gere o cliente Prisma:
   - `npm.cmd run prisma:generate`
7. Aplique schema e seed no banco:
   - `npm.cmd run db:push`
   - `npm.cmd run db:seed`
8. Suba a app:
   - `npm.cmd run dev`

## Inicializacao com 1 clique (apresentacao)

1. No Windows, de duplo clique em:
   - `INICIAR-BARBERSAAS.bat`
2. O script automaticamente:
   - valida Node/npm
   - cria/ajusta `.env` se necessario
   - inicia MySQL do XAMPP
   - cria o banco `barbersaas` se nao existir
   - roda `prisma generate`, `db:push` e `db:seed`
   - sobe o sistema em `http://localhost:3000`

Requisitos para esse modo:
- XAMPP instalado (padrao `C:\xampp`) com MySQL disponivel na porta `3306`
- Node.js LTS instalado

## Comandos de validacao

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd run test`
- `npm.cmd run test:coverage`
- `npm.cmd run build`
- `npm.cmd run verify` (executa lint + typecheck + test + build)
- `npm.cmd run smoke:http`
- `npm.cmd run smoke:sentry` (valida prontidao Sentry no `/api/health` + monitor `health-alert` com `HEALTH_REQUIRE_SENTRY_READY=true`)
- `npm.cmd run sentry:test` (envia evento de teste para validar alerta on-call)
- `npm.cmd run smoke:e2e` (requer browser Chromium do Playwright: `npx.cmd playwright install chromium`)
- `npm.cmd run smoke:e2e:auth` (homolog local com banco+seed; valida login/criar/remarcar/cancelar)
- `npm.cmd run smoke:a11y` (axe + Playwright para violacoes criticas de acessibilidade)

## Comandos de banco

- `npm.cmd run db:push`
- `npm.cmd run db:migrate`
- `npm.cmd run db:migrate:deploy`
- `npm.cmd run db:migrate:status`
- `npm.cmd run db:seed`

Obs.: comandos de banco exigem `DATABASE_URL` configurada no `.env`.
Obs. 2: a CLI do Prisma usa `web/prisma.config.ts`.
Obs. 3: migracao baseline versionada em `web/prisma/migrations/20260325183000_init/migration.sql`.

## Operacao

### Sugestões de cortes com Gemini

- Área do cliente: `/cliente/corte-ideal` (menu **Meu corte**).
- Preparação, modelos, chave de servidor, migração e retenção: `docs/operacao/recomendacoes_gemini.md`.
- Catálogo de cortes: `npm.cmd run db:seed:hairstyles` (não redefine contas ou agenda).
- Limpeza periódica de imagens expiradas: `npm.cmd run ai:cleanup`.
- O agendamento convencional continua disponível sem Gemini.

- Healthcheck: `GET /api/health`
- Pipeline CI: `.github/workflows/ci.yml`
- Pipeline Smoke: `.github/workflows/smoke.yml`
- Monitor de saude agendado: `.github/workflows/health-monitor.yml`
- Correlacao de requests: header `x-request-id` propagado no `proxy` e usado em logs estruturados.
- Telemetria basica: `/api/health` inclui taxa de erro e latencia media por rota (memoria local).
- Telemetria de notificacoes: `/api/health` inclui metricas de entrega por canal (`email`/`whatsapp`).
- Observabilidade externa: `/api/health` inclui status de prontidao do Sentry (`required`, `ready`, `missing`) sem expor DSN.
- Backup/restore e runbook: `docs/operacao/backup_restore.md` e `docs/operacao/runbook_incidente.md`
- Setup on-call Sentry: `docs/operacao/sentry_alertas_oncall.md`
- Plano de go-live: `docs/operacao/go_live_plan.md`
- Comunicacao de go-live: `docs/operacao/comunicacao_go_live.md`
- Monitoramento 7 dias: `docs/operacao/monitoramento_pos_go_live_7_dias.md`
- Revisao pos go-live: `docs/operacao/revisao_pos_go_live.md`
- Aprovacao de rollback: `docs/operacao/rollback_aprovacao.md`
- Plano de upgrade Prisma 7 com rollback: `docs/operacao/prisma7_upgrade_rollback.md`
- SEO tecnico: `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`
- Paginas legais publicas: `/termos-de-uso` e `/politica-privacidade`
- LGPD: `docs/compliance/lgpd_solicitacoes_titular.md`, `docs/compliance/lgpd_sla_canais.md`, `docs/compliance/lgpd_checklist_execucao.md`, `docs/compliance/lgpd_modelo_resposta.md`, `docs/compliance/lgpd_registro_solicitacoes.md`

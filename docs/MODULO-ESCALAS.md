# Módulo de escalas — guia e verificação

Atualizado em 18/11/2026. Funcionalidades RF01–RF11 e expansões de gestão de pessoas implementadas.

## Como usar

1. Abra http://localhost:3000, entre no sistema e escolha **Escalas de funcionários**.
2. Cadastre a equipe em Funcionários. Vincule um usuário aprovado quando o funcionário precisar consultar os próprios horários. Editar permite inativar e remover/alterar o vínculo sem apagar histórico.
3. Em Modelos de turno, cadastre entrada, saída, intervalo e a indicação de saída no dia seguinte. Modelos podem ser editados e inativados; lançamentos já existentes mantêm os horários salvos.
4. Escolha uma segunda-feira. Inclua trabalho, folga ou indisponibilidade. Em trabalho noturno, informe explicitamente a data de saída. Intervalos devem estar dentro do turno.
5. Confira os totais previstos, filtre por funcionário e publique. Funcionários vinculados veem apenas seus próprios lançamentos de semanas publicadas.
6. Para corrigir uma semana publicada, edite/cancele lançamentos e adicione-os à revisão. Confira a lista, informe uma justificativa e clique em **Salvar e republicar**. Todas as alterações são confirmadas juntas; se uma falhar, nenhuma é gravada.
7. **Copiar semana anterior** gera uma prévia com funcionários, horários e conflitos. Confirme para criar lançamentos em rascunho. A operação não publica automaticamente nem ignora conflitos.
8. O histórico mostra autor, data, ação, justificativa e valores anteriores/novos. Imprimir utiliza a grade semanal, sem menus e formulários.

## Cobertura do plano

| Item | Implementação |
| --- | --- |
| RF01 — funcionários | Cadastro, edição, inativação, vínculo opcional a usuário aprovado |
| RF02 — modelos | Cadastro, edição, inativação e intervalo opcional, inclusive noturno |
| RF03 — escala semanal | Grade no computador, cartões por dia no celular, anterior/próxima semana |
| RF04 — folgas/indisponibilidade | Cadastro, edição, cancelamento e divisão automática por semanas |
| RF05 — conflitos | Comparação de trabalho/folga/indisponibilidade, intervalos reservados e verificação entre semanas |
| RF06 — publicação | Rascunhos privados, publicação e validação transacional |
| RF07 — Minha escala | Consulta pela identidade da sessão; parâmetros não permitem consultar outro funcionário |
| RF08 — correções | Revisão em lote, justificativa, versão otimista, rollback e auditoria |
| RF09 — horas previstas | Dedução do intervalo; folgas não somam horas; turno atribuído à semana de entrada |
| RF10 — filtros/impressão | Semana, funcionário e impressão A4 horizontal sem menus/formulários |
| RF11 — cópia | Prévia de conflitos e versões de origem/destino revalidadas antes da confirmação |
| Atualizações | Socket autenticado, avisos sem dados de escala para administradores e destinatários autorizados; consulta de reserva a cada 60 segundos |
| Sessão e edição | Limpeza no logout, carregamentos antigos cancelados e preservação de formulários não salvos durante avisos |

Os limites de jornada e descanso são configurados pelo administrador, globalmente ou por unidade, com modo de bloqueio ou aviso. Nenhum limite é imposto sem configuração. WhatsApp e e-mail estão fora do escopo por solicitação do usuário.

## Dados e execução

- PostgreSQL: employees, schedule_templates, schedule_periods, schedule_entries e schedule_audit. Trabalho e indisponibilidade compartilham lançamentos e as mesmas regras de conflito.
- Instantes em TIMESTAMPTZ; exibição em America/Sao_Paulo. Uma indisponibilidade entre semanas vira lançamentos contíguos, cada um publicado com sua semana e editável separadamente.
- Migrações 001, 002 e 003 são aplicadas automaticamente e registradas em schema_migrations. db/schema.sql contém também o esquema consolidado para novas instalações.
- API: /api/schedules/employees, /templates, /week, /me, /entries, /corrections, /publish, /copy e /audit. Edição de funcionários/modelos utiliza PUT com seu identificador.
- Regras em lib/schedules.js; acesso e transações em lib/schedules-repository.js; rotas em routes/schedules.js; interface em schedules.js e schedules.css.
- Escritas do módulo são serializadas com advisory lock transacional e bloqueios de funcionários. As revisões de semana continuam obrigatórias: o segundo envio com versão antiga recebe 409.
- As salas Socket.IO são por usuário; o servidor consulta a aprovação e o papel atuais antes de selecionar os destinatários. Nenhuma escala completa é enviada pelo evento.

Comandos: npm.cmd run local:start; npm.cmd run local:stop; npm.cmd run local:status. Migração manual local: npm.cmd run migrate -- --local. Para outro banco, definir DATABASE_URL explicitamente antes de executar npm.cmd run migrate.

## Validação reproduzível

- npm.cmd test: 21 testes unitários, incluindo turno noturno, intervalo, datas inválidas e semana pelo fuso local.
- npm.cmd run test:schedules:integration: 20 grupos com PostgreSQL real. Cria um banco separado com nome aleatório, inicia uma instância isolada do servidor e remove somente esse banco ao terminar. Requer o PostgreSQL local em execução.
- Integração cobre concorrência, permissões, usuário não aprovado, socket autenticado, conflito entre semanas, rollback de correção em lote, troca de funcionário, republicação, cópia e destinatários privados.
- Verificação no navegador: cadastro de funcionário, trabalho com intervalo, publicação, revisão e republicação, cópia em rascunho e cartões por dia. Os dados temporários dessa verificação foram removidos.
- Login, 91 produtos de exemplo, Caixa, relatórios e proteção de arquivos internos foram conferidos novamente.

## Ferramentas completas da equipe

Abra Escalas de funcionários e use o atalho **Equipe, ponto e folha**.

1. **Unidades e equipes:** cadastre/edite/inative unidades; associe cada funcionário a uma ou mais unidades. Os conflitos de horário são conferidos entre todas as unidades. No lançamento de trabalho, selecione uma unidade autorizada para o funcionário associado.
2. **Limites de jornada e descanso:** defina horas máximas diárias/semanais e descanso mínimo, globalmente ou por unidade. Campos vazios ficam sem limite. Avisos aparecem no painel semanal. O modo de bloqueio rejeita a gravação; a geração automática respeita limites mesmo quando a configuração está em aviso.
3. **Disponibilidade:** funcionário informa janelas disponíveis ou indisponíveis e acompanha a decisão. Administrador aprova ou recusa com motivo. Solicitações pendentes não alteram a escala. Indisponibilidade conflitante exige remanejamento antes da aprovação. Havendo janelas disponíveis aprovadas na semana, os turnos devem ficar cobertos por essas janelas; janelas adjacentes são unidas. Solicitações pendentes podem ser retiradas pelo funcionário; revogação posterior é administrativa e auditada.
4. **Trocas de turno:** funcionário escolhe seu turno publicado e o de um colega da equipe. O colega aceita/recusa; após o aceite, o administrador aprova/recusa com justificativa. A aprovação troca os funcionários em uma transação, revalida unidades, disponibilidade, limites e conflitos, atualiza as versões e registra histórico. Se os turnos tiverem mudado, uma nova solicitação é necessária. O solicitante pode cancelar antes da aprovação final.
5. **Geração automática:** selecione semana em rascunho, unidade, modelo, dias e pessoas por turno. A prévia distribui a carga entre funcionários ativos elegíveis e explica vagas sem cobertura. Confirmação revalida a prévia e grava somente se toda a demanda estiver atendida. O resultado continua em rascunho para revisão e publicação. O algoritmo faz distribuição determinística por carga prevista; não promete otimização matemática global.
6. **Ponto eletrônico:** cada funcionário vinculado registra entrada, início/fim do intervalo e saída com o horário do servidor. Não é possível abrir duas jornadas ou sair com intervalo aberto. O administrador pode corrigir uma jornada ou incluir uma jornada esquecida, com justificativa e sem sobreposição. Eventos originais permanecem no histórico.
7. **Banco de horas:** consulte a competência e o funcionário. Horas registradas são calculadas pelas jornadas encerradas, descontando intervalos. O saldo usa a carga mensal contratada, quando configurada; caso contrário, a escala publicada. O acumulado considera competências anteriores fechadas e a competência atual. Jornadas que atravessam meses pertencem à competência da entrada, seguindo o critério de atribuição de turnos do módulo.
8. **Folha:** configure remuneração mensal ou por hora, carga mensal, adicional de hora extra, destino do excedente (banco/pagamento), proventos e descontos. Para mensalista, a carga mensal é obrigatória. O demonstrativo separa base, horas extras, adicionais e descontos, sem duplicar o pagamento das horas destinadas ao banco. Descontos por faltas ou tributos são informados pelo administrador; o sistema não calcula legislação tributária automaticamente e não executa pagamentos.
9. **Fechamento:** impede fechamento com jornada aberta ou sem remuneração configurada. O demonstrativo fica congelado mesmo que a configuração de remuneração mude depois. Para corrigir ponto daquela competência, é necessário reabrir com justificativa. Impressão e exportação CSV estão disponíveis para o demonstrativo autorizado.

Funcionário consulta somente suas solicitações, seu ponto e sua folha; administrador gerencia a equipe. A conta administrativa também precisa de vínculo a funcionário para registrar o próprio ponto ou solicitar uma troca. Para consultar folha/ponto de outra pessoa, escolha-a no seletor e clique em Consultar ponto e folha.

### Estrutura adicional

A migração 003 cria workforce_units, employee_units, workforce_rules, workforce_availability, workforce_swaps, attendance_sessions, attendance_events, payroll_profiles e payroll_runs; acrescenta unidade aos lançamentos. Regras em lib/workforce-policy.js; operações em lib/workforce-repository.js; rotas em routes/workforce.js; interface em workforce.js. Rotas usam /api/schedules/workforce. Valores de remuneração são privados e os eventos automáticos enviam somente sinais de atualização, sem dados financeiros.

### Validação das expansões

Os 20 grupos de integração usam banco separado e cobrem unidades, geração com falta de pessoal/limites, prévia desatualizada, troca com aceite e aprovação, disponibilidade, ponto sequencial, correção/inclusão manual, cálculo de folha e banco, fechamento congelado, reabertura e acesso indevido. A interface foi conferida com uma conta e uma unidade de demonstração em outra instância do servidor; essa instância e seu banco foram removidos. O banco principal manteve os cadastros originais.

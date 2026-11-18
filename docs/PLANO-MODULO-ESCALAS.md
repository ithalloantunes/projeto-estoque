# Plano de desenvolvimento — horários e escalas dos funcionários

**Projeto:** AçaíStock / projeto-estoque-main
**Data:** 18 de novembro de 2026
**Situação:** RF01–RF11 e todas as expansões de gestão de pessoas implementadas. WhatsApp/e-mail excluídos por solicitação. Guia e validação em MODULO-ESCALAS.md.

## 1. Objetivo e exemplo de uso

Permitir que o administrador organize quem trabalha em cada dia, com horário de entrada, saída, intervalo e folgas. Cada funcionário poderá consultar sua própria escala publicada.

Exemplo: o administrador seleciona a semana de 23 a 29 de novembro, cadastra Ana para trabalhar na segunda-feira das 14h às 22h, com intervalo das 18h às 19h, e define a terça-feira como folga. Ao publicar a semana, Ana vê esses horários no sistema. A carga planejada desse turno é de sete horas.

O módulo organiza **horários planejados**. Registro real de ponto, cálculo de salário e banco de horas serão expansões futuras; horas previstas não devem ser apresentadas como horas efetivamente trabalhadas.

## 2. O que já existe e será aproveitado

| Parte do projeto | Estrutura observada | Uso no módulo |
| --- | --- | --- |
| Interface | index.html, estilos.css e javascript.js; HTML/CSS/JavaScript sem framework de interface | Manter o padrão visual e acrescentar a área Escalas |
| Servidor | server.js, Node.js e Express | Usar as mesmas sessões, respostas JSON e validações |
| Dados | PostgreSQL, db/schema.sql e criação de tabelas em initializeDatabase | Criar migração própria e documentar a instalação |
| Usuários | users com UUID, role admin/user e approved | Reaproveitar login e aprovação; vincular a ficha do funcionário a um usuário quando necessário |
| Permissões | authMiddleware e requireAdmin | Proteger todas as rotas e conferir o proprietário dos dados no servidor |
| Navegação | Módulos Estoque e Caixa; funções específicas para alternar entre os dois | Generalizar a troca para três módulos |
| Atualizações | Socket.IO e eventos como dataUpdated | Avisar quando uma escala publicada mudar, respeitando as permissões |
| Testes | node --test; pg-mem nos testes de importação | Acrescentar testes das regras e usar PostgreSQL real nas verificações de concorrência |

Não é necessário trocar a tecnologia do projeto para desenvolver a primeira versão.

## 3. Escopo da primeira versão

| ID | Funcionalidade | Prioridade | Resultado esperado |
| --- | --- | --- | --- |
| RF01 | Cadastrar e inativar funcionários | Essencial | Nome, função, situação e vínculo opcional com usuário; histórico preservado |
| RF02 | Cadastrar modelos de turno | Essencial | Nome, entrada, saída, término no dia seguinte e intervalo opcional |
| RF03 | Montar escala semanal | Essencial | Selecionar funcionário, dia e turno; permitir ajuste do horário naquele lançamento |
| RF04 | Registrar folgas e indisponibilidades | Essencial | Exibir os períodos e impedir lançamento de trabalho incompatível |
| RF05 | Prevenir conflitos | Essencial | Bloquear sobreposição para o mesmo funcionário, inclusive com outra semana |
| RF06 | Controlar rascunho e publicação | Essencial | Apenas o administrador vê rascunhos; funcionário vê a escala publicada |
| RF07 | Consultar Minha escala | Essencial | Funcionário acessa somente os próprios horários e folgas publicados |
| RF08 | Corrigir e cancelar lançamentos | Essencial | Justificativa após publicação; alteração atômica e histórico de quem mudou |
| RF09 | Calcular horas previstas | Essencial | Somar saída menos entrada menos intervalo, por funcionário e semana |
| RF10 | Filtrar e imprimir | Desejável | Filtros por semana e funcionário; impressão legível sem botões e menus |
| RF11 | Copiar a semana anterior | Posterior | Criar novo rascunho com prévia dos conflitos, sem publicar automaticamente |

As expansões de trocas, aprovação de disponibilidade, geração automática, múltiplas unidades, ponto, banco de horas, folha e limites configuráveis foram implementadas. WhatsApp/e-mail estão excluídos do escopo.

## 4. Perfis e fluxo de utilização

| Ação | Administrador | Funcionário aprovado |
| --- | --- | --- |
| Manter funcionários e modelos de turno | Sim | Não |
| Ver a escala de toda a equipe e rascunhos | Sim | Não |
| Criar, publicar e corrigir escalas | Sim | Não |
| Consultar a própria escala publicada | Sim, se possuir vínculo | Sim, se possuir vínculo |
| Consultar auditoria e totais de toda a equipe | Sim | Não |

Um usuário sem vínculo de funcionário verá a orientação de solicitar o vínculo ao administrador. Usuários não aprovados continuam sem acesso. A ficha de funcionário pode existir sem login, para que o administrador monte a escala de toda a equipe.

Fluxo do administrador: cadastrar equipe → cadastrar turnos → escolher semana → lançar trabalho/folgas → revisar conflitos e totais → publicar.

Fluxo do funcionário: entrar no sistema → abrir Escalas → Minha escala → selecionar semana → consultar horários, intervalos e folgas.

## 5. Telas propostas

| Tela | Elementos principais |
| --- | --- |
| Escala da equipe | Semana anterior/próxima; funcionários nas linhas e dias nas colunas; filtros; estado Rascunho/Publicada; botão Publicar |
| Lançamento de turno | Funcionário, data, entrada, data/hora de saída, intervalo, modelo opcional e observação |
| Funcionários | Lista, nome, função, ativo/inativo e associação a usuário existente |
| Modelos de turno | Nome e horários; indicação explícita quando termina no dia seguinte |
| Folgas e indisponibilidades | Funcionário, início, fim e tipo; ausência de trabalho não deve ser automaticamente tratada como folga |
| Minha escala | Cartões por dia no celular; entrada, saída, intervalo e total previsto da semana |
| Histórico | Quem alterou, quando, justificativa e valores anteriores/novos |

Usar cores acompanhadas de texto, para não depender apenas da cor. No celular, a grade semanal vira uma lista de dias. Incluir estados de carregamento, lista vazia, erro, conflito e acesso negado.

## 6. Regras de negócio

1. Somente administrador aprovado altera equipe, turnos, folgas e escalas. Ocultar botões não substitui validar a permissão na API.
2. Funcionário inativo não recebe novos turnos. A inativação não apaga turnos anteriores.
3. A saída deve ocorrer depois da entrada. Se o trabalho atravessar a meia-noite, a data de saída deve ser informada explicitamente; o sistema não deve presumir que um erro de digitação significa um turno noturno.
4. O intervalo é opcional; quando informado, exige início e fim, deve ficar dentro do turno e ter duração positiva. A primeira versão admite um intervalo por turno.
5. Impedir sobreposição de trabalho do mesmo funcionário, incluindo rascunhos ativos, escalas publicadas e registros de semanas diferentes. O intervalo de refeição continua dentro do período reservado do turno.
6. Trabalho e folga/indisponibilidade do mesmo funcionário não podem se sobrepor. Lançamentos consecutivos sem interseção são permitidos: 14h–18h e 18h–22h não conflitam.
7. Revalidar tudo ao salvar e ao publicar. Duas solicitações simultâneas não podem conseguir gravar turnos incompatíveis.
8. Um modelo de turno apenas preenche o formulário. Guardar os horários reais planejados no lançamento: editar o modelo posteriormente não modifica escalas já criadas.
9. Funcionários veem somente escalas publicadas. As folgas exibidas em Minha escala também devem pertencer a uma semana publicada.
10. Corrigir uma semana publicada exige justificativa e ação explícita de salvar e republicar. Validar e gravar o conjunto de alterações, a nova versão e a auditoria em uma transação. A versão anterior continua visível até a confirmação da nova gravação.
11. Usar cancelamento lógico para lançamentos com histórico. No MVP, bloquear exclusão de usuários vinculados a funcionários; isso exige ajustar a rota existente DELETE /api/users/:id. Oferecer inativar o funcionário e remover o vínculo de forma controlada.
12. Usar America/Sao_Paulo como fuso de exibição. Guardar instantes em TIMESTAMPTZ e trabalhar com datas locais ao definir semanas e dias. Não calcular o dia local apenas cortando uma data UTC.
13. A semana começa na segunda-feira. Vincular o turno à semana de sua entrada, mesmo quando termina no dia ou na semana seguinte.
14. Limites de carga planejada e descanso, se adotados pela empresa, devem ser parâmetros definidos na etapa de requisitos, com comportamento de aviso/bloqueio documentado; não inventar limites fixos.
15. Totais são derivados dos lançamentos ativos. Um turno 22h–06h com intervalo 02h–03h soma sete horas previstas; uma folga soma zero. Na visão semanal, o MVP atribui o turno inteiro à semana da entrada e informa esse critério na tela.

## 7. Modelo de dados proposto

Os nomes abaixo são uma proposta de implementação, não tabelas já existentes.

| Tabela | Campos principais | Relações e restrições |
| --- | --- | --- |
| employees | id UUID, user_id UUID opcional, nome, funcao, ativo, created_at, updated_at | user_id único quando preenchido; FK users com RESTRICT; ficha permanece no histórico |
| shift_templates | id, nome, entrada TIME, saida TIME, termina_dia_seguinte BOOLEAN, intervalo_inicio TIME opcional, intervalo_fim TIME opcional, ativo | Validar duração e intervalo ao aplicar o modelo; modelo inativo não entra em novos lançamentos |
| schedule_periods | id, week_start DATE, status, version INTEGER, published_by, published_at, created_at, updated_at | week_start única e sempre segunda-feira; status draft/published; autor FK users |
| schedule_assignments | id, period_id, employee_id, template_id opcional, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, break_starts_at, break_ends_at, observacao, cancelled_at, created_by, updated_by | FKs para semana, funcionário e modelo; CHECK de datas/intervalo; exclusão física restrita |
| employee_unavailability | id, employee_id, period_id, starts_at, ends_at, tipo, observacao opcional, cancelled_at, created_by | Tipos folga/indisponivel; fracionar um período que atravesse semanas; visibilidade segue publicação |
| schedule_audit | id, period_id opcional, employee_id opcional, actor_user_id, action, before_data JSONB, after_data JSONB, justificativa, created_at | Gravar criação, edição, cancelamento, publicação e alterações cadastrais; acesso administrativo |

Criar índices por (employee_id, starts_at), period_id e (period_id, created_at) para a auditoria. Conservar nomes de funcionários por inativação, sem apagar suas fichas. Campos e política de retenção das observações devem evitar coletar informações que não ajudam a organizar a escala.

**Concorrência:** toda gravação de turno ou indisponibilidade deve obter um bloqueio da linha de employees dentro da transação, consultar conflitos e só então gravar. Para uma operação com vários funcionários, adquirir os bloqueios em ordem de UUID para reduzir impasses. A comparação usa `inicio_existente < fim_novo AND fim_existente > inicio_novo`, ignorando registros cancelados e o próprio registro em edição. Isso protege inclusive conflitos entre as duas tabelas. Publicação e correção também verificam a versão da semana; versão desatualizada retorna 409.

**Migração:** criar db/migrations/001-schedules.sql e um executor que registre migrações aplicadas. Atualizar db/schema.sql para instalações novas e chamar o executor na inicialização, após as tabelas atuais. Não confiar em alterações manuais do banco nem reexecutar mudanças destrutivas a cada abertura.

## 8. API proposta

Todas as rotas exigem a sessão existente. Rotas administrativas também exigem requireAdmin.

| Método e rota | Acesso | Operação |
| --- | --- | --- |
| GET /api/employees | Admin | Listar e filtrar funcionários |
| POST /api/employees | Admin | Criar funcionário |
| PUT /api/employees/:id | Admin | Editar dados, situação ou vínculo de login |
| GET /api/shifts | Admin | Listar modelos de turno |
| POST /api/shifts | Admin | Criar modelo |
| PUT /api/shifts/:id | Admin | Editar/inativar modelo |
| GET /api/schedules?weekStart=YYYY-MM-DD | Admin | Consultar escala da equipe, folgas e totais |
| POST /api/schedules | Admin | Criar semana em rascunho, sem duplicar a data inicial |
| POST /api/schedules/:id/assignments | Admin | Incluir trabalho no rascunho |
| PUT /api/schedules/:id/assignments/:assignmentId | Admin | Editar trabalho do rascunho |
| POST /api/schedules/:id/assignments/:assignmentId/cancel | Admin | Cancelar trabalho do rascunho |
| POST /api/schedules/:id/unavailability | Admin | Incluir folga/indisponibilidade no rascunho |
| PUT /api/schedules/:id/unavailability/:entryId | Admin | Editar folga/indisponibilidade no rascunho |
| POST /api/schedules/:id/unavailability/:entryId/cancel | Admin | Cancelar folga/indisponibilidade do rascunho |
| POST /api/schedules/:id/publish | Admin | Validar e publicar usando expectedVersion |
| POST /api/schedules/:id/corrections | Admin | Corrigir lançamentos publicados e republicar em uma transação, com expectedVersion e justificativa |
| GET /api/schedules/me?weekStart=YYYY-MM-DD | Usuário aprovado | Consultar somente dados do funcionário vinculado à sessão |
| GET /api/schedules/:id/audit | Admin | Consultar histórico da semana |

Erros: 400 para campos inválidos; 401 sem sessão; 403 sem permissão/vínculo; 404 para registro inexistente; 409 para sobreposição ou versão desatualizada. O servidor busca employee_id a partir de req.user.id em Minha escala; não aceita um funcionário arbitrário enviado pelo navegador.

Nas respostas de conflito, informar de forma acessível qual período precisa de ajuste, sem revelar dados de outros funcionários para um usuário comum.

## 9. Alterações previstas nos arquivos

| Arquivo | Alteração planejada |
| --- | --- |
| index.html | Botão module-schedules-btn, contêiner schedules-module, menu e formulários de Escalas |
| estilos.css | Grade semanal, cartões de dia, etiquetas de situação e regras de impressão |
| javascript.js | Trocar a lógica booleana Estoque/Caixa por mapa de módulos; revisar setModuleButtonState, applyModuleVisibility, switchToStockModule e switchToCashierModule; acionar o módulo de escalas |
| schedules.js, novo | Estado de semana, chamadas da API, formulários, filtros e atualização da escala; disponibilizar uma inicialização com o usuário da sessão e uma limpeza no logout |
| server.js | Montar o roteador de escalas depois de authMiddleware/requireAdmin; expor schedules.js explicitamente, pois o servidor não publica todos os arquivos da raiz |
| lib/schedules.js, novo | Regras de datas, intervalo, conflitos e cálculo de horas |
| lib/schedules-repository.js, novo | Consultas SQL parametrizadas, transações, bloqueios e auditoria |
| routes/schedules.js, novo | Rotas e autorização; receber middleware e pool por parâmetro, evitando importar server.js e iniciar outro servidor |
| db/migrations/001-schedules.sql, novo | Tabelas, índices e restrições do módulo |
| scripts/migrate.mjs, novo | Executor e controle das migrações aplicadas |
| db/schema.sql | Consolidar o esquema para instalações novas |
| tests/schedules*.test.mjs, novos | Regras unitárias e integração de autorização, publicação e conflitos |
| docs/modelo-conceitual.md e docs/modelo-logico.md | Atualizar a documentação com funcionários, turnos e escalas |

**Atenção à navegação atual:** setModuleButtonState trata qualquer módulo diferente de stock como Caixa; applyModuleVisibility também pressupõe apenas dois módulos. Adicionar um botão sem corrigir essas funções fará o módulo errado aparecer.

**Atualizações em tempo real:** reutilizar Socket.IO, mas autenticar o socket pela sessão, validar aprovação e colocar administradores e funcionários em salas próprias no servidor. Enviar apenas sinal de atualização para os destinatários permitidos e recarregar pela API protegida. Não transmitir escalas completas pelo broadcast global existente. Atualizar a tela após salvar, mesmo quando o socket estiver indisponível.

## 10. Etapas, esforço e entregas

Estimativa inicial para uma pessoa que conhece a estrutura e trabalha cerca de seis horas por dia. Trata-se de esforço de desenvolvimento; os dias podem aumentar se houver estudo durante a implementação ou novas regras de negócio.

| Etapa | Trabalho | Esforço | Entrega verificável |
| --- | --- | --- | --- |
| 1 | Confirmar regras com um exemplo real e desenhar as telas | 6 h | Escopo e protótipo aprovados; definir intervalos, turno noturno e publicação |
| 2 | Migrações, funcionários, modelos e permissões | 12 h | API e dados persistentes; cadastro básico funcional |
| 3 | Turnos, folgas, cálculo e prevenção de conflitos | 18 h | Regras testadas, incluindo duas gravações simultâneas |
| 4 | Publicação, correções e auditoria | 12 h | Rascunhos privados e histórico consistente |
| 5 | Integração do terceiro módulo e telas responsivas | 18 h | Administrador organiza a semana; funcionário consulta Minha escala |
| 6 | Testes integrados, ajustes e documentação | 12 h | Estoque e Caixa preservados; aceite dos cenários abaixo |
| Reserva | Correções e imprevistos técnicos | 12 h | Margem de execução |
| Total | Primeira versão essencial | **90 h / aproximadamente 15 dias úteis** | Módulo pronto para validação com a equipe |

Ordem de dependências: requisitos → banco/permissões → regras/API → publicação → interface integrada → validação. A impressão pode ser incluída na etapa de interface se a estimativa permitir; copiar semanas fica para uma entrega posterior.

## 11. Cenários de teste e critérios de aceite

| Cenário | Resultado esperado |
| --- | --- |
| Ana trabalha 14h–22h com intervalo 18h–19h | Sete horas previstas; intervalo aparece na consulta |
| Tentar inserir 17h–21h para Ana no mesmo dia | 409; nenhum registro parcial |
| Inserir 14h–18h e 18h–22h | Os dois turnos são aceitos |
| Turno de domingo 22h até segunda 06h; tentar segunda 05h–09h na outra semana | Conflito detectado entre semanas |
| Turno 22h–06h com intervalo 02h–03h | Datas explícitas; sete horas previstas |
| Entrada igual/posterior à saída, intervalo invertido ou fora do turno | 400; formulário informa o campo inválido |
| Folga e trabalho sobrepostos | Bloqueio tanto ao cadastrar trabalho quanto ao cadastrar folga |
| Funcionário inativo recebe novo turno | Bloqueio; registros anteriores permanecem |
| Funcionário tenta consultar escala alheia alterando a URL/corpo | 403 ou rota inexistente; nenhum dado alheio é retornado |
| Usuário sem login ou não aprovado acessa API e socket | Acesso negado |
| Administrador salva rascunho | Equipe ainda não o vê |
| Publicar semana válida | Funcionário passa a ver horários e folgas da própria semana |
| Duas gravações simultâneas conflitantes | Apenas uma confirma; a outra recebe conflito |
| Editar com versão antiga da semana | 409; orientar a recarregar antes de tentar novamente |
| Corrigir escala publicada | Exigir justificativa, preservar antes/depois e disponibilizar a nova versão após a transação |
| Falha no meio de uma correção/publicação | Rollback; versão anterior permanece íntegra |
| Reiniciar o sistema | Cadastros, semanas publicadas e auditoria permanecem |
| Abrir no celular | Dias e ações legíveis, sem depender de uma grade larga |
| Alternar Estoque → Caixa → Escalas → Estoque e sair/entrar | Navegação, tema, sessão e limpeza de dados funcionam |

Os testes de restrições, bloqueios e transações devem rodar contra PostgreSQL real em um banco de teste separado. O pg-mem pode ajudar nos testes simples, mas não substitui verificar a concorrência usada para impedir conflitos.

Considerar concluído quando o administrador montar/publicar uma semana completa, o funcionário consultar somente a própria escala, conflitos forem impedidos mesmo em gravações simultâneas, os dados sobreviverem à reinicialização e os testes dos módulos existentes continuarem passando.

## 12. Próxima ação de implementação

Começar pela etapa 1 com três exemplos: turno comum com intervalo, turno que atravessa a meia-noite e funcionário de folga. A partir dessas regras, criar a migração e as permissões antes de construir a grade semanal. O novo módulo deve ser entregue em incrementos executáveis para facilitar a revisão.

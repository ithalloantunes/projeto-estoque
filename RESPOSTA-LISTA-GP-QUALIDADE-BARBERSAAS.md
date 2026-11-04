# Resposta - Lista de Exercicios de GP Qualidade

## Contexto utilizado

Esta resposta foi elaborada com base no sistema BarberSaaS e em sua documentacao tecnica. O material considera principalmente:

- o nucleo de agendamento e validacao de horarios em `web/src/lib/availability.ts`;
- a criacao e consulta de agendamentos em `web/src/app/api/appointments/route.ts`;
- a camada de notificacoes em `web/src/lib/notifications.ts`;
- o controle de sessao e autorizacao por perfil em `web/src/proxy.ts` e nas rotas de autenticacao;
- os riscos e a secao de qualidade descritos em `DOCUMENTACAO-BARBERSAAS.md`.

O foco, portanto, nao esta em exemplos genericos, mas em situacoes reais do projeto: conflitos de agenda, indisponibilidade do sistema, dependencias externas, integracao dos modulos internos e confiabilidade da experiencia do cliente.

## 1. Tres PDCAs com base nas atividades e riscos do projeto

### PDCA 1 - Qualidade do fluxo de agendamento e prevencao de conflitos de horario

| Etapa | Aplicacao no BarberSaaS |
| --- | --- |
| Plan | Definir como meta que o sistema apresente ao cliente apenas horarios realmente livres, considerando disponibilidade semanal do barbeiro, bloqueios de agenda, duracao do servico e agendamentos ja confirmados. Os indicadores principais sao: quantidade de conflitos detectados, taxa de agendamentos concluidos com sucesso e quantidade de tentativas rejeitadas por horario invalido. |
| Do | Executar a validacao das regras do fluxo de agendamento, especialmente a logica implementada em `availability.ts` e a validacao final realizada na rota `api/appointments`. Tambem testar cenarios de servicos com duracoes diferentes, reagendamentos e datas do dia atual. |
| Check | Verificar se os horarios exibidos ao usuario batem com a agenda real do barbeiro e se o sistema impede dupla reserva. Conferir erros retornados pela API, revisar casos de borda e comparar o horario escolhido com os intervalos bloqueados ou ocupados. |
| Act | Ajustar as regras onde houver falhas, formalizar testes repetiveis para a logica de disponibilidade e documentar criterios de aceite para impedir regressao futura no fluxo principal do produto. |

Resultado esperado: maior confiabilidade no agendamento online, reducao de retrabalho operacional e melhor experiencia para cliente e barbeiro.

### PDCA 2 - Reducao da indisponibilidade do sistema e das falhas de configuracao

| Etapa | Aplicacao no BarberSaaS |
| --- | --- |
| Plan | Mapear os pontos que podem derrubar ou comprometer o sistema: conexao com banco, variaveis de ambiente, sessao de usuario, envio de e-mail e integracao com WhatsApp. Os indicadores sao: numero de falhas por configuracao, disponibilidade do sistema, quantidade de erros em producao e continuidade do fluxo de agendamento mesmo sem notificacao externa. |
| Do | Executar checklist tecnico do ambiente, revisar credenciais obrigatorias, validar comportamento de fallback nas notificacoes e testar criacao de agendamento com e sem integracoes externas configuradas. |
| Check | Confirmar se o sistema continua funcional mesmo quando SMTP ou WhatsApp nao estao disponiveis, analisar logs de erro, revisar respostas da API e observar se o usuario consegue concluir a reserva sem depender do sucesso de servicos externos. |
| Act | Padronizar configuracoes, fortalecer monitoramento, manter instrucoes claras de implantacao e transformar os testes de ambiente em rotina antes de cada entrega ou demonstracao. |

Resultado esperado: sistema mais estavel, menor risco de parada parcial e reducao de falhas provocadas por dependencia externa ou ambiente mal configurado.

### PDCA 3 - Consolidacao dos modulos internos e seguranca de acesso por perfil

| Etapa | Aplicacao no BarberSaaS |
| --- | --- |
| Plan | Estabelecer como objetivo que as areas de administrador, barbeiro e cliente operem com dados coerentes, acessos corretos e navegacao segura. Os indicadores principais sao: falhas de permissao, inconsistencias entre interface e API, numero de telas internas sem integracao real e quantidade de correcoes por acesso indevido. |
| Do | Executar revisao dos fluxos protegidos por sessao, validar redirecionamentos por perfil, conferir se cada pagina consome apenas os dados apropriados e revisar integracao entre telas internas e rotas protegidas. |
| Check | Verificar se um cliente nao acessa recursos administrativos, se o barbeiro visualiza apenas o que lhe compete e se os paineis refletem os dados reais retornados pelas rotas do sistema. |
| Act | Refinar backlog tecnico, priorizar correcoes de permissao e integracao, criar criterios de aceite por perfil e fortalecer a manutencao da seguranca como parte da qualidade do produto. |

Resultado esperado: modulos internos mais maduros, risco menor de acesso inadequado e maior confianca no uso administrativo do sistema.

## 2. Tres Diagramas de Causa e Efeito com base nas atividades e riscos do projeto

### Diagrama 1 - Efeito: conflito ou falha no agendamento

| Categoria | Causas identificadas |
| --- | --- |
| Metodo | Falta de criterios de aceite detalhados para a regra de disponibilidade; validacao insuficiente de cenarios de borda; excesso de dependencia de teste manual. |
| Sistema | Erro no calculo de duracao do servico; conflito entre bloqueios e agendamentos ativos; tratamento incompleto de reagendamento e datas do dia atual. |
| Dados | Cadastro incorreto de duracao, preco ou disponibilidade; barbeiro sem agenda semanal consistente; bloqueios nao cadastrados. |
| Pessoas | Erro operacional ao cadastrar servicos ou horarios; mudancas manuais sem padrao; revisao funcional tardia. |
| Infraestrutura | Lentidao no banco ou falhas de API em momentos de pico; sessao expirada no meio do processo. |
| Medicao | Ausencia de metricas sobre conflitos evitados, erros de agendamento e tentativas rejeitadas por horario indisponivel. |

Leitura do diagrama: o efeito central e a perda de confianca no fluxo principal do BarberSaaS. Como o agendamento e o coracao do sistema, qualquer causa ligada a regra, dado ou validacao afeta diretamente a qualidade percebida pelo cliente e a organizacao da barbearia.

### Diagrama 2 - Efeito: indisponibilidade total ou parcial do sistema

| Categoria | Causas identificadas |
| --- | --- |
| Infraestrutura | Banco fora do ar; hospedagem instavel; falha de rede; indisponibilidade do servidor de aplicacao. |
| Configuracao | Variaveis de ambiente ausentes; credenciais invalidas; portas e hosts incorretos; diferenca entre ambiente local e ambiente publicado. |
| Dependencias externas | SMTP indisponivel; API do WhatsApp fora do ar; servicos terceiros com resposta lenta ou rejeicao de credenciais. |
| Seguranca e acesso | Problemas com sessao, cookie ou regras de protecao de rota; expiracao de autenticacao em fluxo critico. |
| Processo | Publicacao sem checklist; alteracoes tecnicas sem smoke test; ausencia de plano de contingencia. |
| Monitoramento | Falta de logs consolidados; demora para identificar causa raiz; ausencia de indicadores de disponibilidade. |

Leitura do diagrama: a indisponibilidade nao surge apenas de "erro tecnico". Ela tambem pode nascer de processo ruim, configuracao incompleta e dependencia externa mal tratada. Em um sistema de agendamento, isso compromete tanto a operacao quanto a imagem do negocio.

### Diagrama 3 - Efeito: atraso na entrega e queda da qualidade dos modulos internos

| Categoria | Causas identificadas |
| --- | --- |
| Escopo | Tentativa de evoluir muitos modulos ao mesmo tempo; crescimento indevido de requisitos; falta de recorte claro para cada entrega. |
| Integracao | Interfaces prontas antes da integracao real com API; ajustes frequentes entre front-end, banco e regra de negocio; dependencia entre modulos. |
| Comunicacao | Validacao tardia com o responsavel da barbearia; prioridades mudando sem registro claro; alinhamento insuficiente entre time e backlog. |
| Pessoas | Distribuicao desigual de tarefas; dependencia excessiva de poucos integrantes; acoplamento de conhecimento tecnico. |
| Validacao | Revisao continua insuficiente; correcao apenas no fim do ciclo; pouca formalizacao de testes por modulo. |
| Priorizacao | Foco difuso entre agenda, relatorios, autenticacao, pagamentos e administracao sem proteger primeiro o nucleo do produto. |

Leitura do diagrama: o atraso do projeto nao decorre apenas de falta de tempo. Ele aparece quando escopo, comunicacao, integracao e validacao deixam de caminhar juntos. Isso reduz previsibilidade e aumenta retrabalho.

## 3. Importancia do diagrama de causa e efeito na gestao da qualidade do projeto

O diagrama de causa e efeito e importante porque ajuda a equipe a sair da analise superficial do problema. Em vez de tratar apenas o sintoma, como "o sistema ficou indisponivel" ou "houve conflito de agenda", a ferramenta organiza as possiveis origens do problema em grupos logicos, como metodo, pessoas, dados, infraestrutura e processo. Com isso, a discussao fica mais objetiva e a tomada de decisao se torna mais madura.

No contexto do BarberSaaS, essa ferramenta e especialmente util porque o projeto envolve varias camadas ao mesmo tempo: interface, API, banco de dados, regras de disponibilidade, autenticacao e integracoes externas. Um erro percebido pelo usuario pode ter nascido em qualquer uma dessas partes. O diagrama permite enxergar essa relacao de causa e efeito de forma estruturada, facilitando a priorizacao de acoes corretivas e preventivas.

Ademais, o diagrama fortalece a qualidade porque melhora a comunicacao da equipe. Quando as causas ficam visualmente organizadas, o time consegue discutir menos por impressao e mais por evidencia, reduzindo achismos e aumentando a clareza sobre o que precisa ser corrigido, monitorado ou padronizado.

## 4. Importancia do PDCA no planejamento, na execucao e no monitoramento das atividades do projeto

O PDCA e importante no planejamento porque obriga a equipe a definir metas, criterios de aceite, indicadores e acoes antes de executar. No BarberSaaS, isso evita que o time desenvolva telas ou funcionalidades sem antes alinhar o que significa qualidade para cada entrega, especialmente no fluxo de agendamento, que e o nucleo do sistema.

Na execucao, o PDCA ajuda a transformar o planejamento em atividade concreta com foco e disciplina. A etapa "Do" nao significa apenas programar, mas implementar, testar e registrar evidencias do que foi feito. Em um projeto como este, isso e essencial para garantir que regras de disponibilidade, autenticacao e notificacoes nao sejam construidas de forma improvisada.

No monitoramento, o PDCA se torna ainda mais valioso porque a etapa "Check" permite comparar o resultado real com aquilo que foi planejado. Se a equipe percebe que ainda existem conflitos de horario, falhas de permissao ou erros de configuracao, ela nao precisa tratar isso como acaso, mas como desvio de processo que pode ser analisado e corrigido.

Por fim, a etapa "Act" garante aprendizado continuo. Em vez de repetir os mesmos erros em novas entregas, o time transforma o que foi observado em ajuste de backlog, melhoria tecnica, padronizacao e prevencao. Por isso, o PDCA nao serve apenas para controlar o projeto; ele serve para amadurecer o produto e a forma de trabalho da equipe ao longo do tempo.

## Conclusao

Com base no sistema BarberSaaS, os tres PDCAs e os tres diagramas de causa e efeito mostram que a qualidade do projeto depende principalmente da confiabilidade do agendamento, da estabilidade tecnica do ambiente e da maturidade dos modulos internos. Assim, a gestao da qualidade nao deve ser vista como etapa separada do desenvolvimento, mas como parte do proprio processo de construir, validar e evoluir o sistema.

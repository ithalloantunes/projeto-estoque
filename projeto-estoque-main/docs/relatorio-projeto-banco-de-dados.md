# Projeto Interdisciplinar e de Curricularização
## Sistema de Controle de Estoque

**Curso:** Engenharia de Software (disciplinas integradas de Banco de Dados e Desenvolvimento Web)  
**Equipe:** _Substituir pelos integrantes do grupo_  
**Período:** 2024/2

---

## 1 Introdução
Este relatório consolida o projeto de banco de dados desenvolvido para o sistema de controle de estoque utilizado pela aplicação web do curso. O documento segue as normas da ABNT para trabalhos técnicos: apresenta objetivos, requisitos, modelagem conceitual e lógica, normalização, implementação física, exemplos de consultas e evidências visuais do sistema.

## 2 Objetivos
### 2.1 Objetivo Geral
Projetar e documentar uma base de dados relacional íntegra, normalizada e alinhada aos requisitos funcionais do sistema de estoque.

### 2.2 Objetivos Específicos
- Modelar conceitualmente as entidades e relacionamentos relevantes.
- Derivar o esquema relacional lógico com todas as chaves e restrições necessárias.
- Comprovar a aplicação das formas normais até 3FN.
- Implementar o esquema físico em SQL (DDL) com restrições de integridade e índices.
- Disponibilizar consultas SQL de apoio a operações e relatórios.
- Documentar o sistema com registros de telas e descrição dos principais fluxos.

## 3 Metodologia
1. Levantamento dos requisitos a partir do código-fonte existente (`server.js`, `index.html`, `javascript.js`).
2. Elaboração do Diagrama Entidade-Relacionamento (DER) para representar o modelo conceitual.
3. Tradução do DER para o modelo lógico relacional considerando as particularidades do PostgreSQL.
4. Definição das restrições de integridade, índices e regras de negócio.
5. Implementação do script DDL e ajustes no backend para respeitar as novas validações.
6. Elaboração de consultas SQL de uso recorrente e sumarização.

## 4 Requisitos do Sistema
### 4.1 Requisitos Funcionais
- Cadastro, aprovação e autenticação de usuários com papéis (administrador e usuário comum).
- Controle de itens de estoque (criação, atualização, exclusão e anexos de imagem).
- Registro automático de movimentações (adições, entradas, saídas, edições e exclusões) com histórico completo.
- Geração de relatórios sintéticos (por produto, por dia) e exportação de movimentações em CSV.

### 4.2 Requisitos Não Funcionais
- Persistência em PostgreSQL 17.
- Garantia de integridade referencial e consistência semântica dos dados.
- Segurança básica (hash de senhas, aprovação de usuários, controle de acesso).
- Desempenho aceitável para consultas frequentes via índices apropriados.

## 5 Modelagem Conceitual
O DER completo encontra-se no documento [Modelo Conceitual de Dados](./modelo-conceitual.md), incluindo descrição das entidades, atributos e cardinalidades.

## 6 Modelo Lógico
O esquema relacional detalhado, com chaves primárias, estrangeiras, restrições e índices, está descrito em [Modelo Lógico de Dados](./modelo-logico.md).

## 7 Normalização
A validação das formas normais até a 3FN, bem como as dependências funcionais identificadas, é apresentada em [Documento de Normalização](./normalizacao.md).

## 8 Implementação Física (DDL)
O script oficial de criação do banco de dados está disponível em [`db/schema.sql`](../db/schema.sql). O backend (`server.js`) foi atualizado para aplicar as mesmas definições ao inicializar um ambiente vazio, garantindo consistência entre documentação e implementação.

As principais restrições de integridade (NOT NULL, UNIQUE, CHECK e FOREIGN KEY) estão sintetizadas em [Restrições de Integridade](./restricoes-integridade.md).

## 9 Consultas SQL de Apoio
Os exemplos de consultas para operações operacionais e gerenciais encontram-se no arquivo [`consultas-exemplo.sql`](./consultas-exemplo.sql), abrangendo listagem de estoque, filtragem de movimentações por período, sumarização diária, alerta de estoque mínimo, cálculo de valor financeiro e ranking de usuários.

## 10 Evidências Visuais do Sistema
- ![Tela de login](../img/cover/1.png)
- ![Dashboard principal](../img/cover/2.png)
- ![Gestão de estoque](../img/cover/3.png)
- ![Histórico de movimentações](../img/cover/4.png)

Outras capturas relevantes podem ser acrescentadas conforme a evolução da interface.

## 11 Considerações Finais
O banco de dados resultante atende às necessidades identificadas, garantindo rastreabilidade e confiabilidade dos registros. As restrições implementadas evitam inconsistências comuns (duplicidade de usuários, quantidades negativas, movimentações incoerentes) e o histórico preserva informações críticas mesmo após exclusão de itens.

Para trabalhos futuros recomenda-se: (i) integrar as movimentações a usuários por chave estrangeira dedicada, (ii) criar visões materializadas para relatórios intensivos e (iii) expandir o módulo de auditoria com triggers para registrar alterações em lote.

---

## Referências
- Elmasri, R.; Navathe, S. **Sistemas de Banco de Dados**. 7. ed. Pearson, 2019.
- Heuser, C. A. **Projeto de Banco de Dados**. 6. ed. Bookman, 2023.
- Código-fonte do projeto `projeto-estoque` (2024).

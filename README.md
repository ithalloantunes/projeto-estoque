# Projeto Estoque

Aplicação web para gerenciamento de estoque com autenticação, controle de produtos, movimentações e relatórios. A API agora utiliza PostgreSQL 17 (hospedado no Render ou em outra instância compatível) para armazenar usuários, itens de estoque e movimentações.

## Requisitos

- Node.js 18+
- PostgreSQL 17 (ou compatível)
- Conta no [Render](https://render.com) caso deseje hospedar a aplicação e o banco

## Variáveis de ambiente

| Variável            | Descrição                                                                                   |
|---------------------|---------------------------------------------------------------------------------------------|
| `PORT`              | Porta utilizada pelo servidor HTTP (padrão: `3000`).                                        |
| `DATABASE_URL`      | URL de conexão PostgreSQL. Ex.: `postgres://usuario:senha@host:5432/base`. **Obrigatória**. |
| `DATABASE_URL_EXTERNAL` | (Opcional) URL externa do banco, usada automaticamente ao rodar fora da infraestrutura do Render caso o host interno não seja acessível. |
| `DATABASE_SSL`      | Defina como `disable` para desativar SSL (apenas ambientes locais).                         |
| `JWT_SECRET`        | (Opcional) Segredo customizado para assinar os tokens JWT.                                  |
| `PGPOOL_MAX`        | (Opcional) Número máximo de conexões simultâneas no pool (`10` por padrão).                 |
| `NODE_ENV`          | Use `production` em produção para habilitar cookies `secure` e SSL no banco.                |
| `CORS_ALLOWED_ORIGINS` | (Opcional) Lista adicional de origens permitidas, separadas por vírgula.                 |
| `UPLOAD_MAX_FILE_SIZE_BYTES` | (Opcional) Limite de upload de imagens em bytes (padrão: `5242880`, ou 5 MB).     |
| `UPLOAD_MAX_FILE_SIZE_MB` | (Opcional) Limite de upload em megabytes. Ignorado se o valor em bytes estiver definido. |

## Configurando o banco no Render

1. Crie um novo **PostgreSQL** em *Render → Databases* escolhendo a versão 17.
2. No painel do banco, abra a aba **Connections** e copie o valor de **Internal Database URL** (ex.: `postgres://usuario:senha@dpg-xxxxx.internal:5432/nome`)
   - Use a URL interna para que a comunicação ocorra dentro da rede privada do Render, evitando exposição pública e garantindo TLS automático.
   - Para executar a aplicação localmente (fora do Render) utilize também a **External Database URL** na variável `DATABASE_URL_EXTERNAL`, pois o host interno não é acessível fora da infraestrutura do Render.
3. Crie um novo serviço *Web Service* apontando para este repositório (botão **New → Web Service**).
4. Na tela de criação (ou em **Settings → Environment** após o deploy):
   - Adicione a variável `DATABASE_URL` com a URL interna copiada.
   - Adicione `NODE_ENV=production` para habilitar cookies seguros e SSL no banco.
   - Opcional: ajuste `PGPOOL_MAX` caso queira controlar o número máximo de conexões simultâneas.
5. Clique em **Advanced → Add a Database** e selecione o banco criado (isto apenas preenche automaticamente `DATABASE_URL`; faça manualmente se preferir).
6. Faça o deploy. Na primeira execução a aplicação cria automaticamente as tabelas (`users`, `inventory`, `movimentacoes`) e importa os dados iniciais existentes nos arquivos `data/users.json` e `data/estoque.json` caso o banco esteja vazio.

### Variáveis com os dados fornecidos pelo Render

Para o banco criado com as credenciais abaixo, configure as variáveis no Render exatamente assim utilizando a senha atualmente provisionada pelo serviço:

| Campo Render                                   | Valor                                                                                                       |
|------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Host (Internal)                                | `dpg-d3mkd5juibrs738v4fbg-a`                                                                                |
| Porta                                          | `5432`                                                                                                      |
| Base de dados                                  | `banco_de_dados_acai_da_barra`                                                                              |
| Usuário                                        | `banco_de_dados_acai_da_barra_user`                                                                         |
| `DATABASE_URL`                                 | `postgresql://banco_de_dados_acai_da_barra_user:cd3kfEB8zSUXQddmQm3mN6MNGW5Q6jXA@dpg-d3mkd5juibrs738v4fbg-a/banco_de_dados_acai_da_barra` |
| Comando para testar via Shell do Render (PSQL) | `PGPASSWORD=cd3kfEB8zSUXQddmQm3mN6MNGW5Q6jXA psql -h dpg-d3mkd5juibrs738v4fbg-a.oregon-postgres.render.com -U banco_de_dados_acai_da_barra_user banco_de_dados_acai_da_barra` |

> **Importante:** mantenha a senha fora do repositório. Defina-a apenas como variável de ambiente (`DATABASE_URL`) ou em comandos temporários como o `psql` acima.

> ⚠️ Fora da infraestrutura do Render, o host interno (`dpg-d3mkd5juibrs738v4fbg-a`) não é resolvido e causa o erro `getaddrinfo ENOTFOUND`. Defina também `DATABASE_URL_EXTERNAL` (ou `RENDER_EXTERNAL_DATABASE_URL`) com a URL externa terminada em `.render.com` para que a aplicação consiga se conectar ao banco durante o desenvolvimento local.

> **Dica:** caso precise acessar o banco externamente (por exemplo, a partir do seu computador), utilize a **External Database URL** disponibilizada pelo Render: `postgresql://banco_de_dados_acai_da_barra_user:cd3kfEB8zSUXQddmQm3mN6MNGW5Q6jXA@dpg-d3mkd5juibrs738v4fbg-a.oregon-postgres.render.com/banco_de_dados_acai_da_barra`.

> **Importante:** o Render exige conexão segura; não altere `DATABASE_SSL` em produção. Localmente, caso esteja usando um PostgreSQL sem TLS, defina `DATABASE_SSL=disable`.

### Testando a conexão dentro do Render

Para verificar se o web service está conversando com o banco:

1. Abra o serviço no Render e vá em **Shell**.
2. Execute `printenv DATABASE_URL` para garantir que a variável está definida.
3. Rode `node --eval "import('./server.js')"` para iniciar a aplicação manualmente; a mensagem `Servidor rodando na porta ...` indica que a conexão foi estabelecida.
4. Confira os logs em **Logs**: qualquer erro de credencial ou SSL aparecerá ali.

## Executando localmente

```bash
npm install
# Use um Postgres local...
DATABASE_URL="postgres://usuario:senha@localhost:5432/projeto_estoque" npm run dev

# ...ou defina também a URL externa do Render para que o backend use-a automaticamente fora da infraestrutura deles.
DATABASE_URL="postgres://usuario:senha@dpg-xxxxx.internal:5432/projeto_estoque" \
DATABASE_URL_EXTERNAL="postgres://usuario:senha@dpg-xxxxx.oregon-postgres.render.com/projeto_estoque" \
npm run dev
```

O servidor cria as tabelas automaticamente. O arquivo [`db/schema.sql`](db/schema.sql) contém o esquema completo caso queira aplicar manualmente.

> **Uploads de imagens:** por padrão, o backend limita cada imagem a 5 MB e rejeita origens não autorizadas para CORS. Utilize as variáveis `UPLOAD_MAX_FILE_SIZE_BYTES` ou `UPLOAD_MAX_FILE_SIZE_MB` para ajustar o tamanho máximo e `CORS_ALLOWED_ORIGINS` para liberar novos domínios sem alterar o código.

## Estrutura principal

- `server.js` – API Express, autenticação, integração com PostgreSQL e upload de imagens.
- `index.html`, `javascript.js`, `estilos.css` – interface web existente.
- `data/` – dados de exemplo usados para popular o banco na primeira execução.

## Módulo de fechamento de caixa

- Registro diário consolidando meios de pagamento (`dinheiro_sistema`, cartões do sistema, on-line e PIX), cartões na maquininha, abertura/reforço, gastos e depósito.
- Cálculos automáticos:
  - `total_sistema = dinheiro_sistema + credito_sistema + debito_sistema + pag_online + pix`.
  - `dinheiro_em_gaveta = abertura + reforco + dinheiro_sistema - gastos - valor_para_deposito`.
  - `variavel_caixa = dinheiro_em_gaveta - total_caixa_dinheiro` (pode ser negativo).
- Endpoints protegidos (`admin`) disponíveis tanto em `/api/cashier/closures` quanto em `/api/fechamentos` (alias em PT-BR):
  - `GET ...?de=AAAA-MM-DD&ate=AAAA-MM-DD` – lista por período.
  - `GET .../:id` – detalha um fechamento (inclui cálculo da gaveta).
  - `GET .../:id/logs` – histórico de alterações com responsável, data e diffs.
  - `POST ...` – cria/fecha o dia calculando campos derivados.
  - `PUT .../:id` – atualiza mantendo as validações e registrando log.
- Novo esquema PostgreSQL: tabelas `cashier_closures` (1 registro por data, com índices para data/funcionário) e `cashier_closure_logs` (auditoria das mudanças).
- Campos numéricos aceitam decimais (`NUMERIC(12,2)`), contagens (`INTEGER`) e observações livres.

### Suposições

- Apenas usuários com perfil `admin` têm acesso aos endpoints de fechamento (o sistema atual não possui o papel "gerente").
- O responsável pelo fechamento armazenado é o usuário autenticado no momento da criação; edições mantêm o vínculo original.
- Exportação CSV/Excel poderá ser adicionada futuramente conforme necessidade.

## Scripts

- `npm run dev` – inicia o servidor com `nodemon`.
- `npm start` – inicia o servidor em modo produção.
- `npm run sync:admins` – importa e atualiza no PostgreSQL os administradores definidos em `data/users.json`.
- `npm test` – executa os testes automatizados (usa um banco em memória para validar a importação de administradores).

> **Dica:** ao executar `npm run sync:admins` fora do Render, utilize a *External Database URL* (terminada em `.render.com`) na variável `DATABASE_URL`, pois o host interno não é acessível a partir da sua máquina ou deste ambiente de desenvolvimento.
>
> Quando a URL aponta para um host do Render, o script ativa SSL automaticamente (`rejectUnauthorized: false`). Caso precise forçar ou desativar o comportamento, defina `DATABASE_SSL=require` ou `DATABASE_SSL=disable` respectivamente.

## Licença

MIT

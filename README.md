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
| `DATABASE_SSL`      | Defina como `disable` para desativar SSL (apenas ambientes locais).                         |
| `JWT_SECRET`        | (Opcional) Segredo customizado para assinar os tokens JWT.                                  |
| `PGPOOL_MAX`        | (Opcional) Número máximo de conexões simultâneas no pool (`10` por padrão).                 |
| `NODE_ENV`          | Use `production` em produção para habilitar cookies `secure` e SSL no banco.                |

## Configurando o banco no Render

1. Crie um novo **PostgreSQL** em *Render → Databases* escolhendo a versão 17.
2. Após o provisionamento, copie a variável `DATABASE_URL` fornecida pelo Render.
3. Crie um novo serviço *Web Service* apontando para este repositório.
4. Defina as seguintes variáveis de ambiente no serviço:
   - `DATABASE_URL` com o valor copiado do banco.
   - `NODE_ENV=production` para habilitar cookies seguros.
5. Faça o deploy. Na primeira execução a aplicação cria automaticamente as tabelas (`users`, `inventory`, `movimentacoes`) e importa os dados iniciais existentes nos arquivos `data/users.json` e `data/estoque.json` caso o banco esteja vazio.

> **Importante:** o Render exige conexão segura; não altere `DATABASE_SSL` em produção. Localmente, caso esteja usando um PostgreSQL sem TLS, defina `DATABASE_SSL=disable`.

## Executando localmente

```bash
npm install
DATABASE_URL="postgres://usuario:senha@localhost:5432/projeto_estoque" npm run dev
```

O servidor cria as tabelas automaticamente. O arquivo [`db/schema.sql`](db/schema.sql) contém o esquema completo caso queira aplicar manualmente.

## Estrutura principal

- `server.js` – API Express, autenticação, integração com PostgreSQL e upload de imagens.
- `index.html`, `javascript.js`, `estilos.css` – interface web existente.
- `data/` – dados de exemplo usados para popular o banco na primeira execução.

## Scripts

- `npm run dev` – inicia o servidor com `nodemon`.
- `npm start` – inicia o servidor em modo produção.

## Licença

MIT

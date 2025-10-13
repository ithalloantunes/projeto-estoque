# AçaíStock – Front-end original com back-end PHP/MySQL

Este repositório entrega o painel AçaíStock exatamente como no projeto em JavaScript puro, porém com todas as operações de dados (login, estoque, relatórios e aprovação de usuários) persistidas em um banco MySQL através de uma API PHP.

## Fidelidade visual e comportamental

- **Mesma interface:** os arquivos `index.html` e `estilos.css` são os originais do projeto, garantindo que a identidade visual e a experiência de navegação permaneçam inalteradas.
- **Fluxos idênticos:** o arquivo `javascript.js` mantém os mesmos componentes e interações; a diferença é que agora as ações de criar, editar, excluir ou consultar dados utilizam `fetch()` para conversar com a API PHP em vez de manipular arrays ou `localStorage` diretamente.
- **Sessões e permissões:** autenticação, aprovação de usuários, movimentações e relatórios seguem os mesmos passos que existiam no front-end, mas com persistência real no banco de dados.

## Estrutura do projeto

```
index.html           # Interface original
estilos.css          # Estilos globais
javascript.js        # Lógica do front-end consumindo a API via fetch()
img/                 # Assets existentes (mascote, ícones, etc.)
api/
  config.php         # Conexão com o MySQL + utilitários (CORS, sessões, uploads)
  login.php          # Autenticação
  logout.php         # Encerramento de sessão
  register.php       # Cadastro pendente de aprovação
  session.php        # Validação de sessão ativa
  estoque.php        # CRUD completo de produtos + upload de imagens
  movimentacoes.php  # Histórico e exportação CSV
  relatorios.php     # Resumos por produto e dia
  usuarios.php       # Aprovação, remoção e foto de perfil dos usuários
sql/
  schema.sql         # Script para criação das tabelas necessárias
uploads/             # Criado automaticamente para armazenar imagens
```

## Pré-requisitos

- PHP 8.1 ou superior
- Servidor web com suporte a PHP (Apache, Nginx, 000WebHost, InfinityFree etc.)
- MySQL 5.7+ ou MariaDB 10+

## Configurando o banco de dados

1. Crie um banco de dados MySQL na hospedagem escolhida.
2. Execute o script `sql/schema.sql` via phpMyAdmin ou linha de comando:
   ```sql
   SOURCE /caminho/para/sql/schema.sql;
   ```
3. (Opcional) Insira um usuário administrador inicial. Gere um hash com `password_hash('SenhaForte', PASSWORD_DEFAULT)` e execute:
   ```sql
   INSERT INTO usuarios (username, password_hash, role, approved)
   VALUES ('admin', '$2y$10$hashGeradoAqui', 'admin', 1);
   ```
4. Abra `api/config.php` e substitua `$user`, `$pass`, `$db` e, se necessário, `$host`/`$port` pelos dados do banco.

## Executando localmente

1. Instale o PHP localmente e, na raiz do projeto, execute:
   ```bash
   php -S 127.0.0.1:8000 -t .
   ```
   Esse comando serve o front-end e a API no mesmo domínio (`http://127.0.0.1:8000`).
2. Acesse `http://127.0.0.1:8000/index.html` no navegador.
3. Cadastre um usuário, aguarde aprovação (via banco ou interface de administrador) e utilize o sistema normalmente.

## Implantação

### 1. Back-end (000WebHost, InfinityFree ou semelhante)

1. Faça upload da pasta `api/` para `public_html/api/` (ou diretório equivalente).
2. Verifique se a pasta `uploads/` existe na raiz do projeto; o `config.php` cria as subpastas necessárias automaticamente, mas você pode criá-las manualmente para evitar problemas de permissão.
3. Ajuste `api/config.php` com as credenciais do banco da hospedagem.
4. Importe o arquivo `sql/schema.sql` pelo phpMyAdmin da plataforma.

### 2. Front-end (Render – Static Site ou outro CDN)

1. Publique os arquivos estáticos (`index.html`, `estilos.css`, `javascript.js`, pasta `img/` e demais assets) em um serviço de site estático.
2. Antes do fechamento da tag `</head>` em `index.html`, defina o domínio do back-end através de `window.APP_CONFIG`:
   ```html
   <script>
     window.APP_CONFIG = {
       apiBaseUrl: 'https://seu-backend.000webhostapp.com/api'
     };
   </script>
   ```
   Se o front-end e o back-end estiverem no mesmo domínio, este bloco pode ser omitido.
3. Aplique um rebuild/deploy. O front-end continuará idêntico ao projeto original.

### 3. CORS e sessões

- `api/config.php` já envia cabeçalhos CORS dinâmicos aceitando o domínio que originou a requisição e habilita `Access-Control-Allow-Credentials`.
- Caso deseje restringir manualmente, ajuste o array de origens permitidas no topo do arquivo conforme o domínio publicado.

## Funcionamento da API

| Recurso | Método | Descrição |
| --- | --- | --- |
| `/api/login.php` | POST | Autentica usuário aprovado (armazena sessão PHP) |
| `/api/register.php` | POST | Cria usuário pendente de aprovação |
| `/api/logout.php` | POST | Destroi a sessão atual |
| `/api/session.php` | GET | Retorna dados do usuário autenticado |
| `/api/estoque.php` | GET | Lista produtos cadastrados |
| `/api/estoque.php` | POST | Cria produto (multipart/form-data) |
| `/api/estoque.php` | POST + `_method=PUT` | Atualiza produto (multipart/form-data) |
| `/api/estoque.php` | POST + `_method=DELETE` | Remove produto (exige motivo) |
| `/api/movimentacoes.php` | GET | Lista movimentações (filtros `start`/`end`) |
| `/api/movimentacoes.php?format=csv` | GET | Exporta CSV do histórico |
| `/api/relatorios.php?tipo=summary` | GET | KPIs por produto/dia (aceita `start`/`end`) |
| `/api/relatorios.php?tipo=estoque` | GET | Estoque atual agregado por produto |
| `/api/usuarios.php?status=pending` | GET | Lista usuários pendentes (admin) |
| `/api/usuarios.php` | POST `{ action: 'approve' }` | Aprova usuário (admin) |
| `/api/usuarios.php` | POST `{ action: 'delete' }` | Remove usuário (admin) |
| `/api/usuarios.php?foto=1&id=ID` | GET | Busca foto de perfil |
| `/api/usuarios.php?foto=1&id=ID` | POST + `_method=PUT` | Atualiza foto (multipart/form-data) |

> **Observação:** atualizações e exclusões utilizam `_method` em formulários `FormData` para manter compatibilidade com hospedagens que não aceitam `PUT/DELETE` nativamente.

## Boas práticas implementadas

- **Prepared statements** em todas as operações SQL.
- Senhas armazenadas com `password_hash()` e verificadas com `password_verify()`.
- Uploads de imagens com validação de MIME e armazenamento isolado em `uploads/`.
- Respostas JSON padronizadas (`{ "message": ... }` ou `{ "error": ... }`).
- Sessões PHP com cookies `HttpOnly` e `SameSite` ajustado automaticamente (Lax em desenvolvimento, None+Secure em produção HTTPS).

## Suporte e customização

- Para adicionar novos relatórios ou métricas, utilize as tabelas `movimentacoes` e `produtos` como base.
- Ajuste as cores, imagens e textos diretamente em `estilos.css` e `index.html` sem quebrar a integração com a API.
- Caso hospede em múltiplos domínios, basta atualizar `window.APP_CONFIG.apiBaseUrl` ou adaptar `javascript.js` conforme necessário.

Com isso, o AçaíStock mantém a estética original, porém com persistência real no MySQL e fluxo completo para login, estoque, relatórios e aprovação de usuários. Boas implantações! 🚀

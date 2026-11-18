# AçaíStock — execução local no Windows

## Abrir o sistema

1. Dê dois cliques em **Iniciar-Sistema.cmd** nesta pasta.
2. O iniciador sobe o PostgreSQL e o servidor e mostra o usuário e a senha locais.
3. Acesse **http://localhost:3000**. Mantenha o computador ligado enquanto usar o sistema.

Para encerrar, dê dois cliques em **Parar-Sistema.cmd**. Os dados permanecem salvos.
Fechar a janela do navegador não encerra o servidor. Após reiniciar o computador, execute o iniciador novamente.

Também é possível usar um terminal nesta pasta:

```powershell
npm.cmd run local:start
npm.cmd run local:status
npm.cmd run local:stop
```

## Componentes

| Componente | Configuração |
| --- | --- |
| Aplicação | Node.js + Express; http://localhost:3000 |
| Banco local | PostgreSQL 17; 127.0.0.1:55432; banco acai_local |
| Conta de acesso | admin.local; senha gerada e exibida pelo iniciador |
| Configurações e credenciais locais | .runtime/local-config.json |
| Dados persistentes do banco | .runtime/pgdata |
| Binários do PostgreSQL | .runtime/postgres/pgsql |
| Registros de execução | .runtime/logs |

O iniciador usa somente o banco local e limita o servidor a 127.0.0.1. A configuração original de hospedagem continua disponível para o comando `npm start` quando configurado separadamente.
Os usuários e produtos dos arquivos de exemplo do projeto são importados no banco local pelo próprio sistema. O estoque de exemplo contém datas antigas; isso pode aparecer nos indicadores de validade.

Não apague `.runtime/pgdata` se quiser preservar os cadastros e movimentações locais. A pasta `.runtime` contém dados e credenciais e não deve ser enviada para um repositório.

## Reinstalação em outra máquina

1. Instale o Node.js pelo site oficial: https://nodejs.org/.
2. Nesta pasta, execute `npm.cmd ci` para instalar as versões do arquivo package-lock.json.
3. Baixe os binários oficiais do PostgreSQL 17 para Windows x64 em https://www.enterprisedb.com/download-postgresql-binaries. A página oficial do PostgreSQL encaminha para esse distribuidor: https://www.postgresql.org/download/windows/.
4. Extraia as pastas `pgsql/bin`, `pgsql/lib` e `pgsql/share` para `.runtime/postgres`, mantendo esses nomes e a estrutura.
5. Execute `Iniciar-Sistema.cmd`. O banco e a conta local serão criados automaticamente na primeira execução.

Algumas fontes, ícones, imagens e o Tailwind usados pela interface vêm de serviços externos e dependem de conexão com a internet.

## Verificação e problemas comuns

- `npm.cmd test`: executa os testes automatizados existentes.
- http://localhost:3000/api/health: responde `status: ok` quando o servidor consegue consultar o banco.
- Porta 3000 ocupada: encerre a outra aplicação ou altere `appPort` em `.runtime/local-config.json` com o sistema parado; nesse caso, abra manualmente a nova URL, pois o atalho usa a porta 3000.
- Falha ao iniciar: consulte `.runtime/logs/server-error.log` e `.runtime/logs/postgres.log`.
- Para localizar a senha local, consulte `.runtime/local-config.json` ou execute `npm.cmd run local:start` novamente. A execução não redefine uma senha que você tenha alterado pela interface.

O plano do novo módulo está em `docs/PLANO-MODULO-ESCALAS.md`.

## Publicação em hospedagem

Configure `DATABASE_URL` e `JWT_SECRET` nas variáveis de ambiente do serviço. Use `.env.example` como referência; o servidor não carrega arquivos `.env` automaticamente. As credenciais antigas embutidas no código foram removidas. O iniciador local continua usando a configuração privada em `.runtime/local-config.json`.

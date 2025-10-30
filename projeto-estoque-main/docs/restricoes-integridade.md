# Restrições de Integridade

A seguir são listadas as restrições de integridade implementadas no esquema relacional.

## Tabela `users`
- **NOT NULL**: `username`, `username_lower`, `password_hash`, `role`, `approved`.
- **UNIQUE**: `id` (PK), `username`, `username_lower`.
- **CHECK**:
  - `role` limitado aos valores `'admin'` e `'user'`.
  - `char_length(username) >= 3` para assegurar nomes válidos.
  - `username_lower = lower(username)` para manter consistência entre o nome exibido e a chave de busca.

## Tabela `inventory`
- **NOT NULL**: `id`, `produto`, `quantidade`, `custo`, `created_at`, `updated_at`.
- **CHECK**:
  - `quantidade >= 0` evita quantidades negativas no estoque.
  - `custo >= 0` preserva valores financeiros válidos.
- **DEFAULT**: `created_at` e `updated_at` recebem `NOW()` automaticamente.

## Tabela `movimentacoes`
- **NOT NULL**: `id`, `produto`, `tipo`, `quantidade`, `quantidade_anterior`, `quantidade_atual`, `data`, `usuario`.
- **FOREIGN KEY**: `produto_id` referencia `inventory(id)` com `ON DELETE SET NULL`, mantendo o histórico mesmo após exclusões.
- **CHECK**:
  - `tipo` restrito a `'adicao'`, `'entrada'`, `'saida'`, `'edicao'`, `'exclusao'`.
  - `quantidade` obedece ao sinal esperado para cada tipo de movimentação (positiva para entradas e exclusões, negativa para saídas, zero para edições, não-negativa para adições).
  - `quantidade_anterior >= 0` e `quantidade_atual >= 0`.
  - `char_length(produto) > 0` garante a presença do nome textual no histórico.
- **DEFAULT**: `data` recebe `NOW()` e `usuario` assume `'desconhecido'` quando não informado.

## Índices Auxiliares
- `idx_users_username_lower` acelera autenticação.
- `idx_inventory_produto` facilita buscas por item.
- `idx_movimentacoes_data` otimiza consultas ordenadas por data.

Essas restrições asseguram integridade referencial, consistência semântica e suporte à rastreabilidade exigida pelo sistema.

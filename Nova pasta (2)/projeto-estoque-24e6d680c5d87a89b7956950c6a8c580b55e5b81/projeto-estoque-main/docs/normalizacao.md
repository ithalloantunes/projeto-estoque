# Documento de Normalização

Este documento evidencia a aplicação das formas normais até a 3ª Forma Normal (3FN) para as relações do sistema.

## 1. Relação `users`
- **1FN**: todos os atributos são atômicos; não há grupos repetitivos. A chave primária é `id`.
- **2FN**: não existem chaves primárias compostas, portanto todas as dependências são automaticamente completas.
- **3FN**: as dependências funcionais relevantes são `id → {username, username_lower, password_hash, role, approved, photo}` e `username_lower → {id, username, password_hash, role, approved, photo}`. O atributo derivado `username_lower` depende diretamente da chave candidata `username`, mas foi mantido na mesma relação por representar uma otimização controlada com restrição `username_lower = lower(username)`, evitando anomalias de atualização.

## 2. Relação `inventory`
- **1FN**: atributos com valores atômicos (`produto`, `tipo`, `lote`, etc.).
- **2FN**: chave primária simples (`id`).
- **3FN**: dependências funcionais `id → {produto, tipo, lote, quantidade, validade, custo, image, image_data, created_at, updated_at}`. Não há atributos transitivamente dependentes de `id`. A integridade de `quantidade` e `custo` é reforçada por restrições CHECK.

## 3. Relação `movimentacoes`
- **1FN**: cada registro representa uma única movimentação, com atributos atômicos.
- **2FN**: chave primária simples (`id`).
- **3FN**: dependências `id → {produto_id, produto, tipo, quantidade, quantidade_anterior, quantidade_atual, motivo, data, usuario}`. O atributo `produto` é armazenado junto ao histórico para preservar informação mesmo quando `produto_id` fica nulo após exclusão do item; essa redundância controlada é protegida pela restrição `char_length(produto) > 0` e não introduz dependências transitivas adicionais.

## Considerações Complementares
- A opção por manter `username_lower` e o nome textual do produto em `movimentacoes` atende a requisitos de desempenho e rastreabilidade, respectivamente. Ambos são acompanhados de restrições de integridade que evitam inconsistências.
- O relacionamento entre `inventory` e `movimentacoes` permanece em conformidade com 3FN graças à chave estrangeira `produto_id` e à possibilidade de manter o vínculo nulo quando o item é removido, sem comprometer a normalização.

# Documento de NormalizaÃ§Ã£o

Este documento evidencia a aplicaÃ§Ã£o das formas normais atÃ© a 3Âª Forma Normal (3FN) para as relaÃ§Ãµes do sistema.

## 1. RelaÃ§Ã£o `users`
- **1FN**: todos os atributos sÃ£o atÃ´micos; nÃ£o hÃ¡ grupos repetitivos. A chave primÃ¡ria Ã© `id`.
- **2FN**: nÃ£o existem chaves primÃ¡rias compostas, portanto todas as dependÃªncias sÃ£o automaticamente completas.
- **3FN**: as dependÃªncias funcionais relevantes sÃ£o `id â†’ {username, username_lower, password_hash, role, approved, photo, photo_mime, photo_data}` e `username_lower â†’ {id, username, password_hash, role, approved, photo, photo_mime, photo_data}`. O atributo derivado `username_lower` depende diretamente da chave candidata `username`, mas foi mantido na mesma relaÃ§Ã£o por representar uma otimizaÃ§Ã£o controlada com restriÃ§Ã£o `username_lower = lower(username)`, evitando anomalias de atualizaÃ§Ã£o.

## 2. RelaÃ§Ã£o `inventory`
- **1FN**: atributos com valores atÃ´micos (`produto`, `tipo`, `lote`, etc.).
- **2FN**: chave primÃ¡ria simples (`id`).
- **3FN**: dependências funcionais `id → {produto, tipo, lote, quantidade, validade, custo, image, image_mime, image_data, created_at, updated_at}`. Não há atributos transitivamente dependentes de `id`. A integridade de `quantidade` e `custo` é reforçada por restrições CHECK.

## 3. RelaÃ§Ã£o `movimentacoes`
- **1FN**: cada registro representa uma Ãºnica movimentaÃ§Ã£o, com atributos atÃ´micos.
- **2FN**: chave primÃ¡ria simples (`id`).
- **3FN**: dependÃªncias `id â†’ {produto_id, produto, tipo, quantidade, quantidade_anterior, quantidade_atual, motivo, data, usuario}`. O atributo `produto` Ã© armazenado junto ao histÃ³rico para preservar informaÃ§Ã£o mesmo quando `produto_id` fica nulo apÃ³s exclusÃ£o do item; essa redundÃ¢ncia controlada Ã© protegida pela restriÃ§Ã£o `char_length(produto) > 0` e nÃ£o introduz dependÃªncias transitivas adicionais.

## ConsideraÃ§Ãµes Complementares
- A opÃ§Ã£o por manter `username_lower` e o nome textual do produto em `movimentacoes` atende a requisitos de desempenho e rastreabilidade, respectivamente. Ambos sÃ£o acompanhados de restriÃ§Ãµes de integridade que evitam inconsistÃªncias.
- O relacionamento entre `inventory` e `movimentacoes` permanece em conformidade com 3FN graÃ§as Ã  chave estrangeira `produto_id` e Ã  possibilidade de manter o vÃ­nculo nulo quando o item Ã© removido, sem comprometer a normalizaÃ§Ã£o.

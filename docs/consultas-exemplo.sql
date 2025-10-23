-- Consultas de exemplo para o sistema de estoque

-- 1. Listar todos os produtos com estoque atual e custo unitário
SELECT id, produto, quantidade, custo
  FROM inventory
 ORDER BY produto;

-- 2. Mostrar movimentações de um produto específico por intervalo de datas
SELECT m.data,
       m.tipo,
       m.quantidade,
       m.quantidade_anterior,
       m.quantidade_atual,
       m.usuario
  FROM movimentacoes AS m
 WHERE (m.produto_id = $1 OR m.produto = $2)
   AND m.data BETWEEN $3 AND $4
 ORDER BY m.data DESC;

-- 3. Resumo diário de entradas e saídas
SELECT date_trunc('day', data) AS dia,
       SUM(CASE WHEN tipo IN ('adicao', 'entrada') THEN quantidade ELSE 0 END) AS total_entradas,
       SUM(CASE WHEN tipo IN ('saida', 'exclusao') THEN ABS(quantidade) ELSE 0 END) AS total_saidas
  FROM movimentacoes
 GROUP BY dia
 ORDER BY dia DESC;

-- 4. Produtos abaixo do nível mínimo configurado dinamicamente
SELECT i.id,
       i.produto,
       i.quantidade
  FROM inventory AS i
 WHERE i.quantidade < $1
 ORDER BY i.quantidade ASC;

-- 5. Valor financeiro total do estoque
SELECT SUM(quantidade * custo) AS valor_total
  FROM inventory;

-- 6. Usuários com maior número de movimentações registradas
SELECT usuario,
       COUNT(*) AS total_movimentacoes
  FROM movimentacoes
 GROUP BY usuario
 ORDER BY total_movimentacoes DESC
 LIMIT 5;

<?php
require __DIR__ . '/config.php';

$method = get_request_method();
ensure_authenticated_user();

if ($method !== 'GET') {
    respond_error('Método não suportado.', 405);
}

$tipo = strtolower(sanitize_text($_GET['tipo'] ?? ''));
$startRaw = sanitize_text($_GET['start'] ?? '');
$endRaw = sanitize_text($_GET['end'] ?? '');

$conditions = [];
$params = [];
$types = '';

if ($startRaw !== '') {
    $startDate = DateTime::createFromFormat('Y-m-d', $startRaw);
    if ($startDate === false) {
        respond_error('Data inicial inválida.', 400);
    }
    $conditions[] = 'data_registro >= ?';
    $types .= 's';
    $params[] = $startDate->format('Y-m-d 00:00:00');
}

if ($endRaw !== '') {
    $endDate = DateTime::createFromFormat('Y-m-d', $endRaw);
    if ($endDate === false) {
        respond_error('Data final inválida.', 400);
    }
    $conditions[] = 'data_registro <= ?';
    $types .= 's';
    $params[] = $endDate->format('Y-m-d 23:59:59');
}

$whereClause = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';

if ($tipo === 'summary') {
    $stmt = $conn->prepare("SELECT produto, SUM(CASE WHEN tipo IN ('adicao','entrada') THEN ABS(quantidade) ELSE 0 END) AS entradas, SUM(CASE WHEN tipo IN ('saida','exclusao') THEN ABS(quantidade) ELSE 0 END) AS saidas FROM movimentacoes{$whereClause} GROUP BY produto");
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $porProduto = [];
    while ($row = $result->fetch_assoc()) {
        $produto = $row['produto'] ?: 'Desconhecido';
        $porProduto[$produto] = [
            'entradas' => (int) $row['entradas'],
            'saidas' => (int) $row['saidas'],
        ];
    }
    $stmt->close();

    $stmt = $conn->prepare("SELECT DATE(data_registro) AS dia, SUM(ABS(quantidade)) AS total FROM movimentacoes{$whereClause} GROUP BY dia ORDER BY dia ASC");
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $porDia = [];
    while ($row = $result->fetch_assoc()) {
        $porDia[$row['dia']] = (int) $row['total'];
    }
    $stmt->close();

    respond_json([
        'porProduto' => $porProduto,
        'porDia' => $porDia,
    ]);
}

if ($tipo === 'estoque') {
    $result = $conn->query('SELECT produto, SUM(quantidade) AS total FROM produtos GROUP BY produto ORDER BY produto ASC');
    $resumo = [];
    while ($row = $result->fetch_assoc()) {
        $resumo[$row['produto'] ?: 'Desconhecido'] = (int) $row['total'];
    }
    respond_json($resumo);
}

respond_error('Tipo de relatório inválido.', 400);

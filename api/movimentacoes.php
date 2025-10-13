<?php
require __DIR__ . '/config.php';

$method = get_request_method();
ensure_authenticated_user();

if ($method !== 'GET') {
    respond_error('Método não suportado.', 405);
}

$format = strtolower(sanitize_text($_GET['format'] ?? ''));
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

$query = 'SELECT id, produto_id, produto, tipo, quantidade, quantidade_anterior, quantidade_atual, motivo, data_registro, usuario FROM movimentacoes';
if ($conditions) {
    $query .= ' WHERE ' . implode(' AND ', $conditions);
}
$query .= ' ORDER BY data_registro DESC';

$stmt = $conn->prepare($query);
if ($types !== '') {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

if ($format === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="movimentacoes.csv"');
    $output = fopen('php://output', 'w');
    fputcsv($output, ['id', 'produtoId', 'produto', 'tipo', 'quantidade', 'quantidadeAnterior', 'quantidadeAtual', 'motivo', 'data', 'usuario']);
    while ($row = $result->fetch_assoc()) {
        fputcsv($output, [
            $row['id'],
            $row['produto_id'],
            $row['produto'],
            $row['tipo'],
            $row['quantidade'],
            $row['quantidade_anterior'],
            $row['quantidade_atual'],
            $row['motivo'],
            $row['data_registro'],
            $row['usuario'],
        ]);
    }
    fclose($output);
    $stmt->close();
    exit;
}

$movimentos = [];
while ($row = $result->fetch_assoc()) {
    $movimentos[] = [
        'id' => $row['id'],
        'produtoId' => $row['produto_id'],
        'produto' => $row['produto'],
        'tipo' => $row['tipo'],
        'quantidade' => (int) $row['quantidade'],
        'quantidadeAnterior' => $row['quantidade_anterior'] !== null ? (int) $row['quantidade_anterior'] : null,
        'quantidadeAtual' => $row['quantidade_atual'] !== null ? (int) $row['quantidade_atual'] : null,
        'motivo' => $row['motivo'],
        'data' => $row['data_registro'],
        'usuario' => $row['usuario'],
    ];
}

$stmt->close();

respond_json($movimentos);

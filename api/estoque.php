<?php
require __DIR__ . '/config.php';

$method = get_request_method();
$currentUser = ensure_authenticated_user();

if ($method === 'GET') {
    $result = $conn->query('SELECT id, produto, tipo, lote, quantidade, validade, custo, image_path, data_cadastro, data_atualizacao FROM produtos ORDER BY produto ASC');
    $produtos = [];
    while ($row = $result->fetch_assoc()) {
        $produtos[] = [
            'id' => (int) $row['id'],
            'produto' => $row['produto'],
            'tipo' => $row['tipo'],
            'lote' => $row['lote'],
            'quantidade' => (int) $row['quantidade'],
            'validade' => $row['validade'],
            'custo' => (float) $row['custo'],
            'image' => public_upload_path($row['image_path'] ?? null),
            'dataCadastro' => $row['data_cadastro'],
            'dataAtualizacao' => $row['data_atualizacao'],
        ];
    }
    respond_json($produtos);
}

if ($method === 'POST') {
    $produto = sanitize_text($_POST['produto'] ?? '');
    $tipo = sanitize_text($_POST['tipo'] ?? '');
    $lote = sanitize_text($_POST['lote'] ?? '');
    $quantidade = max(0, parse_int($_POST['quantidade'] ?? 0, 0));
    $quantidade = (int) $quantidade;
    $validadeRaw = sanitize_text($_POST['validade'] ?? '');
    $custo = normalize_decimal($_POST['custo'] ?? null);

    if ($produto === '' || $tipo === '' || $lote === '') {
        respond_error('Informe produto, tipo e lote.', 400);
    }
    if ($custo === null) {
        respond_error('Informe um custo válido.', 400);
    }

    $validade = null;
    if ($validadeRaw !== '') {
        $date = DateTime::createFromFormat('Y-m-d', $validadeRaw);
        if ($date === false) {
            respond_error('Data de validade inválida.', 400);
        }
        $validade = $date->format('Y-m-d');
    }

    $imagePath = save_uploaded_file('image', PRODUCT_UPLOADS_DIR);

    $stmt = $conn->prepare('INSERT INTO produtos (produto, tipo, lote, quantidade, validade, custo, image_path, data_cadastro, data_atualizacao) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
    $stmt->bind_param('sssisds', $produto, $tipo, $lote, $quantidade, $validade, $custo, $imagePath);
    $stmt->execute();
    $productId = $stmt->insert_id;
    $stmt->close();

    log_movimentacao([
        'produto_id' => $productId,
        'produto' => $produto,
        'tipo' => 'adicao',
        'quantidade' => $quantidade,
        'quantidade_anterior' => 0,
        'quantidade_atual' => $quantidade,
        'usuario' => $currentUser['username'] ?? 'usuário',
    ]);

    respond_json([
        'message' => 'Produto criado com sucesso.',
        'id' => $productId,
        'image' => public_upload_path($imagePath),
    ], 201);
}

if ($method === 'PUT') {
    $productId = parse_int($_POST['id'] ?? $_GET['id'] ?? null);
    if (!$productId) {
        respond_error('ID do produto é obrigatório.', 400);
    }

    $stmt = $conn->prepare('SELECT id, produto, tipo, lote, quantidade, validade, custo, image_path FROM produtos WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $produtoAtual = $result->fetch_assoc();
    $stmt->close();

    if (!$produtoAtual) {
        respond_error('Produto não encontrado.', 404);
    }

    $novoProduto = sanitize_text($_POST['produto'] ?? $produtoAtual['produto']);
    $novoTipo = sanitize_text($_POST['tipo'] ?? $produtoAtual['tipo']);
    $novoLote = sanitize_text($_POST['lote'] ?? $produtoAtual['lote']);
    $novaQuantidade = parse_int($_POST['quantidade'] ?? $produtoAtual['quantidade'], (int) $produtoAtual['quantidade']);
    if ($novaQuantidade === null || $novaQuantidade < 0) {
        $novaQuantidade = (int) $produtoAtual['quantidade'];
    }
    $novaQuantidade = (int) $novaQuantidade;

    if ($novoProduto === '' || $novoTipo === '' || $novoLote === '') {
        respond_error('Informe produto, tipo e lote.', 400);
    }

    $validadeRaw = array_key_exists('validade', $_POST) ? sanitize_text($_POST['validade']) : $produtoAtual['validade'];
    $novaValidade = $produtoAtual['validade'];
    if ($validadeRaw !== '') {
        $date = DateTime::createFromFormat('Y-m-d', $validadeRaw);
        if ($date === false) {
            respond_error('Data de validade inválida.', 400);
        }
        $novaValidade = $date->format('Y-m-d');
    } elseif (array_key_exists('validade', $_POST) && $validadeRaw === '') {
        $novaValidade = null;
    }

    $custoInput = $_POST['custo'] ?? $produtoAtual['custo'];
    $novoCusto = normalize_decimal($custoInput);
    if ($custoInput !== null && $novoCusto === null) {
        respond_error('Informe um custo válido.', 400);
    }
    if ($novoCusto === null) {
        $novoCusto = (float) $produtoAtual['custo'];
    }

    $removeImage = isset($_POST['removeImage']) && $_POST['removeImage'] === 'true';
    $novoUpload = save_uploaded_file('image', PRODUCT_UPLOADS_DIR);
    $imagemAtual = $produtoAtual['image_path'];

    if ($removeImage) {
        delete_uploaded_file($imagemAtual);
        $imagemAtual = null;
    }

    if ($novoUpload) {
        delete_uploaded_file($imagemAtual);
        $imagemAtual = $novoUpload;
    }

    $stmt = $conn->prepare('UPDATE produtos SET produto = ?, tipo = ?, lote = ?, quantidade = ?, validade = ?, custo = ?, image_path = ?, data_atualizacao = NOW() WHERE id = ?');
    $stmt->bind_param('sssisdsi', $novoProduto, $novoTipo, $novoLote, $novaQuantidade, $novaValidade, $novoCusto, $imagemAtual, $productId);
    $stmt->execute();
    $stmt->close();

    $quantidadeAnterior = (int) $produtoAtual['quantidade'];
    $diferenca = $novaQuantidade - $quantidadeAnterior;
    $tipoMovimento = 'edicao';
    if ($diferenca > 0) {
        $tipoMovimento = 'entrada';
    } elseif ($diferenca < 0) {
        $tipoMovimento = 'saida';
    }

    log_movimentacao([
        'produto_id' => $productId,
        'produto' => $novoProduto,
        'tipo' => $tipoMovimento,
        'quantidade' => $diferenca,
        'quantidade_anterior' => $quantidadeAnterior,
        'quantidade_atual' => $novaQuantidade,
        'usuario' => $currentUser['username'] ?? 'usuário',
    ]);

    respond_json([
        'message' => 'Produto atualizado com sucesso.',
        'image' => public_upload_path($imagemAtual),
    ]);
}

if ($method === 'DELETE') {
    $productId = parse_int($_POST['id'] ?? $_GET['id'] ?? null);
    $motivo = sanitize_text($_POST['motivo'] ?? '');
    if (!$productId) {
        respond_error('ID do produto é obrigatório.', 400);
    }
    if ($motivo === '') {
        respond_error('Informe o motivo da exclusão.', 400);
    }

    $stmt = $conn->prepare('SELECT id, produto, quantidade, image_path FROM produtos WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $produtoAtual = $result->fetch_assoc();
    $stmt->close();

    if (!$produtoAtual) {
        respond_error('Produto não encontrado.', 404);
    }

    $stmt = $conn->prepare('DELETE FROM produtos WHERE id = ?');
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $stmt->close();

    if (!empty($produtoAtual['image_path'])) {
        delete_uploaded_file($produtoAtual['image_path']);
    }

    $quantidadeRemovida = (int) $produtoAtual['quantidade'];

    log_movimentacao([
        'produto_id' => $productId,
        'produto' => $produtoAtual['produto'],
        'tipo' => 'exclusao',
        'quantidade' => $quantidadeRemovida,
        'quantidade_anterior' => $quantidadeRemovida,
        'quantidade_atual' => 0,
        'motivo' => $motivo,
        'usuario' => $currentUser['username'] ?? 'usuário',
    ]);

    respond_json(['message' => 'Produto removido com sucesso.']);
}

respond_error('Método não suportado.', 405);

<?php
require __DIR__ . '/config.php';

$method = get_request_method();
$currentUser = ensure_authenticated_user();

if (isset($_GET['foto'])) {
    $userId = parse_int($_GET['id'] ?? null);
    if (!$userId) {
        respond_error('ID do usuário é obrigatório.', 400);
    }
    if ($currentUser['id'] !== $userId && ($currentUser['role'] ?? 'user') !== 'admin') {
        respond_error('Acesso não autorizado.', 403);
    }

    if ($method === 'GET') {
        $target = fetch_user_by_id($userId);
        if (!$target) {
            respond_error('Usuário não encontrado.', 404);
        }
        respond_json(['photo' => public_upload_path($target['photo_path'] ?? null)]);
    }

    if ($method === 'PUT') {
        $photoPath = save_uploaded_file('photo', USER_UPLOADS_DIR);
        if (!$photoPath) {
            respond_error('Nenhuma imagem enviada.', 400);
        }
        $existing = fetch_user_by_id($userId);
        if (!$existing) {
            delete_uploaded_file($photoPath);
            respond_error('Usuário não encontrado.', 404);
        }
        $stmt = $conn->prepare('UPDATE usuarios SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $stmt->bind_param('si', $photoPath, $userId);
        $stmt->execute();
        $stmt->close();
        if (!empty($existing['photo_path'])) {
            delete_uploaded_file($existing['photo_path']);
        }
        respond_json([
            'message' => 'Foto atualizada com sucesso.',
            'photo' => public_upload_path($photoPath),
        ]);
    }

    if ($method === 'DELETE') {
        $existing = fetch_user_by_id($userId);
        if (!$existing) {
            respond_error('Usuário não encontrado.', 404);
        }
        if (!empty($existing['photo_path'])) {
            delete_uploaded_file($existing['photo_path']);
        }
        $null = null;
        $stmt = $conn->prepare('UPDATE usuarios SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $stmt->bind_param('si', $null, $userId);
        $stmt->execute();
        $stmt->close();
        respond_json(['message' => 'Foto removida com sucesso.', 'photo' => null]);
    }

    respond_error('Método não suportado.', 405);
}

if ($method === 'GET') {
    require_admin($currentUser);
    $status = strtolower(sanitize_text($_GET['status'] ?? 'active'));
    $query = 'SELECT id, username, role, approved, photo_path FROM usuarios';
    $params = [];
    $types = '';

    if ($status === 'pending') {
        $query .= ' WHERE approved = 0';
    } elseif ($status === 'active') {
        $query .= ' WHERE approved = 1';
    }

    $query .= ' ORDER BY username ASC';

    $stmt = $conn->prepare($query);
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => (int) $row['id'],
            'username' => $row['username'],
            'role' => $row['role'],
            'approved' => (bool) $row['approved'],
            'photo' => public_upload_path($row['photo_path'] ?? null),
        ];
    }
    $stmt->close();

    respond_json($users);
}

if ($method === 'POST') {
    require_admin($currentUser);
    $payload = read_json_input();
    $action = strtolower(sanitize_text($payload['action'] ?? ''));
    $targetId = parse_int($payload['id'] ?? null);
    if (!$targetId) {
        respond_error('ID do usuário é obrigatório.', 400);
    }

    if ($action === 'approve') {
        $stmt = $conn->prepare('UPDATE usuarios SET approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $stmt->bind_param('i', $targetId);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        if ($affected === 0) {
            respond_error('Usuário não encontrado.', 404);
        }
        respond_json(['message' => 'Usuário aprovado com sucesso.']);
    }

    if ($action === 'delete') {
        $existing = fetch_user_by_id($targetId);
        if (!$existing) {
            respond_error('Usuário não encontrado.', 404);
        }
        $stmt = $conn->prepare('DELETE FROM usuarios WHERE id = ?');
        $stmt->bind_param('i', $targetId);
        $stmt->execute();
        $stmt->close();
        if (!empty($existing['photo_path'])) {
            delete_uploaded_file($existing['photo_path']);
        }
        respond_json(['message' => 'Usuário removido com sucesso.']);
    }

    respond_error('Ação inválida.', 400);
}

respond_error('Método não suportado.', 405);

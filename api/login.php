<?php
require __DIR__ . '/config.php';

if (get_request_method() !== 'POST') {
    respond_error('Método não suportado.', 405);
}

$data = read_json_input();
$username = sanitize_text($data['username'] ?? '');
$password = $data['password'] ?? '';

if ($username === '' || $password === '') {
    respond_error('Usuário e senha são obrigatórios.', 400);
}

$stmt = $conn->prepare('SELECT id, username, password_hash, role, approved, photo_path FROM usuarios WHERE username = ? LIMIT 1');
$stmt->bind_param('s', $username);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();

if (!$user || !password_verify((string) $password, $user['password_hash'])) {
    respond_error('Credenciais inválidas.', 401);
}

if (!(int) $user['approved']) {
    respond_error('Usuário pendente de aprovação.', 403);
}

$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['role'] = $user['role'];

respond_json([
    'message' => 'Login realizado com sucesso.',
    'userId' => (int) $user['id'],
    'username' => $user['username'],
    'role' => $user['role'],
    'photo' => public_upload_path($user['photo_path'] ?? null),
]);

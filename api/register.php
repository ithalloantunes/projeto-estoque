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

if (mb_strlen($username) < 3) {
    respond_error('O usuário deve ter pelo menos 3 caracteres.', 400);
}

if (!is_string($password) || strlen($password) < 8) {
    respond_error('A senha deve ter pelo menos 8 caracteres.', 400);
}

$stmt = $conn->prepare('SELECT id FROM usuarios WHERE username = ? LIMIT 1');
$stmt->bind_param('s', $username);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    $stmt->close();
    respond_error('Usuário já cadastrado.', 409);
}
$stmt->close();

$hash = password_hash($password, PASSWORD_DEFAULT);
$role = 'user';
$approved = 0;

$stmt = $conn->prepare('INSERT INTO usuarios (username, password_hash, role, approved) VALUES (?, ?, ?, ?)');
$stmt->bind_param('sssi', $username, $hash, $role, $approved);
$stmt->execute();
$stmt->close();

respond_json(['message' => 'Cadastro enviado para aprovação.'], 201);

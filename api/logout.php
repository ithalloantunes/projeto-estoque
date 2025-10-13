<?php
require __DIR__ . '/config.php';

if (get_request_method() !== 'POST') {
    respond_error('Método não suportado.', 405);
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}
session_destroy();

respond_json(['message' => 'Sessão encerrada.']);

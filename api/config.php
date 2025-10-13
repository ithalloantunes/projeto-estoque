<?php
declare(strict_types=1);

$origin = $_SERVER['HTTP_ORIGIN'] ?? null;
if ($origin) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
$cookieParams = [
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => $https,
    'httponly' => true,
    'samesite' => $https ? 'None' : 'Lax',
];
if (PHP_VERSION_ID >= 70300) {
    session_set_cookie_params($cookieParams);
} else {
    session_set_cookie_params(
        $cookieParams['lifetime'],
        $cookieParams['path'],
        $cookieParams['domain'],
        $cookieParams['secure'],
        $cookieParams['httponly']
    );
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

define('PROJECT_ROOT', dirname(__DIR__));
define('UPLOADS_DIR', PROJECT_ROOT . '/uploads');
define('PRODUCT_UPLOADS_DIR', UPLOADS_DIR . '/products');
define('USER_UPLOADS_DIR', UPLOADS_DIR . '/users');

foreach ([UPLOADS_DIR, PRODUCT_UPLOADS_DIR, USER_UPLOADS_DIR] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function respond_json(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respond_error(string $message, int $status = 400): void
{
    respond_json(['error' => $message], $status);
}

function read_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond_error('JSON inválido.', 400);
    }
    return is_array($decoded) ? $decoded : [];
}

function sanitize_text(?string $value): string
{
    return trim((string) $value);
}

function normalize_decimal($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_numeric($value)) {
        return round((float) $value, 2);
    }
    if (!is_string($value)) {
        return null;
    }
    $clean = preg_replace('/[^0-9,\.\-]/', '', $value);
    if ($clean === '') {
        return null;
    }
    $hasComma = strpos($clean, ',') !== false;
    $hasDot = strpos($clean, '.') !== false;
    if ($hasComma && $hasDot) {
        $clean = str_replace('.', '', $clean);
        $clean = str_replace(',', '.', $clean);
    } elseif ($hasComma) {
        $clean = str_replace(',', '.', $clean);
    }
    if (!is_numeric($clean)) {
        return null;
    }
    return round((float) $clean, 2);
}

function parse_int($value, ?int $default = null): ?int
{
    if ($value === null || $value === '') {
        return $default;
    }
    if (is_int($value)) {
        return $value;
    }
    if (is_numeric($value)) {
        return (int) $value;
    }
    if (is_string($value)) {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return $default;
        }
        if (ctype_digit($trimmed) || preg_match('/^-?\d+$/', $trimmed)) {
            return (int) $trimmed;
        }
    }
    return $default;
}

function get_request_method(): string
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $override = $_POST['_method'] ?? $_GET['_method'] ?? null;
    if ($method === 'POST' && $override) {
        $method = strtoupper((string) $override);
    }
    return $method;
}

function require_authentication(): array
{
    if (!isset($_SESSION['user_id'])) {
        respond_error('Não autenticado.', 401);
    }
    return [
        'id' => (int) $_SESSION['user_id'],
        'username' => $_SESSION['username'] ?? null,
        'role' => $_SESSION['role'] ?? 'user',
    ];
}

function require_admin(?array $user = null): array
{
    $current = $user ?? require_authentication();
    if (($current['role'] ?? 'user') !== 'admin') {
        respond_error('Acesso não autorizado.', 403);
    }
    return $current;
}

function generate_uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    $hex = bin2hex($data);
    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

function relative_upload_path(string $absolutePath): string
{
    $root = realpath(PROJECT_ROOT) ?: PROJECT_ROOT;
    $absolute = realpath($absolutePath) ?: $absolutePath;
    $relative = str_replace(['\\', $root], ['/', ''], $absolute);
    return ltrim($relative, '/');
}

function public_upload_path(?string $relativePath): ?string
{
    if (!$relativePath) {
        return null;
    }
    $normalized = str_replace('\\', '/', $relativePath);
    return '/' . ltrim($normalized, '/');
}

function delete_uploaded_file(?string $relativePath): void
{
    if (!$relativePath) {
        return;
    }
    $normalized = ltrim(str_replace(['..', '\\'], ['', '/'], $relativePath), '/');
    $absolute = PROJECT_ROOT . '/' . $normalized;
    if (is_file($absolute)) {
        @unlink($absolute);
    }
}

function save_uploaded_file(string $field, string $destinationDir): ?string
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        return null;
    }
    $file = $_FILES[$field];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        respond_error('Falha no upload do arquivo.', 400);
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if (strpos((string) $mime, 'image/') !== 0) {
        respond_error('Envie apenas arquivos de imagem.', 400);
    }
    $extension = '.png';
    if ($mime === 'image/jpeg') {
        $extension = '.jpg';
    } elseif ($mime === 'image/png') {
        $extension = '.png';
    } elseif ($mime === 'image/gif') {
        $extension = '.gif';
    }
    $filename = bin2hex(random_bytes(16)) . $extension;
    $destination = rtrim($destinationDir, '/');
    if (!is_dir($destination)) {
        mkdir($destination, 0775, true);
    }
    $targetPath = $destination . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        respond_error('Não foi possível salvar o arquivo enviado.', 500);
    }
    return relative_upload_path($targetPath);
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $host = 'sql10.freesqldatabase.com';
    $user = 'usuario';
    $pass = 'senha';
    $db   = 'dbname';
    $port = 3306;

    $conn = new mysqli($host, $user, $pass, $db, $port);
    $conn->set_charset('utf8mb4');
} catch (mysqli_sql_exception $exception) {
    respond_error('Falha na conexão: ' . $exception->getMessage(), 500);
}

function fetch_user_by_id(int $id): ?array
{
    global $conn;
    $stmt = $conn->prepare('SELECT id, username, role, approved, photo_path FROM usuarios WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    return $user ?: null;
}

function ensure_authenticated_user(): array
{
    $session = require_authentication();
    $user = fetch_user_by_id($session['id']);
    if (!$user || !(int) $user['approved']) {
        session_unset();
        session_destroy();
        respond_error('Sessão inválida. Faça login novamente.', 401);
    }
    $_SESSION['role'] = $user['role'];
    $_SESSION['username'] = $user['username'];
    return [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'approved' => (bool) $user['approved'],
        'photo_path' => $user['photo_path'] ?? null,
    ];
}

function log_movimentacao(array $payload): void
{
    global $conn;
    $stmt = $conn->prepare('INSERT INTO movimentacoes (id, produto_id, produto, tipo, quantidade, quantidade_anterior, quantidade_atual, motivo, data_registro, usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $id = $payload['id'] ?? generate_uuid_v4();
    $produtoId = $payload['produto_id'] ?? null;
    $produto = $payload['produto'] ?? '';
    $tipo = $payload['tipo'] ?? '';
    $quantidade = $payload['quantidade'] ?? 0;
    $quantidadeAnterior = $payload['quantidade_anterior'] ?? null;
    $quantidadeAtual = $payload['quantidade_atual'] ?? null;
    $motivo = $payload['motivo'] ?? null;
    $dataRegistro = $payload['data'] ?? date('Y-m-d H:i:s');
    $usuario = $payload['usuario'] ?? null;

    $produtoIdParam = $produtoId !== null ? (int) $produtoId : null;
    $quantidadeParam = (int) $quantidade;
    $quantidadeAnteriorParam = $quantidadeAnterior !== null ? (int) $quantidadeAnterior : null;
    $quantidadeAtualParam = $quantidadeAtual !== null ? (int) $quantidadeAtual : null;

    $stmt->bind_param(
        'sissiiisss',
        $id,
        $produtoIdParam,
        $produto,
        $tipo,
        $quantidadeParam,
        $quantidadeAnteriorParam,
        $quantidadeAtualParam,
        $motivo,
        $dataRegistro,
        $usuario
    );
    $stmt->execute();
    $stmt->close();
}

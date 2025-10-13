<?php
require __DIR__ . '/config.php';

$user = ensure_authenticated_user();

respond_json([
    'userId' => $user['id'],
    'username' => $user['username'],
    'role' => $user['role'],
    'photo' => public_upload_path($user['photo_path'] ?? null),
]);

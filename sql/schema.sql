CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    approved TINYINT(1) NOT NULL DEFAULT 0,
    photo_path VARCHAR(255) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto VARCHAR(150) NOT NULL,
    tipo VARCHAR(60) NOT NULL,
    lote VARCHAR(60) NOT NULL,
    quantidade INT NOT NULL DEFAULT 0,
    validade DATE DEFAULT NULL,
    custo DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    image_path VARCHAR(255) DEFAULT NULL,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_produtos_nome (produto)
);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id CHAR(36) PRIMARY KEY,
    produto_id INT DEFAULT NULL,
    produto VARCHAR(150) NOT NULL,
    tipo ENUM('adicao', 'entrada', 'saida', 'exclusao', 'edicao') NOT NULL,
    quantidade INT NOT NULL,
    quantidade_anterior INT DEFAULT NULL,
    quantidade_atual INT DEFAULT NULL,
    motivo TEXT DEFAULT NULL,
    data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(100) DEFAULT NULL,
    CONSTRAINT fk_movimentacoes_produto FOREIGN KEY (produto_id) REFERENCES produtos (id) ON DELETE SET NULL
);

-- Opcional: criar um usuário administrador padrão.
-- Substitua o hash abaixo por um gerado com password_hash('SuaSenhaForte', PASSWORD_DEFAULT).
-- INSERT INTO usuarios (username, password_hash, role, approved)
-- VALUES ('admin', '$2y$10$exampleReplaceWithRealHashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'admin', 1);

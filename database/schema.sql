-- =============================================================
--  SISTEMA DE AVISTAMIENTO DE OVNIs
--  Base de datos: MySQL 8.x en AWS RDS
-- =============================================================

CREATE DATABASE IF NOT EXISTS ovnis_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ovnis_db;

CREATE TABLE IF NOT EXISTS avistamientos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    fecha           VARCHAR(10)  NOT NULL COMMENT 'Formato YYYY-MM-DD',
    hora            VARCHAR(8)   NOT NULL COMMENT 'Formato HH:MM',
    ubicacion       VARCHAR(200) NOT NULL,
    cantidad        INT          NOT NULL CHECK (cantidad > 0),
    forma           VARCHAR(100) DEFAULT 'No identificada',
    observaciones   TEXT,
    registrado_por  VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

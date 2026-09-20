-- ============================================
-- SLA Monitoring Dashboard
-- Authentication Tables
-- ============================================

CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    email TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role TEXT NOT NULL DEFAULT 'admin'
        CHECK (role IN ('admin', 'viewer')),

    enabled INTEGER NOT NULL DEFAULT 1
        CHECK (enabled IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    admin_id INTEGER NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
);


CREATE INDEX idx_admins_email
ON admins(email);


CREATE INDEX idx_admins_enabled
ON admins(enabled);


CREATE INDEX idx_sessions_admin
ON sessions(admin_id);


CREATE INDEX idx_sessions_expires
ON sessions(expires_at);


CREATE INDEX idx_sessions_token_hash
ON sessions(token_hash);
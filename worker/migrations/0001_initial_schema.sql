-- ============================================
-- SLA Monitoring Dashboard
-- Initial Database Schema
-- ============================================

-- ============================================
-- SERVICES
-- ============================================

CREATE TABLE services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,
    url TEXT NOT NULL,

    description TEXT,

    status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (status IN ('up', 'down', 'degraded', 'unknown')),

    enabled INTEGER NOT NULL DEFAULT 1
        CHECK (enabled IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- SLA RULES
-- ============================================

CREATE TABLE sla_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    service_id INTEGER NOT NULL,

    target_percentage REAL NOT NULL DEFAULT 99.9,

    response_time_limit_ms INTEGER NOT NULL DEFAULT 2000,

    evaluation_period_days INTEGER NOT NULL DEFAULT 30,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE CASCADE
);


-- ============================================
-- SLA CHECKS
-- ============================================

CREATE TABLE sla_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    service_id INTEGER NOT NULL,

    status TEXT NOT NULL
        CHECK (status IN ('success', 'failure', 'timeout')),

    response_time_ms INTEGER,

    status_code INTEGER,

    error_message TEXT,

    checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE CASCADE
);


-- ============================================
-- INCIDENTS
-- ============================================

CREATE TABLE incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    service_id INTEGER NOT NULL,

    title TEXT NOT NULL,

    description TEXT,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved')),

    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    resolved_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE CASCADE
);


-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    service_id INTEGER,

    incident_id INTEGER,

    type TEXT NOT NULL
        CHECK (type IN ('email', 'webhook', 'dashboard')),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed')),

    message TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    sent_at TEXT,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE SET NULL,

    FOREIGN KEY (incident_id)
        REFERENCES incidents(id)
        ON DELETE SET NULL
);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_services_status
ON services(status);


CREATE INDEX idx_sla_checks_service
ON sla_checks(service_id);


CREATE INDEX idx_sla_checks_checked_at
ON sla_checks(checked_at);


CREATE INDEX idx_incidents_service
ON incidents(service_id);


CREATE INDEX idx_incidents_status
ON incidents(status);


CREATE INDEX idx_notifications_service
ON notifications(service_id);


CREATE INDEX idx_notifications_status
ON notifications(status);
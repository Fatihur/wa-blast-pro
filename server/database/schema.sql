-- WA Blast Pro Database Schema

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS wa_blast_pro;
USE wa_blast_pro;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    remember_token VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_resets (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_id (user_id)
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    tags JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_phone (user_id, phone),
    INDEX idx_user_id (user_id),
    INDEX idx_phone (phone),
    INDEX idx_name (name)
);

-- Groups table
CREATE TABLE IF NOT EXISTS `groups` (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_name (name)
);

-- Group-Contact relationship (many-to-many)
CREATE TABLE IF NOT EXISTS group_contacts (
    group_id VARCHAR(36) NOT NULL,
    contact_id VARCHAR(36) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, contact_id),
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- Blast Jobs table
CREATE TABLE IF NOT EXISTS blast_jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    message_type ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'POLL', 'LOCATION') DEFAULT 'TEXT',
    content TEXT,
    media_path VARCHAR(500),
    media_name VARCHAR(255),
    poll_data JSON,
    location_data JSON,
    status ENUM('pending', 'running', 'paused', 'completed', 'failed', 'scheduled', 'cancelled') DEFAULT 'pending',
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    current_index INT DEFAULT 0,
    delay_ms INT DEFAULT 3000,
    scheduled_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_scheduled (scheduled_at),
    INDEX idx_created (created_at)
);

-- Migration: Add scheduled_at column if not exists
-- Run this manually if upgrading: ALTER TABLE blast_jobs ADD COLUMN scheduled_at TIMESTAMP NULL AFTER delay_ms;
-- Also run: ALTER TABLE blast_jobs MODIFY status ENUM('pending', 'running', 'paused', 'completed', 'failed', 'scheduled', 'cancelled') DEFAULT 'pending';

-- Blast Recipients table
CREATE TABLE IF NOT EXISTS blast_recipients (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    message_id VARCHAR(255),
    error TEXT,
    sent_at TIMESTAMP NULL,
    FOREIGN KEY (job_id) REFERENCES blast_jobs(id) ON DELETE CASCADE,
    INDEX idx_job_id (job_id),
    INDEX idx_status (status)
);

-- Migration: Add name column if not exists (for existing databases)
-- Run this manually if upgrading: ALTER TABLE blast_recipients ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '' AFTER phone;

-- Message Templates table (optional, for future use)
CREATE TABLE IF NOT EXISTS message_templates (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    message_type ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'POLL', 'LOCATION') DEFAULT 'TEXT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Migration for existing databases: Add POLL and LOCATION to message_type
-- Run these commands manually:
-- ALTER TABLE blast_jobs MODIFY message_type ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'POLL', 'LOCATION') DEFAULT 'TEXT';
-- ALTER TABLE blast_jobs ADD COLUMN poll_data JSON AFTER media_name;
-- ALTER TABLE blast_jobs ADD COLUMN location_data JSON AFTER poll_data;
-- ALTER TABLE message_templates MODIFY message_type ENUM('TEXT', 'IMAGE', 'DOCUMENT', 'POLL', 'LOCATION') DEFAULT 'TEXT';

-- Settings table (key-value store for app settings)
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT IGNORE INTO settings (`key`, `value`) VALUES
('default_delay_ms', '3000'),
('max_daily_messages', '1000'),
('working_hours_start', '08:00'),
('working_hours_end', '20:00');

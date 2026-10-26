-- Create Multiple Databases
CREATE DATABASE hsedb;
CREATE DATABASE keycloakdb;

-- Create Dedicated User for HSE System
CREATE USER hse_user WITH ENCRYPTED PASSWORD 'hse_secure_password_2026';
GRANT ALL PRIVILEGES ON DATABASE hsedb TO hse_user;

-- Create Dedicated User for Keycloak
CREATE USER keycloak_user WITH ENCRYPTED PASSWORD 'keycloak_password_2026';
GRANT ALL PRIVILEGES ON DATABASE keycloakdb TO keycloak_user;

-- Connect to hsedb and initialize core HSE tables
\c hsedb;

GRANT ALL ON SCHEMA public TO hse_user;

CREATE TABLE IF NOT EXISTS work_permits (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    applicant_name VARCHAR(100) NOT NULL,
    contractor VARCHAR(100),
    hazard_level VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    camunda_process_instance_id VARCHAR(64),
    minio_document_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trir_records (
    id VARCHAR(64) PRIMARY KEY,
    year INT NOT NULL,
    month VARCHAR(50) NOT NULL,
    attendance INT NOT NULL,
    mission INT NOT NULL,
    contractor INT NOT NULL,
    incidents INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS heat_stress_logs (
    id VARCHAR(64) PRIMARY KEY,
    date VARCHAR(20) NOT NULL,
    time VARCHAR(20) NOT NULL,
    ta NUMERIC(5,2) NOT NULL,
    rh NUMERIC(5,2) NOT NULL,
    tw NUMERIC(5,2) NOT NULL,
    tg NUMERIC(5,2) NOT NULL,
    wbgt NUMERIC(5,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    work_rest_ratio VARCHAR(50) NOT NULL,
    water_intake VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS safety_warnings (
    id VARCHAR(64) PRIMARY KEY,
    unit VARCHAR(100) NOT NULL,
    contractor VARCHAR(100) NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    violation_title VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    fine_amount NUMERIC(12,2) DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    issued_date VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

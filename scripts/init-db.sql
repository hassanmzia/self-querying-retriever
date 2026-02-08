-- =============================================================================
-- AI Self-Querying Retriever - Database Initialization
-- =============================================================================
-- Creates additional databases needed by services

-- Create LangFuse database if it doesn't exist
SELECT 'CREATE DATABASE langfuse_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'langfuse_db')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE langfuse_db TO sqr_user;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

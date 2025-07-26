-- Initialize database schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- This file will be executed when the PostgreSQL container starts
-- The actual schema will be created by Drizzle migrations
-- This is just to ensure the database is ready

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE tiktok_app TO postgres;
-- Migration 002: Add new tables for group member management
-- Run this on your PostgreSQL database to add the new functionality

-- Accepted group members - individual members marked as acceptable in groups
CREATE TABLE IF NOT EXISTS accepted_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_sid TEXT,
    domain TEXT NOT NULL,
    reason TEXT,
    accepted_by TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(domain, group_name, member_name)
);

-- Group risk configurations - configurable risk scores per group
CREATE TABLE IF NOT EXISTS group_risk_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name TEXT NOT NULL,
    domain TEXT NOT NULL,
    base_risk_score INTEGER DEFAULT 10,
    max_acceptable_members INTEGER DEFAULT 5,
    alert_threshold INTEGER DEFAULT 10,
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(domain, group_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accepted_group_members_domain ON accepted_group_members(domain);
CREATE INDEX IF NOT EXISTS idx_accepted_group_members_group ON accepted_group_members(group_name);
CREATE INDEX IF NOT EXISTS idx_group_risk_configs_domain ON group_risk_configs(domain);

-- Insert default group risk configurations
INSERT INTO group_risk_configs (group_name, domain, base_risk_score, max_acceptable_members, alert_threshold, description) 
VALUES
    ('Domain Admins', '*', 35, 3, 5, 'Domain administrators - highest privilege level'),
    ('Enterprise Admins', '*', 40, 2, 3, 'Enterprise administrators - forest-wide privileges'),
    ('Schema Admins', '*', 30, 1, 2, 'Schema administrators - can modify AD schema'),
    ('Administrators', '*', 25, 5, 8, 'Local administrators group'),
    ('Account Operators', '*', 20, 3, 6, 'Can manage user accounts'),
    ('Backup Operators', '*', 15, 5, 8, 'Can backup and restore files'),
    ('Server Operators', '*', 15, 3, 6, 'Can manage server configuration'),
    ('Print Operators', '*', 10, 5, 8, 'Can manage printers and print queues')
ON CONFLICT (domain, group_name) DO NOTHING;

-- Verify the tables were created
SELECT 'accepted_group_members' as table_name, count(*) as row_count FROM accepted_group_members
UNION ALL
SELECT 'group_risk_configs' as table_name, count(*) as row_count FROM group_risk_configs;

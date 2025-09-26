-- Initialize database schema for DonWatcher
-- This file is run once when the PostgreSQL container is first created

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better data integrity
CREATE TYPE security_tool_type AS ENUM ('pingcastle', 'locksmith', 'domain_analysis', 'custom');
CREATE TYPE finding_status AS ENUM ('new', 'accepted', 'resolved', 'false_positive');

-- Reports table - now supports multiple security tools
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_type security_tool_type NOT NULL,
    domain TEXT NOT NULL,
    report_date TIMESTAMP WITH TIME ZONE NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- PingCastle specific fields
    global_score INTEGER DEFAULT 0,
    high_score INTEGER DEFAULT 0,
    medium_score INTEGER DEFAULT 0,
    low_score INTEGER DEFAULT 0,
    stale_objects_score INTEGER DEFAULT 0,
    privileged_accounts_score INTEGER DEFAULT 0,
    trusts_score INTEGER DEFAULT 0,
    anomalies_score INTEGER DEFAULT 0,
    
    -- Domain metadata
    domain_sid TEXT,
    domain_functional_level TEXT,
    forest_functional_level TEXT,
    maturity_level TEXT,
    dc_count INTEGER DEFAULT 0,
    user_count INTEGER DEFAULT 0,
    computer_count INTEGER DEFAULT 0,
    
    -- File references
    original_file TEXT,
    html_file TEXT,
    
    -- Extensible metadata for different tools
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Findings table - now supports multiple tools and enhanced tracking
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    tool_type security_tool_type NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    severity TEXT DEFAULT 'medium',
    description TEXT,
    recommendation TEXT,
    status finding_status DEFAULT 'new',
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk catalog - master list of all known security findings
CREATE TABLE risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_type security_tool_type NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    recommendation TEXT,
    severity TEXT DEFAULT 'medium',
    
    -- Make tool_type + category + name unique
    UNIQUE(tool_type, category, name),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accepted risks - risks marked as acceptable by the organization
CREATE TABLE accepted_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_type security_tool_type NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    reason TEXT,
    accepted_by TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Reference to the risk catalog
    FOREIGN KEY(tool_type, category, name) REFERENCES risks(tool_type, category, name),
    UNIQUE(tool_type, category, name)
);

-- Monitored groups - groups that should be tracked for membership changes
CREATE TABLE monitored_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name TEXT NOT NULL,
    group_sid TEXT,
    domain TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    alert_on_changes BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(domain, group_name)
);

-- Group memberships - track who is in which monitored groups
CREATE TABLE group_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES monitored_groups(id),
    member_name TEXT NOT NULL,
    member_sid TEXT,
    member_type TEXT DEFAULT 'user', -- user, computer, group
    is_direct_member BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(report_id, group_id, member_sid)
);

-- Settings table - application configuration
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent configurations - for future agent-based data collection
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    agent_type TEXT NOT NULL, -- 'domain_scanner', 'locksmith', etc.
    domain TEXT NOT NULL,
    endpoint_url TEXT,
    api_key TEXT,
    configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_reports_tool_type ON reports(tool_type);
CREATE INDEX idx_reports_domain ON reports(domain);
CREATE INDEX idx_reports_report_date ON reports(report_date);
CREATE INDEX idx_findings_report_id ON findings(report_id);
CREATE INDEX idx_findings_tool_type ON findings(tool_type);
CREATE INDEX idx_findings_category ON findings(category);
CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_group_memberships_report_id ON group_memberships(report_id);
CREATE INDEX idx_group_memberships_group_id ON group_memberships(group_id);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
    ('webhook_url', '', 'Webhook URL for alerts'),
    ('alert_message', 'New security findings detected in {domain}: {findings_count} unaccepted findings', 'Template for alert messages'),
    ('retention_days', '365', 'Number of days to retain old reports'),
    ('auto_accept_low_severity', 'false', 'Automatically accept low severity findings');

-- Insert default monitored groups (common high-privilege groups)
INSERT INTO monitored_groups (group_name, domain, description, alert_on_changes) VALUES
    ('Domain Admins', '*', 'Domain administrators group', true),
    ('Enterprise Admins', '*', 'Enterprise administrators group', true),
    ('Schema Admins', '*', 'Schema administrators group', true),
    ('Administrators', '*', 'Local administrators group', true),
    ('Account Operators', '*', 'Account operators group', true),
    ('Backup Operators', '*', 'Backup operators group', true),
    ('Server Operators', '*', 'Server operators group', true),
    ('Print Operators', '*', 'Print operators group', true);

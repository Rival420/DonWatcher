-- Migration 003: Add member status tracking for domain group scanner
-- This migration adds support for the new domain group member tracking features

BEGIN;

-- Add enabled status to group_memberships table
ALTER TABLE group_memberships 
ADD COLUMN is_enabled BOOLEAN DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN group_memberships.is_enabled IS 'Member account enabled status from AD (NULL for groups or unknown status)';

-- Add new tool type for domain group scanner
ALTER TYPE security_tool_type ADD VALUE IF NOT EXISTS 'domain_group_members';

-- Create optimized indexes for member management queries
CREATE INDEX IF NOT EXISTS idx_group_memberships_member_name 
ON group_memberships(member_name);

CREATE INDEX IF NOT EXISTS idx_accepted_group_members_lookup 
ON accepted_group_members(domain, group_name, member_name);

-- Create index for unaccepted member queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_group_memberships_report_member 
ON group_memberships(report_id, member_name);

-- Create materialized view for dashboard performance
CREATE MATERIALIZED VIEW IF NOT EXISTS group_member_summary AS
SELECT 
    mg.domain,
    mg.group_name,
    mg.id as group_id,
    COUNT(gm.id) as total_members,
    COUNT(agm.id) as accepted_members,
    COUNT(gm.id) - COUNT(agm.id) as unaccepted_members,
    MAX(r.report_date) as last_updated,
    MAX(r.id) as latest_report_id
FROM monitored_groups mg
LEFT JOIN group_memberships gm ON mg.id = gm.group_id
LEFT JOIN accepted_group_members agm ON (
    agm.domain = mg.domain 
    AND agm.group_name = mg.group_name 
    AND agm.member_name = gm.member_name
)
LEFT JOIN reports r ON gm.report_id = r.id
WHERE mg.is_active = true
GROUP BY mg.domain, mg.group_name, mg.id;

-- Create unique index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_member_summary_unique 
ON group_member_summary(domain, group_name);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_group_member_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY group_member_summary;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-refresh summary when group memberships change
CREATE OR REPLACE FUNCTION trigger_refresh_group_summary()
RETURNS trigger AS $$
BEGIN
    -- Refresh the materialized view after any change to group memberships
    PERFORM refresh_group_member_summary();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic refresh
DROP TRIGGER IF EXISTS trigger_group_memberships_summary ON group_memberships;
CREATE TRIGGER trigger_group_memberships_summary
    AFTER INSERT OR UPDATE OR DELETE ON group_memberships
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_group_summary();

DROP TRIGGER IF EXISTS trigger_accepted_members_summary ON accepted_group_members;
CREATE TRIGGER trigger_accepted_members_summary
    AFTER INSERT OR UPDATE OR DELETE ON accepted_group_members
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_group_summary();

-- Insert some sample group risk configurations for common privileged groups
INSERT INTO group_risk_configs (group_name, domain, base_risk_score, max_acceptable_members, alert_threshold, description)
VALUES
    ('Domain Admins', '*', 40, 2, 3, 'Highest privilege domain administrators'),
    ('Enterprise Admins', '*', 45, 1, 2, 'Forest-wide administrative privileges'),
    ('Schema Admins', '*', 35, 1, 2, 'Schema modification privileges'),
    ('Administrators', '*', 30, 3, 5, 'Local machine administrators'),
    ('Account Operators', '*', 25, 2, 4, 'Account management privileges'),
    ('Backup Operators', '*', 20, 3, 6, 'Backup and restore privileges'),
    ('Server Operators', '*', 20, 2, 4, 'Server management privileges'),
    ('Print Operators', '*', 15, 3, 6, 'Print system management')
ON CONFLICT (domain, group_name) DO NOTHING;

-- Update existing monitored groups to ensure they're properly configured
UPDATE monitored_groups 
SET is_active = true, alert_on_changes = true 
WHERE group_name IN (
    'Domain Admins', 'Enterprise Admins', 'Schema Admins', 
    'Administrators', 'Account Operators', 'Backup Operators',
    'Server Operators', 'Print Operators'
) AND domain = '*';

COMMIT;

-- Verify migration success
DO $$
BEGIN
    -- Check if new column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'group_memberships' 
        AND column_name = 'is_enabled'
    ) THEN
        RAISE EXCEPTION 'Migration failed: is_enabled column not created';
    END IF;
    
    -- Check if materialized view exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_name = 'group_member_summary'
    ) THEN
        RAISE EXCEPTION 'Migration failed: group_member_summary view not created';
    END IF;
    
    RAISE NOTICE 'Migration 003 completed successfully';
END $$;

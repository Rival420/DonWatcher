-- Migration 003: Add member status tracking for domain group scanner
-- IDEMPOTENT: Safe to run multiple times

-- Add enabled status to group_memberships table (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'group_memberships' 
        AND column_name = 'is_enabled'
    ) THEN
        ALTER TABLE group_memberships ADD COLUMN is_enabled BOOLEAN DEFAULT NULL;
        RAISE NOTICE 'Added is_enabled column to group_memberships';
    ELSE
        RAISE NOTICE 'is_enabled column already exists';
    END IF;
END $$;

-- Add comment for clarity (safe to run multiple times)
COMMENT ON COLUMN group_memberships.is_enabled IS 'Member account enabled status from AD (NULL for groups or unknown status)';

-- Add new tool type for domain group scanner (IF NOT EXISTS)
DO $$
BEGIN
    -- Check if the enum value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'domain_group_members' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'security_tool_type')
    ) THEN
        ALTER TYPE security_tool_type ADD VALUE 'domain_group_members';
        RAISE NOTICE 'Added domain_group_members to security_tool_type enum';
    ELSE
        RAISE NOTICE 'domain_group_members already exists in enum';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'domain_group_members already exists in enum (caught exception)';
END $$;

-- Create optimized indexes for member management queries
CREATE INDEX IF NOT EXISTS idx_group_memberships_member_name ON group_memberships(member_name);
CREATE INDEX IF NOT EXISTS idx_accepted_group_members_lookup ON accepted_group_members(domain, group_name, member_name);
CREATE INDEX IF NOT EXISTS idx_group_memberships_report_member ON group_memberships(report_id, member_name);

-- Drop existing materialized view if it exists (to recreate with correct definition)
DROP MATERIALIZED VIEW IF EXISTS group_member_summary CASCADE;

-- Create materialized view for dashboard performance
CREATE MATERIALIZED VIEW group_member_summary AS
SELECT 
    mg.domain,
    mg.group_name,
    mg.id as group_id,
    COUNT(gm.id) as total_members,
    COUNT(agm.id) as accepted_members,
    COUNT(gm.id) - COUNT(agm.id) as unaccepted_members,
    MAX(r.report_date) as last_updated
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_member_summary_unique ON group_member_summary(domain, group_name);

-- Create function to refresh materialized view (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION refresh_group_member_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY group_member_summary;
EXCEPTION
    WHEN OTHERS THEN
        -- Fall back to non-concurrent refresh if concurrent fails
        REFRESH MATERIALIZED VIEW group_member_summary;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-refresh summary when group memberships change
CREATE OR REPLACE FUNCTION trigger_refresh_group_summary()
RETURNS trigger AS $$
BEGIN
    -- Refresh the materialized view after any change to group memberships
    PERFORM refresh_group_member_summary();
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail the transaction if refresh fails
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic refresh (drop first if exists)
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

-- Insert/update group risk configurations (ON CONFLICT handles duplicates)
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

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Migration 003 completed successfully';
END $$;

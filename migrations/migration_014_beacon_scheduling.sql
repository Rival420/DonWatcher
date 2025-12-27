-- Migration 014: Update beacon templates and add job scheduling
-- Simplifies templates to DonWatcher scripts only and adds scheduling capability

-- Clear old templates and insert only relevant DonWatcher script templates
DELETE FROM beacon_task_templates;

INSERT INTO beacon_task_templates (name, description, job_type, command, parameters, icon, is_dangerous)
VALUES 
    ('Domain Group Scan', 'Scan Active Directory privileged groups and upload to DonWatcher', 'domain_scan', NULL, '{"auto_upload": true}', '👥', false),
    ('Vulnerability Scan', 'Collect vulnerability data from Outpost24 and upload to DonWatcher', 'vulnerability_scan', NULL, '{"auto_upload": true}', '🛡️', false),
    ('Custom PowerShell', 'Execute a custom PowerShell command', 'powershell', '', '{}', '⚡', true)
ON CONFLICT DO NOTHING;

-- Add scheduled jobs table for recurring tasks
CREATE TABLE IF NOT EXISTS beacon_scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Target beacons (NULL = all beacons, or specific beacon_id)
    beacon_id VARCHAR(64),  -- NULL means all active beacons
    target_filter JSONB DEFAULT '{}',  -- e.g., {"domain": "CONTOSO", "status": "active"}
    
    -- Job configuration
    job_type VARCHAR(50) NOT NULL,
    command TEXT,
    parameters JSONB DEFAULT '{}',
    
    -- Schedule configuration
    schedule_type VARCHAR(20) NOT NULL,  -- 'once', 'hourly', 'daily', 'weekly', 'cron'
    schedule_value VARCHAR(100),  -- cron expression or specific value
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    
    -- State
    is_enabled BOOLEAN DEFAULT TRUE,
    run_count INTEGER DEFAULT 0,
    last_run_status VARCHAR(20),  -- 'success', 'partial', 'failed'
    
    -- Metadata
    created_by VARCHAR(255) DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for finding jobs that need to run
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run 
    ON beacon_scheduled_jobs(next_run_at) 
    WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_enabled 
    ON beacon_scheduled_jobs(is_enabled);

-- Function to calculate next run time
CREATE OR REPLACE FUNCTION calculate_next_run(
    p_schedule_type VARCHAR(20),
    p_schedule_value VARCHAR(100),
    p_from_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    CASE p_schedule_type
        WHEN 'hourly' THEN
            RETURN p_from_time + INTERVAL '1 hour';
        WHEN 'daily' THEN
            RETURN p_from_time + INTERVAL '1 day';
        WHEN 'weekly' THEN
            RETURN p_from_time + INTERVAL '1 week';
        WHEN 'once' THEN
            RETURN NULL;  -- One-time, no next run
        ELSE
            RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Add schedule_id reference to beacon_jobs for tracking scheduled job instances
ALTER TABLE beacon_jobs ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES beacon_scheduled_jobs(id);

-- View for scheduled jobs dashboard
CREATE OR REPLACE VIEW v_scheduled_jobs_dashboard AS
SELECT 
    s.id,
    s.name,
    s.description,
    s.beacon_id,
    s.target_filter,
    s.job_type,
    s.schedule_type,
    s.schedule_value,
    s.next_run_at,
    s.last_run_at,
    s.is_enabled,
    s.run_count,
    s.last_run_status,
    s.created_by,
    s.created_at,
    -- Get target beacon info if specific beacon
    b.hostname as target_hostname,
    -- Count of jobs created from this schedule
    (SELECT COUNT(*) FROM beacon_jobs j WHERE j.schedule_id = s.id) as total_jobs_created,
    -- Count of successful runs
    (SELECT COUNT(*) FROM beacon_jobs j WHERE j.schedule_id = s.id AND j.status = 'completed') as successful_runs
FROM beacon_scheduled_jobs s
LEFT JOIN beacons b ON s.beacon_id = b.beacon_id;


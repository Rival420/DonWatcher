-- Migration 001: Rename global_score to pingcastle_global_score and add aggregate_global_score
-- IDEMPOTENT: Safe to run multiple times

-- Step 1: Rename global_score to pingcastle_global_score (only if global_score exists)
DO $$
BEGIN
    -- Check if old column name exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'global_score'
    ) THEN
        ALTER TABLE reports RENAME COLUMN global_score TO pingcastle_global_score;
        RAISE NOTICE 'Renamed global_score to pingcastle_global_score';
    ELSE
        RAISE NOTICE 'Column global_score does not exist (may already be renamed or init_db.sql used new name)';
    END IF;
END $$;

-- Step 2: Add aggregate_global_score column (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'aggregate_global_score'
    ) THEN
        ALTER TABLE reports ADD COLUMN aggregate_global_score INTEGER DEFAULT 0;
        RAISE NOTICE 'Added aggregate_global_score column';
    ELSE
        RAISE NOTICE 'Column aggregate_global_score already exists';
    END IF;
END $$;

-- Step 3: Update aggregate_global_score with current pingcastle values for existing records
-- Only update records where aggregate_global_score is still 0 or null
UPDATE reports 
SET aggregate_global_score = COALESCE(pingcastle_global_score, 0)
WHERE tool_type = 'pingcastle' 
  AND (aggregate_global_score IS NULL OR aggregate_global_score = 0)
  AND pingcastle_global_score IS NOT NULL;

-- Verification (informational only, won't cause failure)
DO $$
BEGIN
    RAISE NOTICE 'Migration 001 completed successfully';
END $$;

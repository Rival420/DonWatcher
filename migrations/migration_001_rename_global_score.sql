-- Migration 001: Rename global_score to pingcastle_global_score and add aggregate_global_score
-- Run this on your PostgreSQL database to fix the column name issue

-- Step 1: Rename the existing global_score column to pingcastle_global_score
ALTER TABLE reports RENAME COLUMN global_score TO pingcastle_global_score;

-- Step 2: Add the new aggregate_global_score column
ALTER TABLE reports ADD COLUMN aggregate_global_score INTEGER DEFAULT 0;

-- Step 3: Update the aggregate_global_score with current pingcastle values for existing records
UPDATE reports SET aggregate_global_score = pingcastle_global_score WHERE tool_type = 'pingcastle';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'reports' 
AND column_name IN ('pingcastle_global_score', 'aggregate_global_score')
ORDER BY column_name;

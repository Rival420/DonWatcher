# Database Migrations

This directory contains all database schema migrations for the DonWatcher project.

## Structure

```
migrations/
├── README.md                                      # This file
├── init_db.sql                                    # Initial database schema
├── migration_001_rename_global_score.sql          # Rename global score field
├── migration_002_add_group_member_tables.sql      # Add group membership tracking
├── migration_003_add_member_status.sql            # Add member status tracking (Phase 1)
├── migration_004_add_risk_integration.sql         # Add risk integration tables (Phase 3)
└── migration_005_add_risk_dashboard_summary.sql   # Add dashboard view and history table
```

## Migration Order

Migrations must be applied in numerical order:

1. **init_db.sql** - Creates initial database schema
2. **migration_001_rename_global_score.sql** - Updates score field naming
3. **migration_002_add_group_member_tables.sql** - Adds group membership functionality
4. **migration_003_add_member_status.sql** - Adds enhanced member tracking (Phase 1)
5. **migration_004_add_risk_integration.sql** - Adds risk integration tables (Phase 3)
6. **migration_005_add_risk_dashboard_summary.sql** - Adds dashboard summary view and calculation history

## Applying Migrations

### Prerequisites
- PostgreSQL database running
- Database connection configured in `DATABASE_URL` environment variable
- Required Python packages installed (`psycopg2-binary`, `sqlalchemy`)

### Initial Setup (New Installation)
```bash
# Create database and apply initial schema
psql -h localhost -U donwatcher -d donwatcher -f migrations/init_db.sql
```

### Applying Individual Migrations
```bash
# Apply specific migration
psql -h localhost -U donwatcher -d donwatcher -f migrations/migration_003_add_member_status.sql
```

### Using Python (Alternative)
```python
from server.database import engine
from sqlalchemy import text

# Read and execute migration
with open('migrations/migration_003_add_member_status.sql', 'r') as f:
    migration_sql = f.read()

with engine.connect() as conn:
    conn.execute(text(migration_sql))
    conn.commit()
```

## Migration Guidelines

### Creating New Migrations
1. **Naming Convention**: `migration_XXX_description.sql` where XXX is the next sequential number
2. **Backward Compatibility**: Ensure migrations don't break existing functionality
3. **Rollback Support**: Include rollback instructions in comments when possible
4. **Testing**: Test migrations on sample data before production deployment

### Migration Content
Each migration should include:

```sql
-- Migration XXX: Description
-- Date: YYYY-MM-DD
-- Purpose: Detailed explanation of changes

BEGIN;

-- Migration statements here
ALTER TABLE example_table ADD COLUMN new_field TEXT;

-- Verification queries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'example_table' 
                   AND column_name = 'new_field') THEN
        RAISE EXCEPTION 'Migration failed: new_field not created';
    END IF;
    RAISE NOTICE 'Migration XXX completed successfully';
END $$;

COMMIT;
```

## Current Schema Version

**Latest Version**: Migration 005 (Risk Dashboard Summary & Calculation History)

### Key Features:
- Multi-tool security report support
- Group membership tracking with acceptance workflow  
- Enhanced member data (type, enabled status, SID)
- Performance optimizations with materialized views
- Automatic refresh triggers for real-time updates
- Risk integration tables (domain assessments, global scores)
- Risk dashboard summary view for cross-domain comparison
- Risk calculation history audit trail

## Rollback Instructions

### Migration 003 Rollback
```sql
-- Remove added columns and objects
DROP TRIGGER IF EXISTS trigger_group_memberships_summary ON group_memberships;
DROP TRIGGER IF EXISTS trigger_accepted_members_summary ON accepted_group_members;
DROP FUNCTION IF EXISTS trigger_refresh_group_summary();
DROP FUNCTION IF EXISTS refresh_group_member_summary();
DROP MATERIALIZED VIEW IF EXISTS group_member_summary;
DROP INDEX IF EXISTS idx_group_memberships_member_name;
DROP INDEX IF EXISTS idx_accepted_group_members_lookup;
DROP INDEX IF EXISTS idx_group_memberships_report_member;
ALTER TABLE group_memberships DROP COLUMN IF EXISTS is_enabled;
-- Note: Cannot easily remove enum value, requires recreating enum
```

## Troubleshooting

### Common Issues

**Permission Denied**
```bash
# Ensure proper database permissions
GRANT ALL PRIVILEGES ON DATABASE donwatcher TO donwatcher;
GRANT ALL ON SCHEMA public TO donwatcher;
```

**Migration Already Applied**
- Check migration history in database logs
- Use `IF NOT EXISTS` clauses in migrations to prevent errors

**Connection Issues**
- Verify `DATABASE_URL` environment variable
- Check PostgreSQL service status
- Validate connection parameters

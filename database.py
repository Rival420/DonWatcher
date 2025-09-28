import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import logging

# Database URL from environment or default for development
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://donwatcher:donwatcher_pass@localhost:5432/donwatcher"
)

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=300,    # Recycle connections every 5 minutes
    echo=False           # Set to True for SQL debugging
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """Initialize database connection and verify schema."""
    try:
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logging.info("Database connection successful")
        
        # Check if tables exist
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'reports'
                );
            """))
            tables_exist = result.scalar()
            
            if not tables_exist:
                logging.warning("Database tables not found. Please run the init_db.sql script.")
                return False
                
        logging.info("Database initialization complete")
        return True
        
    except Exception as e:
        logging.error(f"Database initialization failed: {e}")
        return False

def test_connection():
    """Test database connection."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logging.error(f"Database connection test failed: {e}")
        return False

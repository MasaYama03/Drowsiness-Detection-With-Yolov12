"""
Migration: Add 'interrupted' status to detection_sessions table
This allows the system to distinguish between:
- 'completed': User properly clicked stop button
- 'interrupted': User navigated away, closed tab, or lost connection
"""

import psycopg2
from config import DATABASE_URL

def run_migration():
    """Add 'interrupted' to the status check constraint"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Drop the existing constraint
        cursor.execute("""
            ALTER TABLE detection_sessions 
            DROP CONSTRAINT IF EXISTS detection_sessions_status_check;
        """)
        
        # Add the new constraint with 'interrupted' status
        cursor.execute("""
            ALTER TABLE detection_sessions 
            ADD CONSTRAINT detection_sessions_status_check 
            CHECK (status IN ('active', 'completed', 'stopped', 'interrupted'));
        """)
        
        conn.commit()
        print("✅ Successfully added 'interrupted' status to detection_sessions table")
        
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        if conn:
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    run_migration()

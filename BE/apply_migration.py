import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def apply_migration():
    try:
        # Connect to database
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        cursor = conn.cursor()
        
        # Drop existing constraint
        cursor.execute('ALTER TABLE detection_sessions DROP CONSTRAINT IF EXISTS detection_sessions_status_check')
        
        # Add new constraint with 'interrupted' status
        cursor.execute("""
            ALTER TABLE detection_sessions 
            ADD CONSTRAINT detection_sessions_status_check 
            CHECK (status IN ('active', 'completed', 'stopped', 'interrupted'))
        """)
        
        # Commit changes
        conn.commit()
        print("✅ Database constraint updated successfully - 'interrupted' status now allowed")
        
        # Verify the constraint
        cursor.execute("""
            SELECT constraint_name, check_clause 
            FROM information_schema.check_constraints 
            WHERE table_name = 'detection_sessions' AND constraint_name LIKE '%status%'
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"✅ Verified constraint: {result[1]}")
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        if conn:
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    apply_migration()

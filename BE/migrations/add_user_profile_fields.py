# Migration: Add phone and date_of_birth fields to users table
# Run this script to update the database schema

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, SessionLocal
from sqlalchemy import text

def add_user_profile_fields():
    """Add phone and date_of_birth columns to users table"""
    db = SessionLocal()
    try:
        print("Adding phone and date_of_birth fields to users table...")
        
        # Check if columns already exist
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('phone', 'date_of_birth')
        """))
        existing_columns = [row[0] for row in result.fetchall()]
        
        # Add phone column if it doesn't exist
        if 'phone' not in existing_columns:
            db.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(20)"))
            print("✓ Added phone column")
        else:
            print("✓ Phone column already exists")
            
        # Add date_of_birth column if it doesn't exist
        if 'date_of_birth' not in existing_columns:
            db.execute(text("ALTER TABLE users ADD COLUMN date_of_birth TIMESTAMP"))
            print("✓ Added date_of_birth column")
        else:
            print("✓ Date_of_birth column already exists")
            
        db.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_user_profile_fields()

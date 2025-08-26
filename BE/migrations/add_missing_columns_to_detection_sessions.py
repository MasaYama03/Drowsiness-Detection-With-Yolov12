import os
import sys
from sqlalchemy import create_engine, text

# Add project root to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from BE.database import DATABASE_URL

def add_missing_columns():
    """Adds missing columns to the detection_sessions table."""
    engine = create_engine(DATABASE_URL)
    
    # Columns to add with their data types
    columns_to_add = {
        'alarm_triggered': 'BOOLEAN DEFAULT FALSE',
        'notes': 'TEXT',
        'created_at': 'TIMESTAMP WITHOUT TIME ZONE DEFAULT now()'
    }
    
    with engine.connect() as connection:
        for column_name, column_type in columns_to_add.items():
            try:
                # Check if the column already exists
                check_column_query = text(
                    f"""SELECT column_name 
                       FROM information_schema.columns 
                       WHERE table_name='detection_sessions' AND column_name='{column_name}'"""
                )
                result = connection.execute(check_column_query).fetchone()
                
                if result:
                    print(f"Column '{column_name}' already exists in 'detection_sessions'. Skipping.")
                else:
                    # Add the column if it doesn't exist
                    add_column_query = text(f'ALTER TABLE detection_sessions ADD COLUMN {column_name} {column_type}')
                    connection.execute(add_column_query)
                    print(f"Successfully added column '{column_name}' to 'detection_sessions'.")
            except Exception as e:
                print(f"Error adding column '{column_name}': {e}")
                # The transaction will be rolled back automatically on exit if an error occurs

        # Commit the transaction to make the changes persistent
        connection.commit()

if __name__ == "__main__":
    print("Starting database migration...")
    add_missing_columns()
    print("Migration complete.")

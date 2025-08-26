from sqlalchemy import create_engine, inspect
from BE.database import DATABASE_URL

def check_database():
    try:
        # Create engine
        engine = create_engine(DATABASE_URL)
        
        # Create inspector
        inspector = inspect(engine)
        
        # Get all table names
        print("Tables in database:")
        print(inspector.get_table_names())
        
        # Check detection_sessions columns
        if 'detection_sessions' in inspector.get_table_names():
            print("\nColumns in detection_sessions:")
            for column in inspector.get_columns('detection_sessions'):
                print(f"- {column['name']}: {column['type']}")
        
        # Check sample data
        with engine.connect() as conn:
            result = conn.execute("SELECT id, drowsiness_count, awake_count, yawn_count, total_detections FROM detection_sessions ORDER BY id DESC LIMIT 5")
            print("\nSample data from detection_sessions:")
            for row in result:
                print(dict(row))
                
    except Exception as e:
        print(f"Error checking database: {e}")

if __name__ == "__main__":
    check_database()

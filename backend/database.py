import os
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_db(app):
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        # Production: Managed MySQL (Aiven)
        if database_url.startswith("mysql://"):
            database_url = database_url.replace("mysql://", "mysql+pymysql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        # Local: SQLite (Pointing to the instance folder)
        # Using instance_path ensures it finds the DB file in the 'instance' folder
        app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(app.instance_path, "voting.db")}'

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    # Ensure the instance folder exists before creating the DB
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    with app.app_context():
        # Import all models to ensure they're registered
        from models import Poll, Option, Vote
        
        # Create all tables if they don't exist
        db.create_all()
        
        # Add new columns if they don't exist (for backward compatibility)
        try:
            # Check if is_active column exists in Poll table
            from sqlalchemy import text
            inspector = db.inspect(db.engine)
            poll_columns = [col['name'] for col in inspector.get_columns('poll')]
            
            if 'is_active' not in poll_columns:
                db.session.execute(text('ALTER TABLE poll ADD COLUMN is_active BOOLEAN DEFAULT 1'))
                db.session.commit()
            
            if 'total_votes' not in poll_columns:
                db.session.execute(text('ALTER TABLE poll ADD COLUMN total_votes INTEGER DEFAULT 0'))
                db.session.commit()
                
        except Exception as e:
            print(f"Migration warning: {e}")
            db.session.rollback()
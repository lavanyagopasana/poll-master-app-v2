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
        db.create_all()
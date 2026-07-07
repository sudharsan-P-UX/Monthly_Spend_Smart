# database/connection.py: Database connection management delegating to VercelDb

import os
from database.VercelDb import (
    get_vercel_db_connection,
    init_vercel_db,
    PostgresCursorWrapper,
    PostgresConnectionWrapper,
    generate_salt,
    encrypt_password
)

DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
DB_PATH = os.environ.get('DATABASE_PATH')

def get_db_connection():
    return get_vercel_db_connection()

def init_db():
    # 1. Initialize schema from VercelDb.sql
    init_vercel_db()
    
    # 2. Seed default admin users if not present
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check and seed generic 'admin' user
        cursor.execute("SELECT COUNT(*) FROM Refusers WHERE Username = ?", ('admin',))
        row = cursor.fetchone()
        count = row[0] if row else 0
        if count == 0:
            salt = generate_salt()
            pwd_hash = encrypt_password('admin123', salt)
            cursor.execute(
                "INSERT INTO Refusers (Username, Firstname, Lastname, Email, Phone, saltkey, password, isactive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ('admin', 'System', 'Admin', 'admin@spendsmart.local', '1234567890', salt, pwd_hash, 1)
            )
            login_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO UserRole (LoginId, RoleId, isactive) VALUES (?, ?, ?)",
                (login_id, 1, 1)
            )
            conn.commit()
            print("Default admin user created successfully.")

        # Check and seed user-requested 'Admin' user
        cursor.execute("SELECT COUNT(*) FROM Refusers WHERE Username = ?", ('Admin',))
        row_requested = cursor.fetchone()
        count_requested = row_requested[0] if row_requested else 0
        if count_requested == 0:
            salt = generate_salt()
            pwd_hash = encrypt_password('admin123', salt)
            cursor.execute(
                "INSERT INTO Refusers (Username, Firstname, Lastname, Email, Phone, saltkey, password, isactive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ('Admin', 'Admin', 'user', 'adminuser@gmail.com', '9876543221', salt, pwd_hash, 1)
            )
            login_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO UserRole (LoginId, RoleId, isactive) VALUES (?, ?, ?)",
                (login_id, 1, 1)
            )
            conn.commit()
            print("Default Admin user (adminuser@gmail.com) created successfully.")
    except Exception as e:
        print(f"Error seeding default admin users: {e}")
        conn.rollback()
    finally:
        conn.close()

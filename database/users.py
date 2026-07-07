# database/users.py: User management operations targeting Refusers and UserRole tables

import sqlite3
import datetime
from database.connection import get_db_connection
from database.VercelDb import (
    generate_salt,
    encrypt_password,
    verify_encrypted_password
)

def create_user(username, password, role_id=2, first_name=None, last_name=None, email=None, phone=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        salt = generate_salt()
        pwd_hash = encrypt_password(password, salt)
        
        # Insert user details in Refusers
        cursor.execute(
            '''INSERT INTO Refusers (Username, Firstname, Lastname, Email, Phone, saltkey, password, isactive) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (username, first_name, last_name, email, phone, salt, pwd_hash, True)
        )
        
        user_id = cursor.lastrowid
        
        # Map user role in UserRole
        cursor.execute(
            '''INSERT INTO UserRole (LoginId, RoleId, isactive) 
               VALUES (?, ?, ?)''',
            (user_id, role_id, True)
        )
        
        conn.commit()
        return user_id
    except sqlite3.IntegrityError:
        conn.rollback()
        return None
    except Exception as e:
        conn.rollback()
        print(f"Error in create_user: {e}")
        return None
    finally:
        conn.close()

def get_user_by_username(username):
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        'SELECT LoginId as id, Username, Firstname as first_name, Lastname as last_name, Email, Phone, saltkey, password FROM Refusers WHERE Username = ?',
        (username,)
    ).fetchone()
    conn.close()
    if row:
        d = {k.lower(): v for k, v in dict(row).items()}
        d['password_hash'] = d['password']
        return d
    return None

def get_user_by_id(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        'SELECT LoginId as id, Username, Firstname as first_name, Lastname as last_name, Email, Phone, saltkey, password FROM Refusers WHERE LoginId = ?',
        (user_id,)
    ).fetchone()
    conn.close()
    if row:
        d = {k.lower(): v for k, v in dict(row).items()}
        d['password_hash'] = d['password']
        return d
    return None

def get_user_by_username_or_email(identifier):
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        'SELECT LoginId as id, Username, Firstname as first_name, Lastname as last_name, Email, Phone, saltkey, password FROM Refusers WHERE Username = ? OR Email = ?',
        (identifier, identifier)
    ).fetchone()
    conn.close()
    if row:
        d = {k.lower(): v for k, v in dict(row).items()}
        d['password_hash'] = d['password']
        return d
    return None

def verify_user_password(username_or_email, password):
    user = get_user_by_username_or_email(username_or_email)
    if user:
        if verify_encrypted_password(password, user['saltkey'], user['password']):
            return user
    return None

def get_user_privileges(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check role from UserRole
        row = cursor.execute(
            'SELECT RoleId FROM UserRole WHERE LoginId = ? AND isactive = TRUE LIMIT 1',
            (user_id,)
        ).fetchone()
        
        if not row:
            return {'can_view': 0, 'can_add': 0, 'can_edit': 0, 'can_delete': 0, 'is_admin': False}
            
        role_id = row['roleid'] if 'roleid' in row else row[0]
        is_admin = (int(role_id) == 1)
        
        # Check privileges from RefRoleAccess
        priv_row = cursor.execute(
            'SELECT Editaccess, DeleteAccess, Addaccess, updateaccess FROM RefRoleAccess WHERE RoleId = ? AND isactive = TRUE LIMIT 1',
            (role_id,)
        ).fetchone()
        
        def parse_bit(val):
            if val is None:
                return 1
            if isinstance(val, str):
                return 1 if '1' in val else 0
            if isinstance(val, bytes):
                return 1 if b'\x01' in val or b'1' in val else 0
            return 1 if bool(val) else 0

        if priv_row:
            # Map database keys
            # SQLite returns by tuple index, PostgreSQL returns DictRow
            if isinstance(priv_row, dict) or not isinstance(priv_row, (tuple, list)):
                # Dict-like row
                edit = priv_row.get('editaccess', 1)
                delete = priv_row.get('deleteaccess', 1)
                add = priv_row.get('addaccess', 1)
            else:
                edit = priv_row[0]
                delete = priv_row[1]
                add = priv_row[2]
                
            return {
                'can_view': 1,
                'can_add': parse_bit(add),
                'can_edit': parse_bit(edit),
                'can_delete': parse_bit(delete),
                'is_admin': is_admin
            }
        else:
            # Default fallback privileges based on role
            if is_admin:
                return {'can_view': 1, 'can_add': 1, 'can_edit': 1, 'can_delete': 1, 'is_admin': True}
            elif int(role_id) == 3: # Viewer
                return {'can_view': 1, 'can_add': 0, 'can_edit': 0, 'can_delete': 0, 'is_admin': False}
            else:
                return {'can_view': 1, 'can_add': 1, 'can_edit': 1, 'can_delete': 1, 'is_admin': False}
    except Exception as e:
        print(f"Error in get_user_privileges: {e}")
        return {'can_view': 1, 'can_add': 1, 'can_edit': 1, 'can_delete': 1, 'is_admin': False}
    finally:
        conn.close()

def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        rows = cursor.execute(
            '''SELECT Refusers.LoginId as id, Refusers.Username, UserRole.RoleId as role_id, RefRole.RoleName as role_name 
               FROM Refusers 
               LEFT JOIN UserRole ON Refusers.LoginId = UserRole.LoginId 
               LEFT JOIN RefRole ON UserRole.RoleId = RefRole.RoleId'''
        ).fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        print(f"Error in get_all_users: {e}")
        return []
    finally:
        conn.close()

def update_user_role(user_id, role_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE UserRole SET RoleId = ?, lastchangePassword = CURRENT_TIMESTAMP WHERE LoginId = ?',
            (role_id, user_id)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in update_user_role: {e}")
        return False
    finally:
        conn.close()

def delete_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Prevent deleting the last admin
        user_role_row = cursor.execute('SELECT RoleId FROM UserRole WHERE LoginId = ?', (user_id,)).fetchone()
        if user_role_row:
            role_id = user_role_row['roleid'] if 'roleid' in user_role_row else user_role_row[0]
            if int(role_id) == 1:
                admin_count_row = cursor.execute('SELECT COUNT(*) FROM UserRole WHERE RoleId = 1').fetchone()
                admin_count = admin_count_row[0] if admin_count_row else 0
                if admin_count <= 1:
                    return False
                    
        cursor.execute('DELETE FROM UserRole WHERE LoginId = ?', (user_id,))
        cursor.execute('DELETE FROM Refusers WHERE LoginId = ?', (user_id,))
        cursor.execute('DELETE FROM expenses WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM emis WHERE user_id = ?', (user_id,))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in delete_user: {e}")
        return False
    finally:
        conn.close()

def update_user_password_by_username(username, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        salt = generate_salt()
        pwd_hash = encrypt_password(password, salt)
        
        cursor.execute(
            'UPDATE Refusers SET saltkey = ?, password = ? WHERE Username = ?',
            (salt, pwd_hash, username)
        )
        # Also update expiry and password change timestamp
        cursor.execute(
            '''UPDATE UserRole 
               SET lastchangePassword = CURRENT_TIMESTAMP, 
                   PasswordExpiry = (CURRENT_TIMESTAMP + INTERVAL '90 days') 
               WHERE LoginId = (SELECT LoginId FROM Refusers WHERE Username = ? LIMIT 1)''',
            (username,)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in update_user_password_by_username: {e}")
        return False
    finally:
        conn.close()

def update_user_password(user_id, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        salt = generate_salt()
        pwd_hash = encrypt_password(password, salt)
        
        cursor.execute(
            'UPDATE Refusers SET saltkey = ?, password = ? WHERE LoginId = ?',
            (salt, pwd_hash, user_id)
        )
        cursor.execute(
            '''UPDATE UserRole 
               SET lastchangePassword = CURRENT_TIMESTAMP, 
                   PasswordExpiry = (CURRENT_TIMESTAMP + INTERVAL '90 days') 
               WHERE LoginId = ?''',
            (user_id,)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in update_user_password: {e}")
        return False
    finally:
        conn.close()

def update_user_profile(user_id, first_name, last_name, email, phone):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE Refusers SET Firstname = ?, Lastname = ?, Email = ?, Phone = ? WHERE LoginId = ?',
            (first_name, last_name, email, phone, user_id)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in update_user_profile: {e}")
        raise e
    finally:
        conn.close()

# database/admin_data.py: Admin metadata CRUD operations for RefRole, RefRoleAccess, and other lookup tables

import sqlite3
from database.connection import get_db_connection

def is_pg_conn(conn):
    return conn.__class__.__name__ == 'PostgresConnectionWrapper'

def get_roles():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        roles = cursor.execute('SELECT RoleId as id, RoleName as name FROM RefRole ORDER BY RoleId ASC').fetchall()
        role_list = []
        for r in roles:
            r_id = r['id']
            # Fetch privileges
            privs = cursor.execute('SELECT Editaccess, DeleteAccess, Addaccess, updateaccess FROM RefRoleAccess WHERE RoleId = ? LIMIT 1', (r_id,)).fetchone()
            
            def parse_bit(val):
                if val is None:
                    return 1
                if isinstance(val, str):
                    return 1 if '1' in val else 0
                if isinstance(val, bytes):
                    return 1 if b'\x01' in val or b'1' in val else 0
                return 1 if bool(val) else 0

            if privs:
                if hasattr(privs, 'keys') or isinstance(privs, dict):
                    p_dict = {k.lower(): v for k, v in dict(privs).items()}
                    edit = p_dict.get('editaccess', 1)
                    delete = p_dict.get('deleteaccess', 1)
                    add = p_dict.get('addaccess', 1)
                elif isinstance(privs, (tuple, list)):
                    edit = privs[0]
                    delete = privs[1]
                    add = privs[2]
                else:
                    edit = getattr(privs, 'editaccess', 1)
                    delete = getattr(privs, 'deleteaccess', 1)
                    add = getattr(privs, 'addaccess', 1)
                
                role_list.append({
                    'id': r_id,
                    'name': r['name'],
                    'can_view': 1,
                    'can_add': parse_bit(add),
                    'can_edit': parse_bit(edit),
                    'can_delete': parse_bit(delete)
                })
            else:
                # Default privileges
                if r_id == 1:
                    role_list.append({'id': r_id, 'name': r['name'], 'can_view': 1, 'can_add': 1, 'can_edit': 1, 'can_delete': 1})
                elif r_id == 3: # Viewer
                    role_list.append({'id': r_id, 'name': r['name'], 'can_view': 1, 'can_add': 0, 'can_edit': 0, 'can_delete': 0})
                else:
                    role_list.append({'id': r_id, 'name': r['name'], 'can_view': 1, 'can_add': 1, 'can_edit': 1, 'can_delete': 1})
        return role_list
    finally:
        conn.close()

def add_role(name):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO RefRole (RoleName, IsActive, displayOrder) VALUES (?, 1, 0)', (name,))
        role_id = cursor.lastrowid
        
        cursor.execute(
            'INSERT INTO RefRoleAccess (RoleId, MenuId, Editaccess, DeleteAccess, Addaccess, updateaccess, isactive) VALUES (?, 1, ?, ?, ?, ?, 1)',
            (role_id, 1, 1, 1, 1)
        )
        conn.commit()
        return role_id
    except sqlite3.IntegrityError:
        conn.rollback()
        return None
    except Exception as e:
        conn.rollback()
        print(f"Error in add_role: {e}")
        return None
    finally:
        conn.close()

def update_role_privileges(role_id, can_view, can_add, can_edit, can_delete):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Delete old privileges
        cursor.execute('DELETE FROM RefRoleAccess WHERE RoleId = ?', (role_id,))
        
        cursor.execute(
            '''INSERT INTO RefRoleAccess (RoleId, MenuId, Editaccess, DeleteAccess, Addaccess, updateaccess, isactive) 
               VALUES (?, 1, ?, ?, ?, ?, 1)''',
            (role_id, int(can_edit), int(can_delete), int(can_add), int(can_edit))
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in update_role_privileges: {e}")
        return False
    finally:
        conn.close()

def delete_role(role_id):
    if int(role_id) == 1:
        return False
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Reset users mapped to this role to standard User (RoleId = 2)
        cursor.execute('UPDATE UserRole SET RoleId = 2 WHERE RoleId = ?', (role_id,))
        cursor.execute('DELETE FROM RefRoleAccess WHERE RoleId = ?', (role_id,))
        cursor.execute('DELETE FROM RefRole WHERE RoleId = ?', (role_id,))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in delete_role: {e}")
        return False
    finally:
        conn.close()

def update_role_name(role_id, name):
    if int(role_id) == 1:
        return False
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('UPDATE RefRole SET RoleName = ? WHERE RoleId = ?', (name, role_id))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        conn.rollback()
        return False
    finally:
        conn.close()

# Categories
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cats = cursor.execute('SELECT * FROM categories ORDER BY display_order ASC, name ASC').fetchall()
        return [dict(row) for row in cats]
    finally:
        conn.close()

def add_category(name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO categories (name, display_order) VALUES (?, ?)', (name, display_order))
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.rollback()
        return None
    finally:
        conn.close()

def update_category(cat_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE categories SET name = ?, display_order = ? WHERE id = ?',
            (name, display_order, cat_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        conn.rollback()
        return False
    finally:
        conn.close()

def delete_category(cat_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM categories WHERE id = ?', (cat_id,))
        conn.commit()
        return True
    finally:
        conn.close()

# Bank Modes
def get_bank_modes():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        modes = cursor.execute('SELECT * FROM bank_modes ORDER BY display_order ASC, name ASC').fetchall()
        return [dict(row) for row in modes]
    finally:
        conn.close()

def add_bank_mode(name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO bank_modes (name, display_order) VALUES (?, ?)', (name, display_order))
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.rollback()
        return None
    finally:
        conn.close()

def update_bank_mode(bm_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE bank_modes SET name = ?, display_order = ? WHERE id = ?',
            (name, display_order, bm_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        conn.rollback()
        return False
    finally:
        conn.close()

def delete_bank_mode(bm_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM bank_modes WHERE id = ?', (bm_id,))
        conn.commit()
        return True
    finally:
        conn.close()

# Payment Types
def get_payment_types():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        types = cursor.execute('SELECT * FROM payment_types ORDER BY display_order ASC, name ASC').fetchall()
        return [dict(row) for row in types]
    finally:
        conn.close()

def add_payment_type(name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO payment_types (name, display_order) VALUES (?, ?)', (name, display_order))
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.rollback()
        return None
    finally:
        conn.close()

def update_payment_type(pt_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE payment_types SET name = ?, display_order = ? WHERE id = ?',
            (name, display_order, pt_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        conn.rollback()
        return False
    finally:
        conn.close()

def delete_payment_type(pt_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM payment_types WHERE id = ?', (pt_id,))
        conn.commit()
        return True
    finally:
        conn.close()

# Payment Categories
def get_payment_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cats = cursor.execute('SELECT * FROM payment_categories ORDER BY display_order ASC, name ASC').fetchall()
        return [dict(row) for row in cats]
    finally:
        conn.close()

def add_payment_category(name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO payment_categories (name, display_order) VALUES (?, ?)', (name, display_order))
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.rollback()
        return None
    finally:
        conn.close()

def update_payment_category(pc_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE payment_categories SET name = ?, display_order = ? WHERE id = ?',
            (name, display_order, pc_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        conn.rollback()
        return False
    finally:
        conn.close()

def delete_payment_category(pc_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM payment_categories WHERE id = ?', (pc_id,))
        conn.commit()
        return True
    finally:
        conn.close()

def get_user_expense_controls(user_id, control_type):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        rows = cursor.execute(
            "SELECT id, name, display_order FROM user_expense_controls WHERE user_id = ? AND control_type = ? ORDER BY display_order ASC, name ASC",
            (user_id, control_type)
        ).fetchall()
        if not rows:
            # Auto-seed the child table for this user from main tables
            cursor.execute(
                "INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'category', name, display_order FROM categories",
                (user_id,)
            )
            cursor.execute(
                "INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'bank_mode', name, display_order FROM bank_modes",
                (user_id,)
            )
            cursor.execute(
                "INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'payment_type', name, display_order FROM payment_types",
                (user_id,)
            )
            cursor.execute(
                "INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'payment_category', name, display_order FROM payment_categories",
                (user_id,)
            )
            conn.commit()
            
            # Fetch again
            rows = cursor.execute(
                "SELECT id, name, display_order FROM user_expense_controls WHERE user_id = ? AND control_type = ? ORDER BY display_order ASC, name ASC",
                (user_id, control_type)
            ).fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        print(f"Error in get_user_expense_controls: {e}")
        return []
    finally:
        conn.close()

def add_user_expense_control(user_id, control_type, name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO user_expense_controls (user_id, control_type, name, display_order) VALUES (?, ?, ?, ?)',
            (user_id, control_type, name, display_order)
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.rollback()
        return None
    except Exception as e:
        conn.rollback()
        print(f"Error in add_user_expense_control: {e}")
        return None
    finally:
        conn.close()

def update_user_expense_control(user_id, control_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE user_expense_controls SET name = ?, display_order = ? WHERE id = ? AND user_id = ?',
            (name, display_order, control_id, user_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        conn.rollback()
        return False
    except Exception as e:
        conn.rollback()
        print(f"Error in update_user_expense_control: {e}")
        return False
    finally:
        conn.close()

def delete_user_expense_control(user_id, control_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM user_expense_controls WHERE id = ? AND user_id = ?', (control_id, user_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in delete_user_expense_control: {e}")
        return False
    finally:
        conn.close()

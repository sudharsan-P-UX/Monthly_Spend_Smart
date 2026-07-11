from flask import session, jsonify
from functools import wraps
import database

def is_logged_in():
    return 'user_id' in session

def require_privilege(privilege_name, is_global_admin=False):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not is_logged_in():
                return jsonify({'error': 'Unauthorized'}), 401
            privs = database.get_user_privileges(session['user_id'])
            
            if is_global_admin:
                conn = database.get_db_connection()
                cursor = conn.cursor()
                role_row = cursor.execute('SELECT RoleId FROM UserRole WHERE LoginId = ? LIMIT 1', (session['user_id'],)).fetchone()
                conn.close()
                role_id = role_row[0] if role_row else 2
                
                if role_id == 1:
                    pass # Admin always allowed
                elif role_id in (2, 3):
                    return jsonify({'error': 'Forbidden: Global admin privileges required'}), 403
                else:
                    # Custom roles must have the required privilege
                    if not privs.get(privilege_name):
                        return jsonify({'error': f'Forbidden: Missing privilege {privilege_name}'}), 403
            else:
                if privilege_name == 'can_admin':
                    if not privs.get('is_admin'):
                        return jsonify({'error': 'Forbidden: Administrator privileges required'}), 403
                else:
                    if not privs.get(privilege_name):
                        return jsonify({'error': f'Forbidden: Missing privilege {privilege_name}'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

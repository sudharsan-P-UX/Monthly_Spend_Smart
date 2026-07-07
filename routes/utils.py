from flask import session, jsonify
from functools import wraps
import database

def is_logged_in():
    return 'user_id' in session

def require_privilege(privilege_name):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not is_logged_in():
                return jsonify({'error': 'Unauthorized'}), 401
            privs = database.get_user_privileges(session['user_id'])
            if privilege_name == 'can_admin':
                if not privs.get('is_admin'):
                    return jsonify({'error': 'Forbidden: Administrator privileges required'}), 403
            else:
                if not privs.get(privilege_name):
                    return jsonify({'error': f'Forbidden: Missing privilege {privilege_name}'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

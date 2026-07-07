from flask import request, jsonify
from werkzeug.security import generate_password_hash
import database
from routes.utils import require_privilege

def register_admin_users_routes(app):
    @app.route('/api/admin/users', methods=['GET'])
    @require_privilege('can_admin')
    def admin_get_users():
        users = database.get_all_users()
        return jsonify(users)

    @app.route('/api/admin/users/create', methods=['POST'])
    @require_privilege('can_admin')
    def admin_create_user():
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        role_id = data.get('role_id')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        email = data.get('email')
        phone = data.get('phone')
        
        if not username or not password or not role_id:
            return jsonify({'error': 'Username, password, and role are required.'}), 400
            
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters.'}), 400
            
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters.'}), 400
            
        user_id = database.create_user(username, password, int(role_id), first_name, last_name, email, phone)
        
        if user_id:
            return jsonify({'success': True, 'message': 'User created successfully.'})
        else:
            return jsonify({'error': 'Username already exists.'}), 409

    @app.route('/api/admin/users/edit_role', methods=['POST'])
    @require_privilege('can_admin')
    def admin_edit_user_role():
        data = request.get_json()
        user_id = data.get('user_id')
        role_id = data.get('role_id')
        
        if not user_id or not role_id:
            return jsonify({'error': 'User ID and Role ID are required.'}), 400
            
        current_privs = database.get_user_privileges(int(user_id))
        if current_privs.get('is_admin') and int(role_id) != 1:
            users = database.get_all_users()
            admins = [u for u in users if u['role_id'] == 1]
            if len(admins) <= 1:
                return jsonify({'error': 'Cannot change role of the last administrator.'}), 400

        database.update_user_role(int(user_id), int(role_id))
        return jsonify({'success': True, 'message': 'User role updated successfully.'})

    @app.route('/api/admin/users/edit', methods=['POST'])
    @require_privilege('can_admin')
    def admin_edit_user():
        data = request.get_json()
        user_id = data.get('user_id')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        email = data.get('email')
        phone = data.get('phone')
        
        if not user_id:
            return jsonify({'error': 'User ID is required.'}), 400
            
        user = database.get_user_by_id(int(user_id))
        if not user:
            return jsonify({'error': 'User not found.'}), 404
            
        try:
            database.update_user_profile(int(user_id), first_name, last_name, email, phone)
        except Exception as e:
            return jsonify({'error': 'Failed to update user profile.'}), 500
            
        if new_password:
            if len(new_password) < 6:
                return jsonify({'error': 'New password must be at least 6 characters.'}), 400
            if new_password != confirm_password:
                return jsonify({'error': 'Passwords do not match.'}), 400
            success = database.update_user_password(int(user_id), new_password)
            if not success:
                return jsonify({'error': 'Failed to update user password.'}), 500
                
        return jsonify({'success': True, 'message': 'User updated successfully.'})

    @app.route('/api/admin/users/delete/<int:user_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_admin')
    def admin_delete_user(user_id):
        success = database.delete_user(user_id)
        if success:
            return jsonify({'success': True, 'message': 'User deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete user. Ensure it is not the last Administrator.'}), 400

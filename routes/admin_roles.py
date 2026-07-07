from flask import request, jsonify
import database
from routes.utils import require_privilege

def register_admin_roles_routes(app):
    @app.route('/api/admin/roles', methods=['GET'])
    @require_privilege('can_admin')
    def admin_get_roles():
        roles = database.get_roles()
        return jsonify(roles)

    @app.route('/api/admin/roles/create', methods=['POST'])
    @require_privilege('can_admin')
    def admin_create_role():
        data = request.get_json()
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Role name is required.'}), 400
            
        role_id = database.add_role(name)
        if role_id:
            return jsonify({'success': True, 'id': role_id, 'message': 'Role created successfully.'})
        else:
            return jsonify({'error': 'Role already exists.'}), 409

    @app.route('/api/admin/roles/delete/<int:role_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_admin')
    def admin_delete_role(role_id):
        success = database.delete_role(role_id)
        if success:
            return jsonify({'success': True, 'message': 'Role deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete role. Admin role cannot be deleted.'}), 400

    @app.route('/api/admin/privileges/update', methods=['POST'])
    @require_privilege('can_admin')
    def admin_update_privileges():
        data = request.get_json()
        role_id = data.get('role_id')
        can_view = data.get('can_view', 0)
        can_add = data.get('can_add', 0)
        can_edit = data.get('can_edit', 0)
        can_delete = data.get('can_delete', 0)
        
        if not role_id:
            return jsonify({'error': 'Role ID is required.'}), 400
            
        if int(role_id) == 1:
            return jsonify({'error': 'Cannot modify Administrator role privileges.'}), 400
            
        database.update_role_privileges(int(role_id), can_view, can_add, can_edit, can_delete)
        return jsonify({'success': True, 'message': 'Privileges updated successfully.'})

    @app.route('/api/admin/roles/edit', methods=['POST'])
    @require_privilege('can_admin')
    def admin_edit_role_name():
        data = request.get_json()
        role_id = data.get('role_id')
        name = data.get('name', '').strip()
        if not role_id or not name:
            return jsonify({'error': 'Role ID and name are required.'}), 400
        success = database.update_role_name(int(role_id), name)
        if success:
            return jsonify({'success': True, 'message': 'Role name updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update role name. Ensure it is unique.'}), 400

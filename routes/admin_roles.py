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

    @app.route('/api/admin/roles/privileges', methods=['GET'])
    @require_privilege('can_admin')
    def admin_get_role_privileges():
        role_id = request.args.get('role_id')
        if not role_id:
            return jsonify({'error': 'Role ID is required.'}), 400
            
        conn = database.get_db_connection()
        cursor = conn.cursor()
        try:
            default_privileges = [
                "EMI Columns List",
                "Add Custom Column for EMIs",
                "Expense Categories",
                "Create Category",
                "Expense Columns List",
                "Add Custom Column for Expenses",
                "Excel Import & Export Columns",
                "Add Custom Column",
                "All Currencies",
                "Add Currency"
            ]
            for idx, priv in enumerate(default_privileges):
                exists = cursor.execute('SELECT 1 FROM role_privileges WHERE role_id = ? AND privilege_name = ?', (int(role_id), priv)).fetchone()
                if not exists:
                    val = 1 if int(role_id) in (1, 2) else 0
                    cursor.execute(
                        'INSERT INTO role_privileges (role_id, privilege_name, display_order, can_add, can_edit, can_delete, can_view, is_mandatory, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)',
                        (int(role_id), priv, idx + 1, val, val, val, 1)
                    )
            conn.commit()
            
            rows = cursor.execute(
                'SELECT privilege_name, display_order, can_add, can_edit, can_delete, can_view, is_mandatory, is_active FROM role_privileges WHERE role_id = ? ORDER BY display_order ASC',
                (int(role_id),)
            ).fetchall()
            return jsonify([dict(r) for r in rows])
        finally:
            conn.close()

    @app.route('/api/admin/roles/privileges/save', methods=['POST'])
    @require_privilege('can_admin')
    def admin_save_role_privileges():
        data = request.get_json() or {}
        role_id = data.get('role_id')
        privileges = data.get('privileges', [])
        
        if not role_id:
            return jsonify({'error': 'Role ID is required.'}), 400
            
        if int(role_id) == 1:
            return jsonify({'error': 'Cannot modify Administrator role privileges.'}), 400
            
        conn = database.get_db_connection()
        cursor = conn.cursor()
        try:
            for p in privileges:
                cursor.execute(
                    '''UPDATE role_privileges SET 
                        can_add = ?, can_edit = ?, can_delete = ?, can_view = ?, is_mandatory = ?, is_active = ?
                       WHERE role_id = ? AND privilege_name = ?''',
                    (
                        int(p.get('can_add', 1)),
                        int(p.get('can_edit', 1)),
                        int(p.get('can_delete', 1)),
                        int(p.get('can_view', 1)),
                        int(p.get('is_mandatory', 1)),
                        int(p.get('is_active', 1)),
                        int(role_id),
                        p.get('privilege_name')
                    )
                )
            conn.commit()
            return jsonify({'success': True, 'message': 'Role privileges updated successfully.'})
        except Exception as e:
            conn.rollback()
            return jsonify({'error': f'Failed to save privileges: {e}'}), 500
        finally:
            conn.close()

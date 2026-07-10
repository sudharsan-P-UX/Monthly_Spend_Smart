from flask import request, jsonify, session
import database
from routes.utils import is_logged_in

def register_admin_categories_routes(app):
    @app.route('/api/admin/categories/create', methods=['POST'])
    def admin_create_category():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        
        if not name:
            return jsonify({'error': 'Category name is required.'}), 400
            
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            cat_id = database.add_category(name, display_order)
        else:
            cat_id = database.add_user_expense_control(session['user_id'], 'category', name, display_order)
            
        if cat_id:
            return jsonify({'success': True, 'id': cat_id, 'message': 'Category created successfully.'})
        else:
            return jsonify({'error': 'Category name already exists.'}), 409

    @app.route('/api/admin/categories/edit/<int:cat_id>', methods=['POST'])
    def admin_edit_category(cat_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        
        if not name:
            return jsonify({'error': 'Category name is required.'}), 400
            
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            success = database.update_category(cat_id, name, display_order)
        else:
            success = database.update_user_expense_control(session['user_id'], cat_id, name, display_order)
            
        if success:
            return jsonify({'success': True, 'message': 'Category updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update category. Ensure the name is unique.'}), 400

    @app.route('/api/admin/categories/delete/<int:cat_id>', methods=['POST', 'DELETE'])
    def admin_delete_category(cat_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            success = database.delete_category(cat_id)
        else:
            success = database.delete_user_expense_control(session['user_id'], cat_id)
            
        if success:
            return jsonify({'success': True, 'message': 'Category deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete category.'}), 400

from flask import request, jsonify
import database
from routes.utils import require_privilege

def register_admin_categories_routes(app):
    @app.route('/api/admin/categories/create', methods=['POST'])
    @require_privilege('can_admin')
    def admin_create_category():
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        
        if not name:
            return jsonify({'error': 'Category name is required.'}), 400
            
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        cat_id = database.add_category(name, display_order)
        if cat_id:
            return jsonify({'success': True, 'id': cat_id, 'message': 'Category created successfully.'})
        else:
            return jsonify({'error': 'Category name already exists.'}), 409

    @app.route('/api/admin/categories/edit/<int:cat_id>', methods=['POST'])
    @require_privilege('can_admin')
    def admin_edit_category(cat_id):
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        
        if not name:
            return jsonify({'error': 'Category name is required.'}), 400
            
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        success = database.update_category(cat_id, name, display_order)
        if success:
            return jsonify({'success': True, 'message': 'Category updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update category. Ensure the name is unique.'}), 400

    @app.route('/api/admin/categories/delete/<int:cat_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_admin')
    def admin_delete_category(cat_id):
        success = database.delete_category(cat_id)
        if success:
            return jsonify({'success': True, 'message': 'Category deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete category.'}), 400

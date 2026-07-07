from flask import request, jsonify
import database
from routes.utils import is_logged_in, require_privilege

def register_admin_dropdowns_routes(app):
    @app.route('/api/bank_modes', methods=['GET'])
    def get_bank_modes_api():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        modes = database.get_bank_modes()
        return jsonify(modes)

    @app.route('/api/payment_types', methods=['GET'])
    def get_payment_types_api():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        types = database.get_payment_types()
        return jsonify(types)

    @app.route('/api/payment_categories', methods=['GET'])
    def get_payment_categories_api():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        cats = database.get_payment_categories()
        return jsonify(cats)

    # ADMIN BANK MODES CRUD
    @app.route('/api/admin/bank_modes/create', methods=['POST'])
    @require_privilege('can_admin')
    def admin_create_bank_mode():
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
        bm_id = database.add_bank_mode(name, display_order)
        if bm_id:
            return jsonify({'success': True, 'id': bm_id, 'message': 'Bank Mode created successfully.'})
        else:
            return jsonify({'error': 'Name already exists.'}), 409

    @app.route('/api/admin/bank_modes/edit/<int:bm_id>', methods=['POST'])
    @require_privilege('can_admin')
    def admin_edit_bank_mode(bm_id):
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
        success = database.update_bank_mode(bm_id, name, display_order)
        if success:
            return jsonify({'success': True, 'message': 'Bank Mode updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update. Ensure name is unique.'}), 400

    @app.route('/api/admin/bank_modes/delete/<int:bm_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_admin')
    def admin_delete_bank_mode(bm_id):
        success = database.delete_bank_mode(bm_id)
        if success:
            return jsonify({'success': True, 'message': 'Bank Mode deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete.'}), 400

    # ADMIN PAYMENT TYPES CRUD
    @app.route('/api/admin/payment_types/create', methods=['POST'])
    @require_privilege('can_admin')
    def admin_create_payment_type():
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
        pt_id = database.add_payment_type(name, display_order)
        if pt_id:
            return jsonify({'success': True, 'id': pt_id, 'message': 'Payment Type created successfully.'})
        else:
            return jsonify({'error': 'Name already exists.'}), 409

    @app.route('/api/admin/payment_types/edit/<int:pt_id>', methods=['POST'])
    @require_privilege('can_admin')
    def admin_edit_payment_type(pt_id):
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
        success = database.update_payment_type(pt_id, name, display_order)
        if success:
            return jsonify({'success': True, 'message': 'Payment Type updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update. Ensure name is unique.'}), 400

    @app.route('/api/admin/payment_types/delete/<int:pt_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_admin')
    def admin_delete_payment_type(pt_id):
        success = database.delete_payment_type(pt_id)
        if success:
            return jsonify({'success': True, 'message': 'Payment Type deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete.'}), 400

    # ADMIN PAYMENT CATEGORIES CRUD
    @app.route('/api/admin/payment_categories/create', methods=['POST'])
    @require_privilege('can_admin')
    def admin_create_payment_category():
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
        pc_id = database.add_payment_category(name, display_order)
        if pc_id:
            return jsonify({'success': True, 'id': pc_id, 'message': 'Payment Category created successfully.'})
        else:
            return jsonify({'error': 'Name already exists.'}), 409

    @app.route('/api/admin/payment_categories/edit/<int:pc_id>', methods=['POST'])
    @require_privilege('can_admin')
    def admin_edit_payment_category(pc_id):
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
        success = database.update_payment_category(pc_id, name, display_order)
        if success:
            return jsonify({'success': True, 'message': 'Payment Category updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update. Ensure name is unique.'}), 400

    @app.route('/api/admin/payment_categories/delete/<int:pc_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_admin')
    def admin_delete_payment_category(pc_id):
        success = database.delete_payment_category(pc_id)
        if success:
            return jsonify({'success': True, 'message': 'Payment Category deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete.'}), 400

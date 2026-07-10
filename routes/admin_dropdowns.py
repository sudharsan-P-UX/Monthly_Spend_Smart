from flask import request, jsonify, session
import database
from routes.utils import is_logged_in

def register_admin_dropdowns_routes(app):
    @app.route('/api/bank_modes', methods=['GET'])
    def get_bank_modes_api():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            modes = database.get_bank_modes()
        else:
            modes = database.get_user_expense_controls(session['user_id'], 'bank_mode')
        return jsonify(modes)

    @app.route('/api/payment_types', methods=['GET'])
    def get_payment_types_api():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            types = database.get_payment_types()
        else:
            types = database.get_user_expense_controls(session['user_id'], 'payment_type')
        return jsonify(types)

    @app.route('/api/payment_categories', methods=['GET'])
    def get_payment_categories_api():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            cats = database.get_payment_categories()
        else:
            cats = database.get_user_expense_controls(session['user_id'], 'payment_category')
        return jsonify(cats)

    # ADMIN BANK MODES CRUD
    @app.route('/api/admin/bank_modes/create', methods=['POST'])
    def admin_create_bank_mode():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            bm_id = database.add_bank_mode(name, display_order)
        else:
            bm_id = database.add_user_expense_control(session['user_id'], 'bank_mode', name, display_order)
            
        if bm_id:
            return jsonify({'success': True, 'id': bm_id, 'message': 'Bank Mode created successfully.'})
        else:
            return jsonify({'error': 'Name already exists.'}), 409

    @app.route('/api/admin/bank_modes/edit/<int:bm_id>', methods=['POST'])
    def admin_edit_bank_mode(bm_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            success = database.update_bank_mode(bm_id, name, display_order)
        else:
            success = database.update_user_expense_control(session['user_id'], bm_id, name, display_order)
            
        if success:
            return jsonify({'success': True, 'message': 'Bank Mode updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update. Ensure name is unique.'}), 400

    @app.route('/api/admin/bank_modes/delete/<int:bm_id>', methods=['POST', 'DELETE'])
    def admin_delete_bank_mode(bm_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            success = database.delete_bank_mode(bm_id)
        else:
            success = database.delete_user_expense_control(session['user_id'], bm_id)
            
        if success:
            return jsonify({'success': True, 'message': 'Bank Mode deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete.'}), 400

    # ADMIN PAYMENT TYPES CRUD
    @app.route('/api/admin/payment_types/create', methods=['POST'])
    def admin_create_payment_type():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            pt_id = database.add_payment_type(name, display_order)
        else:
            pt_id = database.add_user_expense_control(session['user_id'], 'payment_type', name, display_order)
            
        if pt_id:
            return jsonify({'success': True, 'id': pt_id, 'message': 'Payment Type created successfully.'})
        else:
            return jsonify({'error': 'Name already exists.'}), 409

    @app.route('/api/admin/payment_types/edit/<int:pt_id>', methods=['POST'])
    def admin_edit_payment_type(pt_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            success = database.update_payment_type(pt_id, name, display_order)
        else:
            success = database.update_user_expense_control(session['user_id'], pt_id, name, display_order)
            
        if success:
            return jsonify({'success': True, 'message': 'Payment Type updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update. Ensure name is unique.'}), 400

    @app.route('/api/admin/payment_types/delete/<int:pt_id>', methods=['POST', 'DELETE'])
    def admin_delete_payment_type(pt_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            success = database.delete_payment_type(pt_id)
        else:
            success = database.delete_user_expense_control(session['user_id'], pt_id)
            
        if success:
            return jsonify({'success': True, 'message': 'Payment Type deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete.'}), 400

    # ADMIN PAYMENT CATEGORIES CRUD
    @app.route('/api/admin/payment_categories/create', methods=['POST'])
    def admin_create_payment_category():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            pc_id = database.add_payment_category(name, display_order)
        else:
            pc_id = database.add_user_expense_control(session['user_id'], 'payment_category', name, display_order)
            
        if pc_id:
            return jsonify({'success': True, 'id': pc_id, 'message': 'Payment Category created successfully.'})
        else:
            return jsonify({'error': 'Name already exists.'}), 409

    @app.route('/api/admin/payment_categories/edit/<int:pc_id>', methods=['POST'])
    def admin_edit_payment_category(pc_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            success = database.update_payment_category(pc_id, name, display_order)
        else:
            success = database.update_user_expense_control(session['user_id'], pc_id, name, display_order)
            
        if success:
            return jsonify({'success': True, 'message': 'Payment Category updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update. Ensure name is unique.'}), 400

    @app.route('/api/admin/payment_categories/delete/<int:pc_id>', methods=['POST', 'DELETE'])
    def admin_delete_payment_category(pc_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            success = database.delete_payment_category(pc_id)
        else:
            success = database.delete_user_expense_control(session['user_id'], pc_id)
            
        if success:
            return jsonify({'success': True, 'message': 'Payment Category deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete.'}), 400

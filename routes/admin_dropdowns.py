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
            
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'add')
        
        if is_global:
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
            
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'edit')
        
        if is_global:
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
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'delete')
        
        if is_global:
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
            
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'add')
        
        if is_global:
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
            
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'edit')
        
        if is_global:
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
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'delete')
        
        if is_global:
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
            
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'add')
        
        if is_global:
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
            
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'edit')
        
        if is_global:
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
        is_global = database.check_backend_privilege(session['user_id'], 'Create Category', 'delete')
        
        if is_global:
            success = database.delete_payment_category(pc_id)
        else:
            success = database.delete_user_expense_control(session['user_id'], pc_id)
            
        if success:
            return jsonify({'success': True, 'message': 'Payment Category deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete.'}), 400

    # ADMIN MANAGE LISTS API ENDPOINTS
    @app.route('/api/admin/manage_lists', methods=['GET'])
    def admin_get_manage_lists():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        lists = database.get_manage_lists()
        return jsonify(lists)

    @app.route('/api/admin/manage_lists/create', methods=['POST'])
    def admin_create_manage_list_endpoint():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Manage List Name is required.'}), 400
        key = database.create_manage_list(name)
        if key:
            return jsonify({'success': True, 'key': key, 'message': 'Manage List created successfully.'})
        else:
            return jsonify({'error': 'Failed to create Manage List.'}), 400

    @app.route('/api/admin/manage_lists/edit/<key>', methods=['POST'])
    def admin_edit_manage_list_endpoint(key):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Manage List Name is required.'}), 400
        success = database.update_manage_list_name(key, name)
        if success:
            return jsonify({'success': True, 'message': 'Manage List name updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update Manage List name.'}), 400

    @app.route('/api/admin/manage_lists/toggle/<key>', methods=['POST'])
    def admin_toggle_manage_list_endpoint(key):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json() or {}
        is_active = data.get('is_active', 1)
        success = database.toggle_manage_list_status(key, is_active)
        if success:
            return jsonify({'success': True, 'message': 'Manage List status updated successfully.'})
        else:
            return jsonify({'error': 'Failed to toggle status.'}), 400

    @app.route('/api/admin/manage_lists/delete/<key>', methods=['POST', 'DELETE'])
    def admin_delete_manage_list_endpoint(key):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        success = database.delete_manage_list(key)
        if success:
            return jsonify({'success': True, 'message': 'Manage List deleted successfully.'})
        else:
            return jsonify({'error': 'Default Manage Lists cannot be deleted.'}), 400

    @app.route('/api/admin/manage_lists/subitems/<key>', methods=['GET'])
    def admin_get_manage_list_subitems(key):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        is_admin = user_privs.get('is_admin')
        
        if key == 'categories':
            items = database.get_categories() if is_admin else database.get_user_expense_controls(session['user_id'], 'category')
        elif key in ('bank-modes', 'bank_mode'):
            items = database.get_bank_modes() if is_admin else database.get_user_expense_controls(session['user_id'], 'bank_mode')
        elif key in ('payment-types', 'payment_type'):
            items = database.get_payment_types() if is_admin else database.get_user_expense_controls(session['user_id'], 'payment_type')
        elif key in ('payment-categories', 'payment_category'):
            items = database.get_payment_categories() if is_admin else database.get_user_expense_controls(session['user_id'], 'payment_category')
        else:
            items = database.get_user_expense_controls(session['user_id'], key)
        return jsonify(items)

    @app.route('/api/admin/manage_lists/subitems/add', methods=['POST'])
    def admin_add_manage_list_subitem():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json() or {}
        key = data.get('key', '').strip()
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not key or not name:
            return jsonify({'error': 'Key and Name are required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        is_admin = user_privs.get('is_admin')

        if key == 'categories':
            item_id = database.add_category(name, display_order) if is_admin else database.add_user_expense_control(session['user_id'], 'category', name, display_order)
        elif key in ('bank-modes', 'bank_mode'):
            item_id = database.add_bank_mode(name, display_order) if is_admin else database.add_user_expense_control(session['user_id'], 'bank_mode', name, display_order)
        elif key in ('payment-types', 'payment_type'):
            item_id = database.add_payment_type(name, display_order) if is_admin else database.add_user_expense_control(session['user_id'], 'payment_type', name, display_order)
        elif key in ('payment-categories', 'payment_category'):
            item_id = database.add_payment_category(name, display_order) if is_admin else database.add_user_expense_control(session['user_id'], 'payment_category', name, display_order)
        else:
            item_id = database.add_user_expense_control(session['user_id'], key, name, display_order)

        if item_id:
            return jsonify({'success': True, 'id': item_id, 'message': 'Sub-item created successfully.'})
        else:
            return jsonify({'error': 'Failed to create sub-item. Name may already exist.'}), 400

    @app.route('/api/admin/manage_lists/subitems/edit/<key>/<int:sub_id>', methods=['POST'])
    def admin_edit_manage_list_subitem(key, sub_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)
        if not name:
            return jsonify({'error': 'Name is required.'}), 400
        try:
            display_order = int(display_order)
        except ValueError:
            display_order = 0
            
        user_privs = database.get_user_privileges(session['user_id'])
        is_admin = user_privs.get('is_admin')

        if key == 'categories':
            success = database.update_category(sub_id, name, display_order) if is_admin else database.update_user_expense_control(session['user_id'], sub_id, name, display_order)
        elif key in ('bank-modes', 'bank_mode'):
            success = database.update_bank_mode(sub_id, name, display_order) if is_admin else database.update_user_expense_control(session['user_id'], sub_id, name, display_order)
        elif key in ('payment-types', 'payment_type'):
            success = database.update_payment_type(sub_id, name, display_order) if is_admin else database.update_user_expense_control(session['user_id'], sub_id, name, display_order)
        elif key in ('payment-categories', 'payment_category'):
            success = database.update_payment_category(sub_id, name, display_order) if is_admin else database.update_user_expense_control(session['user_id'], sub_id, name, display_order)
        else:
            success = database.update_user_expense_control(session['user_id'], sub_id, name, display_order)

        if success:
            return jsonify({'success': True, 'message': 'Sub-item updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update sub-item.'}), 400

    @app.route('/api/admin/manage_lists/subitems/delete/<key>/<int:sub_id>', methods=['POST', 'DELETE'])
    def admin_delete_manage_list_subitem(key, sub_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        is_admin = user_privs.get('is_admin')

        if key == 'categories':
            success = database.delete_category(sub_id) if is_admin else database.delete_user_expense_control(session['user_id'], sub_id)
        elif key in ('bank-modes', 'bank_mode'):
            success = database.delete_bank_mode(sub_id) if is_admin else database.delete_user_expense_control(session['user_id'], sub_id)
        elif key in ('payment-types', 'payment_type'):
            success = database.delete_payment_type(sub_id) if is_admin else database.delete_user_expense_control(session['user_id'], sub_id)
        elif key in ('payment-categories', 'payment_category'):
            success = database.delete_payment_category(sub_id) if is_admin else database.delete_user_expense_control(session['user_id'], sub_id)
        else:
            success = database.delete_user_expense_control(session['user_id'], sub_id)

        if success:
            return jsonify({'success': True, 'message': 'Sub-item deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete sub-item.'}), 400


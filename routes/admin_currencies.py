from flask import request, jsonify, session
import database
from routes.utils import is_logged_in, require_privilege

def register_admin_currencies_routes(app):
    @app.route('/api/active-currency', methods=['GET'])
    def api_get_active_currency():
        user_id = session.get('user_id')
        curr = database.get_active_currency(user_id)
        return jsonify(curr)

    @app.route('/api/admin/currencies', methods=['GET'])
    def admin_get_currencies():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        currs = database.get_all_currencies()
        return jsonify(currs)

    @app.route('/api/admin/currencies/add', methods=['POST'])
    def admin_add_currency():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        if not database.check_backend_privilege(session['user_id'], 'Add Currency', 'add'):
            return jsonify({'error': 'Forbidden: Missing privilege Add Currency'}), 403
        data = request.get_json() or {}
        country = data.get('country', '').strip()
        country_desc = data.get('country_desc', '').strip()
        symbol = data.get('symbol', '').strip()
        
        if not country or not country_desc or not symbol:
            return jsonify({'error': 'Country, description, and symbol are required.'}), 400
            
        res_id = database.add_currency(country, country_desc, symbol)
        if res_id is not None:
            return jsonify({'success': True, 'id': res_id, 'message': 'Currency added successfully.'})
        else:
            return jsonify({'error': 'Failed to add currency. Ensure country name is unique.'}), 400

    @app.route('/api/admin/currencies/edit/<int:curr_id>', methods=['POST'])
    def admin_edit_currency(curr_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        if not database.check_backend_privilege(session['user_id'], 'All Currencies', 'edit'):
            return jsonify({'error': 'Forbidden: Missing privilege All Currencies'}), 403
        data = request.get_json() or {}
        country = data.get('country', '').strip()
        country_desc = data.get('country_desc', '').strip()
        symbol = data.get('symbol', '').strip()
        
        if not country or not country_desc or not symbol:
            return jsonify({'error': 'Country, description, and symbol are required.'}), 400
            
        success = database.update_currency(curr_id, country, country_desc, symbol)
        if success:
            return jsonify({'success': True, 'message': 'Currency updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update. Ensure country name is unique.'}), 400

    @app.route('/api/admin/currencies/set_active/<int:curr_id>', methods=['POST'])
    def admin_set_active_currency(curr_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        success = database.set_active_currency(curr_id, session.get('user_id'))
        if success:
            return jsonify({'success': True, 'message': 'Active currency changed successfully.'})
        else:
            return jsonify({'error': 'Failed to set active currency.'}), 400

    @app.route('/api/admin/currencies/delete/<int:curr_id>', methods=['POST', 'DELETE'])
    def admin_delete_currency(curr_id):
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        if not database.check_backend_privilege(session['user_id'], 'All Currencies', 'delete'):
            return jsonify({'error': 'Forbidden: Missing privilege All Currencies'}), 403
        success = database.delete_currency(curr_id)
        if success:
            return jsonify({'success': True, 'message': 'Currency deleted successfully.'})
        else:
            return jsonify({'error': 'Failed to delete currency.'}), 400

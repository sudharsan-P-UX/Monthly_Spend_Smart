from flask import request, jsonify
import database
from routes.utils import require_privilege

def register_admin_settings_routes(app):
    @app.route('/api/settings/public', methods=['GET'])
    def get_public_settings():
        reg_email = database.get_setting('register_email_otp_enabled', '0')
        reg_phone = database.get_setting('register_phone_otp_enabled', '0')
        login_otp = database.get_setting('login_otp_enabled', '0')
        return jsonify({
            'registration_otp_enabled': (reg_email == '1' or reg_phone == '1'),
            'register_email_otp_enabled': reg_email == '1',
            'register_phone_otp_enabled': reg_phone == '1',
            'login_otp_enabled': login_otp == '1'
        })

    @app.route('/api/admin/settings', methods=['GET'])
    @require_privilege('can_admin')
    def admin_get_settings():
        reg_email = database.get_setting('register_email_otp_enabled', '0')
        reg_phone = database.get_setting('register_phone_otp_enabled', '0')
        login_otp = database.get_setting('login_otp_enabled', '0')
        return jsonify({
            'registration_otp_enabled': (reg_email == '1' or reg_phone == '1'),
            'register_email_otp_enabled': reg_email == '1',
            'register_phone_otp_enabled': reg_phone == '1',
            'login_otp_enabled': login_otp == '1'
        })

    @app.route('/api/admin/settings/update', methods=['POST'])
    @require_privilege('can_admin')
    def admin_update_settings():
        data = request.get_json() or {}
        reg_email = '1' if data.get('register_email_otp_enabled') else '0'
        reg_phone = '1' if data.get('register_phone_otp_enabled') else '0'
        login_enabled = '1' if data.get('login_otp_enabled') else '0'
        
        database.set_setting('register_email_otp_enabled', reg_email)
        database.set_setting('register_phone_otp_enabled', reg_phone)
        database.set_setting('login_otp_enabled', login_enabled)
        
        return jsonify({'success': True, 'message': 'Security settings updated successfully.'})

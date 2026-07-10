from flask import render_template, redirect, url_for, session, request, jsonify, current_app
from werkzeug.security import check_password_hash, generate_password_hash
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
import os
import random
import secrets
import datetime
import database
import database.users
import database.VercelDb

# Dictionary to hold temporary login tokens for MFA
temp_login_tokens = {}

def is_logged_in():
    return 'user_id' in session

def register_login_routes(app):
    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if is_logged_in():
            return redirect(url_for('index'))
            
        if request.method == 'POST':
            try:
                data = request.get_json() if request.is_json else request.form
                username = data.get('username', '').strip()
                password = data.get('password', '')
                
                if not username or not password:
                    return jsonify({'success': False, 'message': 'Username and password are required.'}), 400
                    
                user = database.users.verify_user_password(username, password)
                if user:
                    # Check password expiry
                    if database.VercelDb.check_password_expiry(user['id']):
                        return jsonify({'success': False, 'expired': True, 'message': 'Your password has expired (90 days limit). Please reset your password.'}), 403

                    is_testing = app.testing
                    if is_testing:
                        session['user_id'] = user['id']
                        session['username'] = user['username']
                        database.VercelDb.log_user_login(user['id'], request.headers.get('User-Agent', 'Unknown'))
                        return jsonify({'success': True, 'message': 'Logged in successfully.'})
                    
                    login_otp_enabled = database.get_setting('login_otp_enabled', '1') == '1'
                    if not login_otp_enabled:
                        session['user_id'] = user['id']
                        session['username'] = user['username']
                        database.VercelDb.log_user_login(user['id'], request.headers.get('User-Agent', 'Unknown'))
                        return jsonify({'success': True, 'message': 'Logged in successfully.'})
                    
                    mfa_target = user['phone'] if user['phone'] else user['username']
                    login_otp = f"{random.randint(100000, 999999)}"
                    database.create_otp(mfa_target, login_otp)
                    print(f"\n[MOCK MFA] Sent login verification OTP {login_otp} to {mfa_target}\n", flush=True)
                    
                    serializer = URLSafeTimedSerializer(current_app.config.get('SECRET_KEY', 'default_secret_key_123'))
                    temp_token = serializer.dumps({
                        'user_id': user['id'],
                        'mfa_target': mfa_target
                    })
                    return jsonify({
                        'mfa_required': True,
                        'temp_token': temp_token,
                        'mfa_target': mfa_target
                    })
                else:
                    return jsonify({'success': False, 'message': 'Invalid username or password.'}), 401
            except Exception as e:
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'error': f'Server exception: {str(e)}'}), 500
                
        return render_template('login.html')

    @app.route('/api/otp/send', methods=['POST'])
    def api_send_otp():
        data = request.get_json() or {}
        target = data.get('target', '').strip()
        if not target:
            return jsonify({'error': 'Target email or phone is required.'}), 400
            
        conn = database.get_db_connection()
        user = conn.cursor().execute("SELECT * FROM Refusers WHERE Email = ? OR Phone = ?", (target, target)).fetchone()
        conn.close()
        if user:
            return jsonify({'error': 'This email or phone number is already registered.'}), 400

        otp_code = f"{random.randint(100000, 999999)}"
        success = database.create_otp(target, otp_code)
        if success:
            print(f"\n[MOCK OTP] Sent OTP {otp_code} to {target}\n", flush=True)
            return jsonify({'success': True, 'message': 'OTP code sent.'})
        else:
            return jsonify({'error': 'Failed to generate OTP.'}), 500

    @app.route('/api/otp/verify', methods=['POST'])
    def api_verify_otp():
        data = request.get_json() or {}
        target = data.get('target', '').strip()
        otp_code = data.get('otp_code', '').strip()
        if not target or not otp_code:
            return jsonify({'error': 'Target and OTP code are required.'}), 400
            
        verified = database.verify_otp(target, otp_code)
        if verified:
            return jsonify({'success': True, 'message': 'OTP verified.'})
        else:
            return jsonify({'error': 'Invalid or expired OTP code.'}), 400

    @app.route('/api/login/mfa', methods=['POST'])
    def api_login_mfa():
        data = request.get_json() or {}
        temp_token = data.get('temp_token', '').strip()
        otp_code = data.get('otp_code', '').strip()
        
        if not temp_token or not otp_code:
            return jsonify({'error': 'Token and OTP code are required.'}), 400
            
        serializer = URLSafeTimedSerializer(current_app.config.get('SECRET_KEY', 'default_secret_key_123'))
        try:
            token_data = serializer.loads(temp_token, max_age=300)
        except SignatureExpired:
            return jsonify({'error': 'MFA session expired.'}), 400
        except BadSignature:
            return jsonify({'error': 'MFA session not found.'}), 400
            
        verified = database.verify_otp(token_data['mfa_target'], otp_code)
        if verified:
            user = database.get_user_by_id(token_data['user_id'])
            if user:
                session['user_id'] = user['id']
                session['username'] = user['username']
                database.VercelDb.log_user_login(user['id'], request.headers.get('User-Agent', 'Unknown'), otp_code)
                return jsonify({'success': True, 'message': 'Logged in successfully.'})
                
        return jsonify({'error': 'Invalid or expired OTP code.'}), 400

    @app.route('/api/verify-username', methods=['GET', 'POST'])
    def verify_username():
        if request.method == 'POST':
            data = request.get_json() if request.is_json else request.form
            username = data.get('username', '').strip()
        else:
            username = request.args.get('username', '').strip()
            
        if not username:
            return jsonify({'exists': False, 'message': 'Username is required.'}), 400
            
        user = database.get_user_by_username(username)
        if user:
            return jsonify({'exists': True})
        else:
            return jsonify({'exists': False})

    @app.route('/api/change-password', methods=['POST'])
    def change_password():
        data = request.get_json() if request.is_json else request.form
        username = data.get('username', '').strip()
        new_password = data.get('new_password', '')
        confirm_password = data.get('confirm_password', '')
        
        if not username or not new_password or not confirm_password:
            return jsonify({'success': False, 'message': 'Username, new password, and confirmation are required.'}), 400
            
        if len(new_password) < 6:
            return jsonify({'success': False, 'message': 'New password must be at least 6 characters.'}), 400
            
        if new_password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match.'}), 400
            
        user = database.get_user_by_username(username)
        if not user:
            return jsonify({'success': False, 'message': 'Username does not exist.'}), 404
            
        success = database.update_user_password_by_username(username, new_password)
        
        if success:
            return jsonify({'success': True, 'message': 'Password changed successfully.'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update password.'}), 500

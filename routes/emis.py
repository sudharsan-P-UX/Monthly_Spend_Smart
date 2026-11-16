from flask import request, jsonify, session
import datetime
import database
from routes.utils import require_privilege

def register_emi_routes(app):
    @app.route('/api/emis', methods=['GET'])
    @require_privilege('can_view')
    def get_emis_api():
        emis = database.get_emis(session['user_id'])
        return jsonify(emis)

    @app.route('/api/emis/add', methods=['POST'])
    @require_privilege('can_add')
    def add_emi_api():
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        principal_amount = data.get('principal_amount', 0.0)
        emi_amount = data.get('emi_amount')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        tenure_months = data.get('tenure_months')
        interest_rate = data.get('interest_rate', 0.0)
        due_date = data.get('due_date', '').strip()
        payment_type = data.get('payment_type', '').strip()
        payment_gateway = data.get('payment_gateway', '').strip()
        payment_bank = data.get('payment_bank', '').strip()
        createddate = data.get('createddate')
        if not createddate:
            createddate = datetime.datetime.now().strftime('%Y-%m-%d')
        
        if not name or emi_amount is None or not start_date or not end_date or not tenure_months or not due_date or not payment_type:
            return jsonify({'error': 'Name, EMI Amount, Start/End Date, Tenure, Due Date, and Payment Type are required.'}), 400
            
        try:
            principal_amount = float(principal_amount)
            emi_amount = float(emi_amount)
            interest_rate = float(interest_rate)
            tenure_months = int(tenure_months)
        except ValueError:
            return jsonify({'error': 'Numeric fields must contain valid numbers.'}), 400
            
        standard_keys = {
            'name', 'principal_amount', 'emi_amount', 'start_date', 'end_date', 
            'tenure_months', 'interest_rate', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank', 'createddate'
        }
        extra_fields = {k: v for k, v in data.items() if k not in standard_keys}
            
        emi_id = database.add_emi(
            session['user_id'], name, principal_amount, emi_amount, start_date, end_date, tenure_months, interest_rate, due_date, payment_type, payment_gateway, payment_bank,
            createddate=createddate,
            **extra_fields
        )
        return jsonify({'success': True, 'id': emi_id, 'message': 'EMI added successfully.'})

    @app.route('/api/emis/edit/<int:emi_id>', methods=['POST'])
    @require_privilege('can_edit')
    def edit_emi_api(emi_id):
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        principal_amount = data.get('principal_amount', 0.0)
        emi_amount = data.get('emi_amount')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        tenure_months = data.get('tenure_months')
        interest_rate = data.get('interest_rate', 0.0)
        due_date = data.get('due_date', '').strip()
        payment_type = data.get('payment_type', '').strip()
        payment_gateway = data.get('payment_gateway', '').strip()
        payment_bank = data.get('payment_bank', '').strip()
        createddate = data.get('createddate')
        if not createddate:
            createddate = datetime.datetime.now().strftime('%Y-%m-%d')
        
        if not name or emi_amount is None or not start_date or not end_date or not tenure_months or not due_date or not payment_type:
            return jsonify({'error': 'Name, EMI Amount, Start/End Date, Tenure, Due Date, and Payment Type are required.'}), 400
            
        try:
            principal_amount = float(principal_amount)
            emi_amount = float(emi_amount)
            interest_rate = float(interest_rate)
            tenure_months = int(tenure_months)
        except ValueError:
            return jsonify({'error': 'Numeric fields must contain valid numbers.'}), 400
            
        standard_keys = {
            'name', 'principal_amount', 'emi_amount', 'start_date', 'end_date', 
            'tenure_months', 'interest_rate', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank', 'createddate'
        }
        extra_fields = {k: v for k, v in data.items() if k not in standard_keys}
            
        success = database.update_emi(
            emi_id, name, principal_amount, emi_amount, start_date, end_date, tenure_months, interest_rate, due_date, payment_type, payment_gateway, payment_bank, user_id=session['user_id'],
            createddate=createddate,
            **extra_fields
        )
        if success:
            return jsonify({'success': True, 'message': 'EMI updated successfully.'})
        else:
            return jsonify({'error': 'EMI not found or update failed.'}), 404

    @app.route('/api/emis/delete/<int:emi_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_delete')
    def delete_emi_api(emi_id):
        success = database.delete_emi(emi_id, session['user_id'])
        if success:
            return jsonify({'success': True, 'message': 'EMI deleted successfully.'})
        else:
            return jsonify({'error': 'EMI not found or deletion failed.'}), 404

    @app.route('/api/emis/delete-bulk', methods=['POST'])
    @require_privilege('can_delete')
    def delete_emis_bulk_api():
        try:
            data = request.get_json() or {}
            emi_ids = data.get('emi_ids', [])
            if not emi_ids:
                return jsonify({'error': 'No EMIs selected.'}), 400
            emi_ids = [int(eid) for eid in emi_ids]
            success = database.delete_emis_bulk(emi_ids, session['user_id'])
            if success:
                return jsonify({'success': True, 'message': 'Selected EMIs deleted successfully.'})
            else:
                return jsonify({'error': 'Deletion failed.'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # ------------------------------------------------------------------
    # Record EMI Payment – transaction-type drives EMI status
    #
    # POST /api/emis/<emi_id>/record-payment
    # Body: { "transaction_type": "Foreclosure|Part Payment|Regular Close|Settlement" }
    #
    # Rules:
    #   Foreclosure    → EMI becomes Inactive after save
    #   Part Payment   → EMI remains Active
    #   Regular Close  → EMI becomes Inactive after save  (default)
    #   Settlement     → EMI becomes Inactive after save
    # ------------------------------------------------------------------
    VALID_TRANSACTION_TYPES = {'Foreclosure', 'Part Payment', 'Regular Close', 'Settlement'}

    @app.route('/api/emis/<int:emi_id>/record-payment', methods=['POST'])
    @require_privilege('can_edit')
    def record_emi_payment_api(emi_id):
        data = request.get_json() or {}
        transaction_type = (data.get('transaction_type') or 'Regular Close').strip()

        if transaction_type not in VALID_TRANSACTION_TYPES:
            return jsonify({
                'error': f'Invalid transaction type. Must be one of: {", ".join(sorted(VALID_TRANSACTION_TYPES))}'
            }), 400

        try:
            result = database.record_emi_payment(emi_id, session['user_id'], transaction_type)
            if result['deactivated']:
                msg = f'EMI marked as Inactive after {transaction_type}.'
            else:
                msg = f'Part Payment recorded. EMI remains Active.'
            return jsonify({
                'success': True,
                'message': msg,
                'deactivated': result['deactivated'],
                'transaction_type': result['transaction_type']
            })
        except ValueError as e:
            # Guard: attempting to record against an already-inactive EMI
            return jsonify({'error': str(e)}), 400
        except LookupError as e:
            return jsonify({'error': str(e)}), 404
        except Exception as e:
            return jsonify({'error': f'Failed to record payment: {str(e)}'}), 500


    @app.route('/api/admin/emis', methods=['GET'])
    @require_privilege('can_admin')
    def admin_get_emis():
        emis = database.get_all_emis()
        return jsonify(emis)

    @app.route('/api/admin/emis/create', methods=['POST'])
    @require_privilege('can_admin')
    def admin_create_emi():
        data = request.get_json() or {}
        user_id = data.get('user_id')
        name = data.get('name', '').strip()
        principal_amount = data.get('principal_amount', 0.0)
        emi_amount = data.get('emi_amount')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        tenure_months = data.get('tenure_months')
        interest_rate = data.get('interest_rate', 0.0)
        due_date = data.get('due_date', '').strip()
        payment_type = data.get('payment_type', '').strip()
        payment_gateway = data.get('payment_gateway', '').strip()
        payment_bank = data.get('payment_bank', '').strip()
        createddate = data.get('createddate')
        if not createddate:
            createddate = datetime.datetime.now().strftime('%Y-%m-%d')
        
        if not user_id or not name or emi_amount is None or not start_date or not end_date or not tenure_months or not due_date or not payment_type:
            return jsonify({'error': 'User, Name, EMI Amount, Start/End Date, Tenure, Due Date, and Payment Type are required.'}), 400
            
        try:
            user_id = int(user_id)
            principal_amount = float(principal_amount)
            emi_amount = float(emi_amount)
            interest_rate = float(interest_rate)
            tenure_months = int(tenure_months)
        except ValueError:
            return jsonify({'error': 'Numeric fields must contain valid numbers.'}), 400
            
        standard_keys = {
            'user_id', 'name', 'principal_amount', 'emi_amount', 'start_date', 'end_date', 
            'tenure_months', 'interest_rate', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank', 'createddate'
        }
        extra_fields = {k: v for k, v in data.items() if k not in standard_keys}
            
        emi_id = database.add_emi(
            user_id, name, principal_amount, emi_amount, start_date, end_date, tenure_months, interest_rate, due_date, payment_type, payment_gateway, payment_bank,
            createddate=createddate,
            **extra_fields
        )
        return jsonify({'success': True, 'id': emi_id, 'message': 'EMI created successfully.'})

    @app.route('/api/admin/emis/edit/<int:emi_id>', methods=['POST'])
    @require_privilege('can_admin')
    def admin_edit_emi(emi_id):
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        principal_amount = data.get('principal_amount', 0.0)
        emi_amount = data.get('emi_amount')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        tenure_months = data.get('tenure_months')
        interest_rate = data.get('interest_rate', 0.0)
        due_date = data.get('due_date', '').strip()
        payment_type = data.get('payment_type', '').strip()
        payment_gateway = data.get('payment_gateway', '').strip()
        payment_bank = data.get('payment_bank', '').strip()
        createddate = data.get('createddate')
        if not createddate:
            createddate = datetime.datetime.now().strftime('%Y-%m-%d')
        
        if not name or emi_amount is None or not start_date or not end_date or not tenure_months or not due_date or not payment_type:
            return jsonify({'error': 'Name, EMI Amount, Start/End Date, Tenure, Due Date, and Payment Type are required.'}), 400
            
        try:
            principal_amount = float(principal_amount)
            emi_amount = float(emi_amount)
            interest_rate = float(interest_rate)
            tenure_months = int(tenure_months)
        except ValueError:
            return jsonify({'error': 'Numeric fields must contain valid numbers.'}), 400
            
        standard_keys = {
            'name', 'principal_amount', 'emi_amount', 'start_date', 'end_date', 
            'tenure_months', 'interest_rate', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank', 'createddate'
        }
        extra_fields = {k: v for k, v in data.items() if k not in standard_keys}
            
        success = database.update_emi(
            emi_id, name, principal_amount, emi_amount, start_date, end_date, tenure_months, interest_rate, due_date, payment_type, payment_gateway, payment_bank,
            createddate=createddate,
            **extra_fields
        )
        if success:
            return jsonify({'success': True, 'message': 'EMI updated successfully.'})
        else:
            return jsonify({'error': 'EMI not found or update failed.'}), 404

    @app.route('/api/admin/emis/delete/<int:emi_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_admin')
    def admin_delete_emi(emi_id):
        success = database.delete_emi(emi_id)
        if success:
            return jsonify({'success': True, 'message': 'EMI deleted successfully.'})
        else:
            return jsonify({'error': 'EMI not found or deletion failed.'}), 404

from flask import request, jsonify, session
import database
from routes.utils import is_logged_in, require_privilege

def register_expense_routes(app):
    @app.route('/api/categories', methods=['GET'])
    def get_categories_api():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        user_privs = database.get_user_privileges(session['user_id'])
        if user_privs.get('is_admin'):
            cats = database.get_categories()
        else:
            cats = database.get_user_expense_controls(session['user_id'], 'category')
        return jsonify(cats)

    @app.route('/api/expenses', methods=['GET'])
    @require_privilege('can_view')
    def get_expenses_api():
        category = request.args.get('category')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search')
        bank_mode = request.args.get('bank_mode')
        payment_type = request.args.get('payment_type')
        payment_category = request.args.get('payment_category')
        payment_method = request.args.get('payment_method')
        status = request.args.get('status')
        month = request.args.get('month')
        year = request.args.get('year')
        
        expenses = database.get_expenses(
            session['user_id'],
            category=category,
            start_date=start_date,
            end_date=end_date,
            search=search,
            bank_mode=bank_mode,
            payment_type=payment_type,
            payment_category=payment_category,
            month=month,
            year=year,
            payment_method=payment_method,
            status=status
        )
        return jsonify(expenses)

    @app.route('/api/expenses/add', methods=['POST'])
    @require_privilege('can_add')
    def add_expense_api():
        data = request.get_json() or {}
        amount = data.get('amount')
        category = data.get('category')
        description = data.get('description', '')
        date = data.get('date')
        bank_mode = data.get('bank_mode', '')
        payment_type = data.get('payment_type', '')
        payment_category = data.get('payment_category', '')
        payment_method = data.get('payment_method', 'Debit')
        interest = data.get('interest', 0.0)
        status = data.get('status', 'Paid')
        createddate = data.get('createddate')
        if not createddate:
            createddate = date
        
        # Validations
        if amount is None or not category or not date:
            return jsonify({'error': 'Amount, Category, and Date are required.'}), 400
            
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be greater than zero.'}), 400
        except ValueError:
            return jsonify({'error': 'Amount must be a number.'}), 400

        try:
            interest = float(interest)
            if interest < 0:
                return jsonify({'error': 'Interest cannot be negative.'}), 400
        except ValueError:
            interest = 0.0
            
        # Extract dynamic custom fields
        standard_keys = {'amount', 'category', 'date', 'description', 'bank_mode', 'payment_type', 'payment_category', 'interest', 'payment_method', 'status', 'createddate'}
        extra_fields = {k: v for k, v in data.items() if k not in standard_keys}
            
        expense_id = database.add_expense(
            session['user_id'], amount, category, description, date,
            bank_mode=bank_mode, payment_type=payment_type, payment_category=payment_category,
            interest=interest, payment_method=payment_method, status=status,
            createddate=createddate,
            **extra_fields
        )
        return jsonify({'success': True, 'id': expense_id, 'message': 'Expense added successfully.'})

    @app.route('/api/expenses/edit/<int:expense_id>', methods=['POST'])
    @require_privilege('can_edit')
    def edit_expense_api(expense_id):
        data = request.get_json() or {}
        amount = data.get('amount')
        category = data.get('category')
        description = data.get('description', '')
        date = data.get('date')
        bank_mode = data.get('bank_mode', '')
        payment_type = data.get('payment_type', '')
        payment_category = data.get('payment_category', '')
        payment_method = data.get('payment_method', 'Debit')
        interest = data.get('interest', 0.0)
        status = data.get('status', 'Paid')
        createddate = data.get('createddate')
        if not createddate:
            createddate = date
        
        # Validations
        if amount is None or not category or not date:
            return jsonify({'error': 'Amount, Category, and Date are required.'}), 400
            
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({'error': 'Amount must be greater than zero.'}), 400
        except ValueError:
            return jsonify({'error': 'Amount must be a number.'}), 400

        try:
            interest = float(interest)
            if interest < 0:
                return jsonify({'error': 'Interest cannot be negative.'}), 400
        except ValueError:
            interest = 0.0
            
        # Extract dynamic custom fields
        standard_keys = {'amount', 'category', 'date', 'description', 'bank_mode', 'payment_type', 'payment_category', 'interest', 'payment_method', 'status', 'createddate'}
        extra_fields = {k: v for k, v in data.items() if k not in standard_keys}
            
        success = database.update_expense(
            expense_id, session['user_id'], amount, category, description, date,
            bank_mode=bank_mode, payment_type=payment_type, payment_category=payment_category,
            interest=interest, payment_method=payment_method, status=status,
            createddate=createddate,
            **extra_fields
        )
        if success:
            return jsonify({'success': True, 'message': 'Expense updated successfully.'})
        else:
            return jsonify({'error': 'Expense not found or update failed.'}), 404

    @app.route('/api/expenses/delete/<int:expense_id>', methods=['POST', 'DELETE'])
    @require_privilege('can_delete')
    def delete_expense_api(expense_id):
        success = database.delete_expense(expense_id, session['user_id'])
        if success:
            return jsonify({'success': True, 'message': 'Expense deleted successfully.'})
        else:
            return jsonify({'error': 'Expense not found or deletion failed.'}), 404

    @app.route('/api/expenses/delete-bulk', methods=['POST'])
    @require_privilege('can_delete')
    def delete_expenses_bulk_api():
        try:
            data = request.get_json() or {}
            expense_ids = data.get('expense_ids', [])
            if not expense_ids:
                return jsonify({'error': 'No expenses selected.'}), 400
            expense_ids = [int(eid) for eid in expense_ids]
            success = database.delete_expenses_bulk(expense_ids, session['user_id'])
            if success:
                return jsonify({'success': True, 'message': 'Selected expenses deleted successfully.'})
            else:
                return jsonify({'error': 'Deletion failed.'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/overview', methods=['GET'])
    @require_privilege('can_view')
    def get_overview_api():
        month = request.args.get('month')
        year = request.args.get('year')
        data = database.get_overview_data(session['user_id'], month=month, year=year)
        return jsonify(data)

    @app.route('/api/year_totals', methods=['GET'])
    def get_year_totals():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
        year = request.args.get('year')
        if not year:
            return jsonify({'debit': 0.0, 'credit': 0.0})
        
        conn = database.get_db_connection()
        cursor = conn.cursor()
        debit = cursor.execute(
            "SELECT SUM(amount) FROM expenses WHERE user_id = ? AND strftime('%Y', date) = ? AND (payment_method = 'Debit' OR payment_method IS NULL OR payment_method = '')",
            (session['user_id'], year)
        ).fetchone()[0] or 0.0
        
        credit = cursor.execute(
            "SELECT SUM(amount) FROM expenses WHERE user_id = ? AND strftime('%Y', date) = ? AND payment_method = 'Credit'",
            (session['user_id'], year)
        ).fetchone()[0] or 0.0
        conn.close()
        
        return jsonify({'year': year, 'debit': debit, 'credit': credit})

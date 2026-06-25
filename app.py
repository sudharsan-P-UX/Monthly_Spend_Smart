import os
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import database

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'spendsmart-default-secret-key-12345')

# Initialize database
database.init_db()

# Helper to check login status
def is_logged_in():
    return 'user_id' in session

from functools import wraps

def require_privilege(privilege_name):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not is_logged_in():
                return jsonify({'error': 'Unauthorized'}), 401
            privs = database.get_user_privileges(session['user_id'])
            if privilege_name == 'can_admin':
                if not privs.get('is_admin'):
                    return jsonify({'error': 'Forbidden: Administrator privileges required'}), 403
            else:
                if not privs.get(privilege_name):
                    return jsonify({'error': f'Forbidden: Missing privilege {privilege_name}'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/')
def index():
    if not is_logged_in():
        return redirect(url_for('login'))
    return render_template('index.html', username=session.get('username'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if is_logged_in():
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        # API-based login (handles JSON or form data)
        data = request.get_json() if request.is_json else request.form
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password are required.'}), 400
            
        user = database.get_user_by_username(username)
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return jsonify({'success': True, 'message': 'Logged in successfully.'})
        else:
            return jsonify({'success': False, 'message': 'Invalid username or password.'}), 401
            
    return render_template('login.html')

@app.route('/register', methods=['POST'])
def register():
    if is_logged_in():
        return jsonify({'success': False, 'message': 'Already logged in.'}), 400
        
    data = request.get_json() if request.is_json else request.form
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required.'}), 400
        
    if len(username) < 3:
        return jsonify({'success': False, 'message': 'Username must be at least 3 characters.'}), 400
        
    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters.'}), 400
        
    hashed_password = generate_password_hash(password)
    user_id = database.create_user(username, hashed_password)
    
    if user_id:
        # Auto-login after registration
        session['user_id'] = user_id
        session['username'] = username
        return jsonify({'success': True, 'message': 'Registered and logged in successfully.'})
    else:
        return jsonify({'success': False, 'message': 'Username already exists.'}), 409

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# USER PRIVILEGES CHECK & CATEGORIES API (OPEN TO LOGGED IN USERS)

@app.route('/api/user/privileges', methods=['GET'])
def get_user_privileges_api():
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized'}), 401
    privs = database.get_user_privileges(session['user_id'])
    return jsonify({
        'username': session['username'],
        'privileges': privs
    })

@app.route('/api/categories', methods=['GET'])
def get_categories_api():
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized'}), 401
    cats = database.get_categories()
    return jsonify(cats)

# EXPENSE API ENDPOINTS WITH RBAC

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
        payment_method=payment_method
    )
    return jsonify(expenses)

@app.route('/api/expenses/add', methods=['POST'])
@require_privilege('can_add')
def add_expense_api():
    data = request.get_json()
    amount = data.get('amount')
    category = data.get('category')
    description = data.get('description', '')
    date = data.get('date')
    bank_mode = data.get('bank_mode', '')
    payment_type = data.get('payment_type', '')
    payment_category = data.get('payment_category', '')
    payment_method = data.get('payment_method', 'Debit')
    interest = data.get('interest', 0.0)
    
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
        
    expense_id = database.add_expense(
        session['user_id'], amount, category, description, date,
        bank_mode=bank_mode, payment_type=payment_type, payment_category=payment_category,
        interest=interest, payment_method=payment_method
    )
    return jsonify({'success': True, 'id': expense_id, 'message': 'Expense added successfully.'})

@app.route('/api/expenses/edit/<int:expense_id>', methods=['POST'])
@require_privilege('can_edit')
def edit_expense_api(expense_id):
    data = request.get_json()
    amount = data.get('amount')
    category = data.get('category')
    description = data.get('description', '')
    date = data.get('date')
    bank_mode = data.get('bank_mode', '')
    payment_type = data.get('payment_type', '')
    payment_category = data.get('payment_category', '')
    payment_method = data.get('payment_method', 'Debit')
    interest = data.get('interest', 0.0)
    
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
        
    success = database.update_expense(
        expense_id, session['user_id'], amount, category, description, date,
        bank_mode=bank_mode, payment_type=payment_type, payment_category=payment_category,
        interest=interest, payment_method=payment_method
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

@app.route('/api/overview', methods=['GET'])
@require_privilege('can_view')
def get_overview_api():
    month = request.args.get('month')
    year = request.args.get('year')
    data = database.get_overview_data(session['user_id'], month=month, year=year)
    return jsonify(data)

# ADMIN API ENDPOINTS

@app.route('/api/admin/users', methods=['GET'])
@require_privilege('can_admin')
def admin_get_users():
    users = database.get_all_users()
    return jsonify(users)

@app.route('/api/admin/users/create', methods=['POST'])
@require_privilege('can_admin')
def admin_create_user():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    role_id = data.get('role_id')
    
    if not username or not password or not role_id:
        return jsonify({'error': 'Username, password, and role are required.'}), 400
        
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters.'}), 400
        
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400
        
    hashed_password = generate_password_hash(password)
    user_id = database.create_user(username, hashed_password, int(role_id))
    
    if user_id:
        return jsonify({'success': True, 'message': 'User created successfully.'})
    else:
        return jsonify({'error': 'Username already exists.'}), 409

@app.route('/api/admin/users/edit_role', methods=['POST'])
@require_privilege('can_admin')
def admin_edit_user_role():
    data = request.get_json()
    user_id = data.get('user_id')
    role_id = data.get('role_id')
    
    if not user_id or not role_id:
        return jsonify({'error': 'User ID and Role ID are required.'}), 400
        
    # Prevent changing last admin's role
    current_privs = database.get_user_privileges(int(user_id))
    if current_privs.get('is_admin') and int(role_id) != 1:
        # Check if last admin
        users = database.get_all_users()
        admins = [u for u in users if u['role_id'] == 1]
        if len(admins) <= 1:
            return jsonify({'error': 'Cannot change role of the last administrator.'}), 400

    database.update_user_role(int(user_id), int(role_id))
    return jsonify({'success': True, 'message': 'User role updated successfully.'})

@app.route('/api/admin/users/delete/<int:user_id>', methods=['POST', 'DELETE'])
@require_privilege('can_admin')
def admin_delete_user(user_id):
    success = database.delete_user(user_id)
    if success:
        return jsonify({'success': True, 'message': 'User deleted successfully.'})
    else:
        return jsonify({'error': 'Failed to delete user. Ensure it is not the last Administrator.'}), 400

@app.route('/api/admin/roles', methods=['GET'])
@require_privilege('can_admin')
def admin_get_roles():
    roles = database.get_roles()
    return jsonify(roles)

@app.route('/api/admin/roles/create', methods=['POST'])
@require_privilege('can_admin')
def admin_create_role():
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Role name is required.'}), 400
        
    role_id = database.add_role(name)
    if role_id:
        return jsonify({'success': True, 'id': role_id, 'message': 'Role created successfully.'})
    else:
        return jsonify({'error': 'Role already exists.'}), 409

@app.route('/api/admin/roles/delete/<int:role_id>', methods=['POST', 'DELETE'])
@require_privilege('can_admin')
def admin_delete_role(role_id):
    success = database.delete_role(role_id)
    if success:
        return jsonify({'success': True, 'message': 'Role deleted successfully.'})
    else:
        return jsonify({'error': 'Failed to delete role. Admin role cannot be deleted.'}), 400

@app.route('/api/admin/privileges/update', methods=['POST'])
@require_privilege('can_admin')
def admin_update_privileges():
    data = request.get_json()
    role_id = data.get('role_id')
    can_view = data.get('can_view', 0)
    can_add = data.get('can_add', 0)
    can_edit = data.get('can_edit', 0)
    can_delete = data.get('can_delete', 0)
    
    if not role_id:
        return jsonify({'error': 'Role ID is required.'}), 400
        
    # Prevent removing privileges from Admin role
    if int(role_id) == 1:
        return jsonify({'error': 'Cannot modify Administrator role privileges.'}), 400
        
    database.update_role_privileges(int(role_id), can_view, can_add, can_edit, can_delete)
    return jsonify({'success': True, 'message': 'Privileges updated successfully.'})

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

# ADMIN ROLE EDIT
@app.route('/api/admin/roles/edit', methods=['POST'])
@require_privilege('can_admin')
def admin_edit_role_name():
    data = request.get_json()
    role_id = data.get('role_id')
    name = data.get('name', '').strip()
    if not role_id or not name:
        return jsonify({'error': 'Role ID and name are required.'}), 400
    success = database.update_role_name(int(role_id), name)
    if success:
        return jsonify({'success': True, 'message': 'Role name updated successfully.'})
    else:
        return jsonify({'error': 'Failed to update role name. Ensure it is unique.'}), 400

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

# YEAR-BASED DEBIT & CREDIT TOTALS API
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)

import sqlite3
import os

DB_PATH = os.environ.get('DATABASE_PATH')
if not DB_PATH:
    if os.path.exists('/data'):
        DB_PATH = '/data/expenses.db'
    else:
        DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'expenses.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role_id INTEGER
        )
    ''')
    
    # Create expenses table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            bank_mode TEXT,
            payment_type TEXT,
            payment_category TEXT,
            interest REAL DEFAULT 0.0,
            payment_method TEXT DEFAULT 'Debit',
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create roles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    ''')
    
    # Create role_privileges table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS role_privileges (
            role_id INTEGER PRIMARY KEY,
            can_view INTEGER DEFAULT 1,
            can_add INTEGER DEFAULT 1,
            can_edit INTEGER DEFAULT 1,
            can_delete INTEGER DEFAULT 1,
            FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
        )
    ''')
    
    # Create categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_order INTEGER DEFAULT 0
        )
    ''')
    
    # Create bank_modes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bank_modes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_order INTEGER DEFAULT 0
        )
    ''')
    
    # Create payment_types table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payment_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_order INTEGER DEFAULT 0
        )
    ''')
    
    # Create payment_categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payment_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_order INTEGER DEFAULT 0
        )
    ''')
    
    # Create excel_columns table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS excel_columns (
            column_key TEXT PRIMARY KEY,
            column_label TEXT NOT NULL,
            is_enabled_import INTEGER DEFAULT 1,
            is_enabled_export INTEGER DEFAULT 1,
            is_required INTEGER DEFAULT 0
        )
    ''')
    
    # Migrations for excel_columns table
    try:
        cursor.execute("ALTER TABLE excel_columns ADD COLUMN is_enabled_import INTEGER DEFAULT 1")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE excel_columns ADD COLUMN is_enabled_export INTEGER DEFAULT 1")
    except sqlite3.OperationalError:
        pass
    
    # Migrations for users and expenses columns
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN role_id INTEGER")
    except sqlite3.OperationalError:
        pass

    new_cols = [
        ('bank_mode', 'TEXT'),
        ('payment_type', 'TEXT'),
        ('payment_category', 'TEXT'),
        ('interest', 'REAL DEFAULT 0.0'),
        ('payment_method', 'TEXT DEFAULT \'Debit\'')
    ]
    for name, dtype in new_cols:
        try:
            cursor.execute(f"ALTER TABLE expenses ADD COLUMN {name} {dtype}")
        except sqlite3.OperationalError:
            pass

    # Seed Default Roles
    roles_exist = cursor.execute("SELECT COUNT(*) FROM roles").fetchone()[0]
    if roles_exist == 0:
        cursor.execute("INSERT INTO roles (id, name) VALUES (1, 'Admin')")
        cursor.execute("INSERT INTO roles (id, name) VALUES (2, 'User')")
        cursor.execute("INSERT INTO roles (id, name) VALUES (3, 'Viewer')")
        
        cursor.execute("INSERT INTO role_privileges (role_id, can_view, can_add, can_edit, can_delete) VALUES (1, 1, 1, 1, 1)")
        cursor.execute("INSERT INTO role_privileges (role_id, can_view, can_add, can_edit, can_delete) VALUES (2, 1, 1, 1, 1)")
        cursor.execute("INSERT INTO role_privileges (role_id, can_view, can_add, can_edit, can_delete) VALUES (3, 1, 0, 0, 0)")
        
    # Update existing users who don't have role_id to default User role (2)
    cursor.execute("UPDATE users SET role_id = 2 WHERE role_id IS NULL")

    # Seed Default Admin User
    admin_exists = cursor.execute("SELECT COUNT(*) FROM users WHERE role_id = 1").fetchone()[0]
    if admin_exists == 0:
        from werkzeug.security import generate_password_hash
        p_hash = generate_password_hash('admin123')
        try:
            cursor.execute("INSERT INTO users (username, password_hash, role_id) VALUES ('admin', ?, 1)", (p_hash,))
        except sqlite3.IntegrityError:
            cursor.execute("UPDATE users SET role_id = 1 WHERE username = 'admin'")

    # Seed Default Categories
    cats_exist = cursor.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    if cats_exist == 0:
        default_cats = [
            ('Food & Dining', 1),
            ('Shopping', 2),
            ('Housing & Rent', 3),
            ('Transportation', 4),
            ('Entertainment', 5),
            ('Utilities', 6),
            ('Medical & Healthcare', 7),
            ('Education', 8),
            ('Other', 9)
        ]
        cursor.executemany("INSERT INTO categories (name, display_order) VALUES (?, ?)", default_cats)

    # Seed Default Bank Modes
    bm_exist = cursor.execute("SELECT COUNT(*) FROM bank_modes").fetchone()[0]
    if bm_exist == 0:
        default_bm = [('SBI', 1), ('Kotak', 2), ('ICICI', 3)]
        cursor.executemany("INSERT INTO bank_modes (name, display_order) VALUES (?, ?)", default_bm)
        
    # Seed Default Payment Types
    pt_exist = cursor.execute("SELECT COUNT(*) FROM payment_types").fetchone()[0]
    if pt_exist == 0:
        default_pt = [
            ('GPay', 1), ('PhonePe', 2), ('Paytm', 3), ('BHIM', 4),
            ('Credit Card', 5), ('CRED', 6), ('Cash', 7), ('Other', 8)
        ]
        cursor.executemany("INSERT INTO payment_types (name, display_order) VALUES (?, ?)", default_pt)
        
    cursor.execute("DELETE FROM payment_categories WHERE name IN ('Debit', 'Credit')")
    pc_exist = cursor.execute("SELECT COUNT(*) FROM payment_categories").fetchone()[0]
    if pc_exist == 0:
        default_pc = [
            ('Salary', 1),
            ('Borrow', 2),
            ('Credit Card', 3),
            ('Loan', 4)
        ]
        cursor.executemany("INSERT INTO payment_categories (name, display_order) VALUES (?, ?)", default_pc)

    # Seed Default Excel Columns
    cols_exist = cursor.execute("SELECT COUNT(*) FROM excel_columns").fetchone()[0]
    if cols_exist == 0:
        default_cols = [
            ('date', 'Date', 1, 1, 1),
            ('category', 'Category', 1, 1, 1),
            ('description', 'Description', 1, 1, 0),
            ('gateway', 'Gateway', 1, 1, 0),
            ('bank', 'Bank', 1, 1, 0),
            ('source', 'Source', 1, 1, 0),
            ('method', 'Method', 1, 1, 0),
            ('amount', 'Amount', 1, 1, 1),
            ('interest', 'Interest', 1, 1, 0)
        ]
        cursor.executemany("INSERT INTO excel_columns (column_key, column_label, is_enabled_import, is_enabled_export, is_required) VALUES (?, ?, ?, ?, ?)", default_cols)

    conn.commit()
    conn.close()

def create_user(username, password_hash, role_id=2):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)',
            (username, password_hash, role_id)
        )
        conn.commit()
        user_id = cursor.lastrowid
        return user_id
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_user_by_username(username):
    conn = get_db_connection()
    cursor = conn.cursor()
    user = cursor.execute(
        'SELECT * FROM users WHERE username = ?',
        (username,)
    ).fetchone()
    conn.close()
    return user

def get_user_by_id(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    user = cursor.execute(
        'SELECT * FROM users WHERE id = ?',
        (user_id,)
    ).fetchone()
    conn.close()
    return user

def add_expense(user_id, amount, category, description, date, bank_mode=None, payment_type=None, payment_category=None, interest=0.0, payment_method='Debit'):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO expenses (
            user_id, amount, category, description, date, bank_mode, payment_type, payment_category, interest, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (user_id, amount, category, description, date, bank_mode, payment_type, payment_category, interest, payment_method)
    )
    conn.commit()
    expense_id = cursor.lastrowid
    conn.close()
    return expense_id

def get_expenses(user_id, category=None, start_date=None, end_date=None, search=None, bank_mode=None, payment_type=None, payment_category=None, month=None, year=None, payment_method=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM expenses WHERE user_id = ?'
    params = [user_id]
    
    if category:
        query += ' AND category = ?'
        params.append(category)
        
    if start_date:
        query += ' AND date >= ?'
        params.append(start_date)
        
    if end_date:
        query += ' AND date <= ?'
        params.append(end_date)
        
    if search:
        query += ' AND (description LIKE ? OR category LIKE ? OR bank_mode LIKE ? OR payment_type LIKE ?)'
        params.append(f'%{search}%')
        params.append(f'%{search}%')
        params.append(f'%{search}%')
        params.append(f'%{search}%')
        
    if bank_mode:
        query += ' AND bank_mode = ?'
        params.append(bank_mode)
        
    if payment_type:
        query += ' AND payment_type = ?'
        params.append(payment_type)
        
    if payment_category:
        query += ' AND payment_category = ?'
        params.append(payment_category)

    if payment_method:
        query += ' AND payment_method = ?'
        params.append(payment_method)
        
    if month:
        query += " AND strftime('%m', date) = ?"
        params.append(month)
        
    if year:
        query += " AND strftime('%Y', date) = ?"
        params.append(year)
        
    query += ' ORDER BY date DESC, id DESC'
    
    expenses = cursor.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in expenses]

def get_expense_by_id(expense_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    expense = cursor.execute(
        'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
        (expense_id, user_id)
    ).fetchone()
    conn.close()
    return dict(expense) if expense else None

def update_expense(expense_id, user_id, amount, category, description, date, bank_mode=None, payment_type=None, payment_category=None, interest=0.0, payment_method='Debit'):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''UPDATE expenses SET 
            amount = ?, category = ?, description = ?, date = ?, 
            bank_mode = ?, payment_type = ?, payment_category = ?, interest = ?, payment_method = ? 
        WHERE id = ? AND user_id = ?''',
        (amount, category, description, date, bank_mode, payment_type, payment_category, interest, payment_method, expense_id, user_id)
    )
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def delete_expense(expense_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'DELETE FROM expenses WHERE id = ? AND user_id = ?',
        (expense_id, user_id)
    )
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def get_overview_data(user_id, month=None, year=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Total expenses (overall and current month)
    # Get current year-month
    import datetime
    now = datetime.datetime.now()
    
    if not year:
        year_str = now.strftime('%Y')
    else:
        year_str = str(year)
        
    if not month:
        month_str = now.strftime('%m')
    else:
        month_str = str(month).zfill(2)
        
    selected_month_str = f"{year_str}-{month_str}"
    
    total_all = cursor.execute(
        'SELECT SUM(amount) FROM expenses WHERE user_id = ?',
        (user_id,)
    ).fetchone()[0] or 0.0
    
    total_month = cursor.execute(
        'SELECT SUM(amount) FROM expenses WHERE user_id = ? AND date LIKE ?',
        (user_id, f'{selected_month_str}%')
    ).fetchone()[0] or 0.0

    total_debit = cursor.execute(
        "SELECT SUM(amount) FROM expenses WHERE user_id = ? AND (payment_method = 'Debit' OR payment_method IS NULL OR payment_method = '')",
        (user_id,)
    ).fetchone()[0] or 0.0
    
    total_credit = cursor.execute(
        "SELECT SUM(amount) FROM expenses WHERE user_id = ? AND payment_method = 'Credit'",
        (user_id,)
    ).fetchone()[0] or 0.0
    
    month_debit = cursor.execute(
        "SELECT SUM(amount) FROM expenses WHERE user_id = ? AND date LIKE ? AND (payment_method = 'Debit' OR payment_method IS NULL OR payment_method = '')",
        (user_id, f'{selected_month_str}%')
    ).fetchone()[0] or 0.0
    
    month_credit = cursor.execute(
        "SELECT SUM(amount) FROM expenses WHERE user_id = ? AND date LIKE ? AND payment_method = 'Credit'",
        (user_id, f'{selected_month_str}%')
    ).fetchone()[0] or 0.0

    total_interest = cursor.execute(
        "SELECT SUM(interest) FROM expenses WHERE user_id = ? AND payment_method = 'Credit'",
        (user_id,)
    ).fetchone()[0] or 0.0

    month_interest = cursor.execute(
        "SELECT SUM(interest) FROM expenses WHERE user_id = ? AND date LIKE ? AND payment_method = 'Credit'",
        (user_id, f'{selected_month_str}%')
    ).fetchone()[0] or 0.0
    
    # 2. Expenses by category (selected month)
    category_data = cursor.execute(
        'SELECT category, SUM(amount) as total FROM expenses WHERE user_id = ? AND date LIKE ? GROUP BY category',
        (user_id, f'{selected_month_str}%')
    ).fetchall()
    
    categories = [dict(row) for row in category_data]
    
    # 3. Monthly trends (last 6 months leading to selected month)
    trends = []
    # parse selected month and year
    selected_date = datetime.date(int(year_str), int(month_str), 1)
    for i in range(5, -1, -1):
        y = selected_date.year
        m = selected_date.month - i
        while m <= 0:
            m += 12
            y -= 1
        m_str = f'{y}-{m:02d}'
        
        month_total = cursor.execute(
            'SELECT SUM(amount) FROM expenses WHERE user_id = ? AND date LIKE ?',
            (user_id, f'{m_str}%')
        ).fetchone()[0] or 0.0
        
        month_name = datetime.date(y, m, 1).strftime('%b %Y')
        trends.append({
            'month': m_str,
            'label': month_name,
            'total': month_total
        })
        
    conn.close()
    
    return {
        'total_all': total_all,
        'total_month': total_month,
        'total_debit': total_debit,
        'total_credit': total_credit,
        'month_debit': month_debit,
        'month_credit': month_credit,
        'total_interest': total_interest,
        'month_interest': month_interest,
        'categories': categories,
        'trends': trends
    }

# ROLES & PRIVILEGES
def get_roles():
    conn = get_db_connection()
    cursor = conn.cursor()
    roles = cursor.execute('SELECT * FROM roles').fetchall()
    role_list = []
    for r in roles:
        privs = cursor.execute('SELECT * FROM role_privileges WHERE role_id = ?', (r['id'],)).fetchone()
        role_list.append({
            'id': r['id'],
            'name': r['name'],
            'can_view': privs['can_view'] if privs else 1,
            'can_add': privs['can_add'] if privs else 1,
            'can_edit': privs['can_edit'] if privs else 1,
            'can_delete': privs['can_delete'] if privs else 1
        })
    conn.close()
    return role_list

def add_role(name):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO roles (name) VALUES (?)', (name,))
        role_id = cursor.lastrowid
        cursor.execute(
            'INSERT INTO role_privileges (role_id, can_view, can_add, can_edit, can_delete) VALUES (?, 1, 1, 1, 1)',
            (role_id,)
        )
        conn.commit()
        return role_id
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def update_role_privileges(role_id, can_view, can_add, can_edit, can_delete):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT OR REPLACE INTO role_privileges (role_id, can_view, can_add, can_edit, can_delete) 
           VALUES (?, ?, ?, ?, ?)''',
        (role_id, int(can_view), int(can_add), int(can_edit), int(can_delete))
    )
    conn.commit()
    conn.close()
    return True

def delete_role(role_id):
    if int(role_id) == 1:
        return False
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET role_id = 2 WHERE role_id = ?', (role_id,))
    cursor.execute('DELETE FROM role_privileges WHERE role_id = ?', (role_id,))
    cursor.execute('DELETE FROM roles WHERE id = ?', (role_id,))
    conn.commit()
    conn.close()
    return True

def get_user_privileges(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    user = cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        conn.close()
        return {'can_view': 0, 'can_add': 0, 'can_edit': 0, 'can_delete': 0, 'is_admin': False}
    
    role_id = user['role_id'] or 2
    privs = cursor.execute('SELECT * FROM role_privileges WHERE role_id = ?', (role_id,)).fetchone()
    conn.close()
    
    is_admin = (int(role_id) == 1)
    
    if privs:
        return {
            'can_view': privs['can_view'],
            'can_add': privs['can_add'],
            'can_edit': privs['can_edit'],
            'can_delete': privs['can_delete'],
            'is_admin': is_admin
        }
    else:
        return {'can_view': 1, 'can_add': 1, 'can_edit': 1, 'can_delete': 1, 'is_admin': is_admin}

# USERS MANAGEMENT
def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    users = cursor.execute(
        '''SELECT users.id, users.username, users.role_id, roles.name as role_name 
           FROM users LEFT JOIN roles ON users.role_id = roles.id'''
    ).fetchall()
    conn.close()
    return [dict(row) for row in users]

def update_user_role(user_id, role_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET role_id = ? WHERE id = ?', (role_id, user_id))
    conn.commit()
    conn.close()
    return True

def delete_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    user = cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if user and user['role_id'] == 1:
        admin_count = cursor.execute('SELECT COUNT(*) FROM users WHERE role_id = 1').fetchone()[0]
        if admin_count <= 1:
            conn.close()
            return False
            
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    cursor.execute('DELETE FROM expenses WHERE user_id = ?', (user_id,))
    conn.commit()
    conn.close()
    return True

# DYNAMIC CATEGORIES
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cats = cursor.execute('SELECT * FROM categories ORDER BY display_order ASC, name ASC').fetchall()
    conn.close()
    return [dict(row) for row in cats]

def add_category(name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO categories (name, display_order) VALUES (?, ?)', (name, display_order))
        conn.commit()
        cat_id = cursor.lastrowid
        return cat_id
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def update_category(cat_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE categories SET name = ?, display_order = ? WHERE id = ?',
            (name, display_order, cat_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def delete_category(cat_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM categories WHERE id = ?', (cat_id,))
    conn.commit()
    conn.close()
    return True

# ROLE NAME EDIT
def update_role_name(role_id, name):
    if int(role_id) == 1:
        return False
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('UPDATE roles SET name = ? WHERE id = ?', (name, role_id))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

# DYNAMIC BANK MODES
def get_bank_modes():
    conn = get_db_connection()
    cursor = conn.cursor()
    modes = cursor.execute('SELECT * FROM bank_modes ORDER BY display_order ASC, name ASC').fetchall()
    conn.close()
    return [dict(row) for row in modes]

def add_bank_mode(name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO bank_modes (name, display_order) VALUES (?, ?)', (name, display_order))
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def update_bank_mode(bm_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE bank_modes SET name = ?, display_order = ? WHERE id = ?',
            (name, display_order, bm_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def delete_bank_mode(bm_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM bank_modes WHERE id = ?', (bm_id,))
    conn.commit()
    conn.close()
    return True

# DYNAMIC PAYMENT TYPES
def get_payment_types():
    conn = get_db_connection()
    cursor = conn.cursor()
    types = cursor.execute('SELECT * FROM payment_types ORDER BY display_order ASC, name ASC').fetchall()
    conn.close()
    return [dict(row) for row in types]

def add_payment_type(name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO payment_types (name, display_order) VALUES (?, ?)', (name, display_order))
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def update_payment_type(pt_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE payment_types SET name = ?, display_order = ? WHERE id = ?',
            (name, display_order, pt_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def delete_payment_type(pt_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM payment_types WHERE id = ?', (pt_id,))
    conn.commit()
    conn.close()
    return True

# DYNAMIC PAYMENT CATEGORIES
def get_payment_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cats = cursor.execute('SELECT * FROM payment_categories ORDER BY display_order ASC, name ASC').fetchall()
    conn.close()
    return [dict(row) for row in cats]

def add_payment_category(name, display_order=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO payment_categories (name, display_order) VALUES (?, ?)', (name, display_order))
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def update_payment_category(pc_id, name, display_order):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE payment_categories SET name = ?, display_order = ? WHERE id = ?',
            (name, display_order, pc_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def delete_payment_category(pc_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM payment_categories WHERE id = ?', (pc_id,))
    conn.commit()
    conn.close()
    return True

# EXCEL COLUMNS CONFIGURATION HELPERS
def get_excel_columns():
    conn = get_db_connection()
    cursor = conn.cursor()
    cols = cursor.execute("SELECT column_key, column_label, is_enabled_import, is_enabled_export, is_required FROM excel_columns").fetchall()
    conn.close()
    return [dict(c) for c in cols]

def update_excel_column_status(column_key, type_key, is_enabled):
    conn = get_db_connection()
    cursor = conn.cursor()
    field = 'is_enabled_import' if type_key == 'import' else 'is_enabled_export'
    cursor.execute(
        f"UPDATE excel_columns SET {field} = ? WHERE column_key = ?",
        (int(is_enabled), column_key)
    )
    conn.commit()
    conn.close()
    return True

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully at:", DB_PATH)

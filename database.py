import sqlite3
import psycopg2
import psycopg2.extras
import os
import re

DATABASE_URL = os.environ.get('DATABASE_URL')
POSTGRES_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.environ.get('POSTGRES_PORT', '5432')
POSTGRES_USER = os.environ.get('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'postgres')
POSTGRES_DB = os.environ.get('POSTGRES_DB', 'expenses')

DB_PATH = os.environ.get('DATABASE_PATH')
if not DB_PATH:
    if os.environ.get('VERCEL') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME'):
        DB_PATH = '/tmp/expenses.db'
    elif os.path.exists('/data'):
        DB_PATH = '/data/expenses.db'
    else:
        DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'expenses.db')

class PostgresCursorWrapper:
    def __init__(self, cursor):
        self.cursor = cursor
        self._lastrowid = None

    def execute(self, query, params=None):
        # Translate placeholder from ? to %s
        query = query.replace('?', '%s')

        # Translate SQLite PRAGMA table_info to PostgreSQL catalog select
        if "PRAGMA table_info" in query:
            match = re.search(r"table_info\((\w+)\)", query, re.IGNORECASE)
            if match:
                table_name = match.group(1)
                query = f"SELECT column_name AS name FROM information_schema.columns WHERE table_name = '{table_name}'"

        # Translate SQLite "INSERT OR IGNORE" to PostgreSQL "ON CONFLICT DO NOTHING"
        if "INSERT OR IGNORE" in query:
            query = query.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            query += " ON CONFLICT DO NOTHING"

        # Translate SQLite "INSERT OR REPLACE" to PostgreSQL "ON CONFLICT" upsert
        if "INSERT OR REPLACE" in query:
            query = query.replace("INSERT OR REPLACE INTO", "INSERT INTO")
            query += " ON CONFLICT (role_id) DO UPDATE SET can_view = EXCLUDED.can_view, can_add = EXCLUDED.can_add, can_edit = EXCLUDED.can_edit, can_delete = EXCLUDED.can_delete"

        # Translate SQLite AUTOINCREMENT syntax to PostgreSQL SERIAL
        if "AUTOINCREMENT" in query:
            query = query.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            query = query.replace("AUTOINCREMENT", "")

        # For insert statements without RETURNING clause, append it so we can query lastrowid
        is_insert = query.strip().upper().startswith("INSERT INTO")
        if is_insert and "RETURNING" not in query.upper():
            query = query.rstrip('; ') + " RETURNING id"

        try:
            self.cursor.execute(query, params)
            
            # Fetch lastrowid if inserted
            if is_insert:
                try:
                    row = self.cursor.fetchone()
                    if row:
                        self._lastrowid = row[0]
                except Exception:
                    pass
        except psycopg2.IntegrityError as e:
            raise sqlite3.IntegrityError(str(e))
        except (psycopg2.OperationalError, psycopg2.ProgrammingError) as e:
            raise sqlite3.OperationalError(str(e))

    def executemany(self, query, params_seq=None):
        query = query.replace('?', '%s')
        if "INSERT OR IGNORE" in query:
            query = query.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            query += " ON CONFLICT DO NOTHING"
        
        try:
            return self.cursor.executemany(query, params_seq)
        except psycopg2.IntegrityError as e:
            raise sqlite3.IntegrityError(str(e))
        except (psycopg2.OperationalError, psycopg2.ProgrammingError) as e:
            raise sqlite3.OperationalError(str(e))

    def fetchone(self):
        try:
            return self.cursor.fetchone()
        except psycopg2.ProgrammingError as e:
            if "no results to fetch" in str(e):
                return None
            raise e

    def fetchall(self):
        try:
            return self.cursor.fetchall()
        except psycopg2.ProgrammingError as e:
            if "no results to fetch" in str(e):
                return []
            raise e

    def fetchmany(self, size=None):
        return self.cursor.fetchmany(size)

    def close(self):
        return self.cursor.close()

    @property
    def rowcount(self):
        return self.cursor.rowcount

    @property
    def description(self):
        return self.cursor.description

    @property
    def lastrowid(self):
        return self._lastrowid

    def __iter__(self):
        return iter(self.cursor)

class PostgresConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn
        self.row_factory = None

    def cursor(self):
        cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        return PostgresCursorWrapper(cursor)

    def commit(self):
        return self.conn.commit()

    def rollback(self):
        return self.conn.rollback()

    def close(self):
        return self.conn.close()

def get_db_connection():
    if DATABASE_URL:
        # Standard hosted connection (Neon, Vercel, Supabase etc)
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(url)
        return PostgresConnectionWrapper(conn)
    else:
        try:
            conn = psycopg2.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                dbname=POSTGRES_DB,
                connect_timeout=2
            )
            return PostgresConnectionWrapper(conn)
        except psycopg2.OperationalError as e:
            if "does not exist" in str(e):
                try:
                    # Connect to default postgres DB and create the database
                    conn_default = psycopg2.connect(
                        host=POSTGRES_HOST,
                        port=POSTGRES_PORT,
                        user=POSTGRES_USER,
                        password=POSTGRES_PASSWORD,
                        dbname="postgres"
                    )
                    conn_default.autocommit = True
                    cursor = conn_default.cursor()
                    cursor.execute(f'CREATE DATABASE "{POSTGRES_DB}"')
                    cursor.close()
                    conn_default.close()
                    
                    conn = psycopg2.connect(
                        host=POSTGRES_HOST,
                        port=POSTGRES_PORT,
                        user=POSTGRES_USER,
                        password=POSTGRES_PASSWORD,
                        dbname=POSTGRES_DB
                    )
                    return PostgresConnectionWrapper(conn)
                except Exception as ex:
                    # Fallback to SQLite if default DB connection fails too
                    conn = sqlite3.connect(DB_PATH)
                    conn.row_factory = sqlite3.Row
                    return conn
            else:
                # Fallback to SQLite if PostgreSQL connection fails
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
            status TEXT DEFAULT 'Paid',
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
    # Check if target_type column exists to migrate to composite primary key
    cursor.execute("PRAGMA table_info(excel_columns)")
    cols_info = [r['name'] for r in cursor.fetchall()]
    
    if cols_info and 'target_type' not in cols_info:
        # Recreate excel_columns table with composite primary key (column_key, target_type)
        cursor.execute("SELECT column_key, column_label, is_enabled_import, is_enabled_export, is_required FROM excel_columns")
        old_rows = cursor.fetchall()
        
        cursor.execute("DROP TABLE excel_columns")
        cursor.execute('''
            CREATE TABLE excel_columns (
                column_key TEXT NOT NULL,
                column_label TEXT NOT NULL,
                is_enabled_import INTEGER DEFAULT 1,
                is_enabled_export INTEGER DEFAULT 1,
                is_required INTEGER DEFAULT 0,
                target_type TEXT DEFAULT 'expense',
                display_order INTEGER DEFAULT 0,
                parent_column_key TEXT,
                parent_trigger_value TEXT,
                PRIMARY KEY (column_key, target_type)
            )
        ''')
        for row in old_rows:
            cursor.execute(
                "INSERT INTO excel_columns (column_key, column_label, is_enabled_import, is_enabled_export, is_required, target_type, display_order) VALUES (?, ?, ?, ?, ?, 'expense', 0)",
                (row[0], row[1], row[2], row[3], row[4])
            )
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS excel_columns (
                column_key TEXT NOT NULL,
                column_label TEXT NOT NULL,
                is_enabled_import INTEGER DEFAULT 1,
                is_enabled_export INTEGER DEFAULT 1,
                is_required INTEGER DEFAULT 0,
                target_type TEXT DEFAULT 'expense',
                display_order INTEGER DEFAULT 0,
                parent_column_key TEXT,
                parent_trigger_value TEXT,
                PRIMARY KEY (column_key, target_type)
            )
        ''')

    # Create emis table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS emis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            principal_amount REAL DEFAULT 0.0,
            emi_amount REAL NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            tenure_months INTEGER NOT NULL,
            interest_rate REAL NOT NULL,
            due_date TEXT NOT NULL,
            payment_type TEXT NOT NULL,
            payment_gateway TEXT,
            payment_bank TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # Create currencies table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS currencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country TEXT UNIQUE NOT NULL,
            country_desc TEXT NOT NULL,
            symbol TEXT NOT NULL,
            is_active INTEGER DEFAULT 0
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
    try:
        cursor.execute("ALTER TABLE excel_columns ADD COLUMN display_order INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE excel_columns ADD COLUMN parent_column_key TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE excel_columns ADD COLUMN parent_trigger_value TEXT")
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
        ('payment_method', 'TEXT DEFAULT \'Debit\''),
        ('status', 'TEXT DEFAULT \'Paid\'')
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
    admin_exists = cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'").fetchone()[0]
    if admin_exists == 0:
        from werkzeug.security import generate_password_hash
        p_hash = generate_password_hash('admin123')
        try:
            cursor.execute("INSERT INTO users (username, password_hash, role_id) VALUES ('admin', ?, 1)", (p_hash,))
        except sqlite3.IntegrityError:
            cursor.execute("UPDATE users SET role_id = 1, password_hash = ? WHERE username = 'admin'", (p_hash,))

    # Seed Default Currencies
    currencies_exist = cursor.execute("SELECT COUNT(*) FROM currencies").fetchone()[0]
    if currencies_exist == 0:
        cursor.execute("INSERT INTO currencies (country, country_desc, symbol, is_active) VALUES ('India', 'Indian Rupee', '₹', 1)")
        cursor.execute("INSERT INTO currencies (country, country_desc, symbol, is_active) VALUES ('USA', 'US Dollar', '$', 0)")
        cursor.execute("INSERT INTO currencies (country, country_desc, symbol, is_active) VALUES ('Europe', 'Euro', '€', 0)")
        cursor.execute("INSERT INTO currencies (country, country_desc, symbol, is_active) VALUES ('UK', 'British Pound', '£', 0)")

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
    cursor.execute("SELECT COUNT(*) FROM excel_columns WHERE target_type = 'expense'")
    expense_cols_exist = cursor.fetchone()[0]
    if expense_cols_exist == 0:
        default_cols = [
            ('date', 'Date', 1, 1, 1, 'expense'),
            ('category', 'Category', 1, 1, 1, 'expense'),
            ('description', 'Description', 1, 1, 0, 'expense'),
            ('gateway', 'Gateway', 1, 1, 0, 'expense'),
            ('bank', 'Bank', 1, 1, 0, 'expense'),
            ('source', 'Source', 1, 1, 0, 'expense'),
            ('method', 'Method', 1, 1, 0, 'expense'),
            ('amount', 'Amount', 1, 1, 1, 'expense'),
            ('interest', 'Interest', 1, 1, 0, 'expense'),
            ('status', 'Status', 1, 1, 0, 'expense')
        ]
        cursor.executemany("INSERT INTO excel_columns (column_key, column_label, is_enabled_import, is_enabled_export, is_required, target_type) VALUES (?, ?, ?, ?, ?, ?)", default_cols)
    else:
        cursor.execute("INSERT OR IGNORE INTO excel_columns (column_key, column_label, is_enabled_import, is_enabled_export, is_required, target_type) VALUES ('status', 'Status', 1, 1, 0, 'expense')")

    # Seed Default EMI Excel Columns
    cursor.execute("SELECT COUNT(*) FROM excel_columns WHERE target_type = 'emi'")
    emi_cols_exist = cursor.fetchone()[0]
    if emi_cols_exist == 0:
        default_emi_cols = [
            ('name', 'EMI Name', 1, 1, 1, 'emi'),
            ('principal_amount', 'Loan Amount', 1, 1, 0, 'emi'),
            ('interest_rate', 'Interest Rate', 1, 1, 0, 'emi'),
            ('tenure_months', 'Tenure', 1, 1, 1, 'emi'),
            ('emi_amount', 'Monthly EMI', 1, 1, 1, 'emi'),
            ('start_date', 'Start Date', 1, 1, 1, 'emi'),
            ('end_date', 'End Date', 1, 1, 1, 'emi'),
            ('due_date', 'Due Date', 1, 1, 1, 'emi'),
            ('payment_type', 'Payment Type', 1, 1, 1, 'emi'),
            ('payment_gateway', 'Payment Gateway', 1, 1, 0, 'emi'),
            ('payment_bank', 'Payment Bank', 1, 1, 0, 'emi')
        ]
        cursor.executemany("INSERT INTO excel_columns (column_key, column_label, is_enabled_import, is_enabled_export, is_required, target_type) VALUES (?, ?, ?, ?, ?, ?)", default_emi_cols)

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

def add_expense(user_id, amount, category, description, date, bank_mode=None, payment_type=None, payment_category=None, interest=0.0, payment_method='Debit', status='Paid', **kwargs):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Dynamically query current columns of expenses table
    cursor.execute("PRAGMA table_info(expenses)")
    columns = [row['name'] for row in cursor.fetchall()]
    
    fields = {
        'user_id': user_id,
        'amount': amount,
        'category': category,
        'description': description,
        'date': date,
        'bank_mode': bank_mode,
        'payment_type': payment_type,
        'payment_category': payment_category,
        'interest': interest,
        'payment_method': payment_method,
        'status': status
    }
    
    # Add any extra kwargs that match column names
    for k, v in kwargs.items():
        if k in columns:
            fields[k] = v
            
    # Filter to ensure all keys exist in the table columns
    fields = {k: v for k, v in fields.items() if k in columns}
    
    placeholders = ', '.join(['?'] * len(fields))
    col_names = ', '.join(fields.keys())
    values = tuple(fields.values())
    
    query = f"INSERT INTO expenses ({col_names}) VALUES ({placeholders})"
    cursor.execute(query, values)
    conn.commit()
    expense_id = cursor.lastrowid
    conn.close()
    return expense_id

def get_expenses(user_id, category=None, start_date=None, end_date=None, search=None, bank_mode=None, payment_type=None, payment_category=None, month=None, year=None, payment_method=None, status=None):
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
        query += ' AND (description LIKE ? OR category LIKE ? OR bank_mode LIKE ? OR payment_type LIKE ? OR CAST(amount AS TEXT) LIKE ?)'
        params.append(f'%{search}%')
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

    if status:
        query += ' AND status = ?'
        params.append(status)
        
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

def update_expense(expense_id, user_id, amount, category, description, date, bank_mode=None, payment_type=None, payment_category=None, interest=0.0, payment_method='Debit', status='Paid', **kwargs):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(expenses)")
    columns = [row['name'] for row in cursor.fetchall()]
    
    fields = {
        'amount': amount,
        'category': category,
        'description': description,
        'date': date,
        'bank_mode': bank_mode,
        'payment_type': payment_type,
        'payment_category': payment_category,
        'interest': interest,
        'payment_method': payment_method,
        'status': status
    }
    
    for k, v in kwargs.items():
        if k in columns:
            fields[k] = v
            
    # Filter to actual columns
    fields = {k: v for k, v in fields.items() if k in columns}
    
    set_clause = ', '.join([f"{k} = ?" for k in fields.keys()])
    values = list(fields.values())
    values.extend([expense_id, user_id])
    
    query = f"UPDATE expenses SET {set_clause} WHERE id = ? AND user_id = ?"
    cursor.execute(query, values)
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def update_expense_status(expense_id, user_id, status):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE expenses SET status = ? WHERE id = ? AND user_id = ?",
        (status, expense_id, user_id)
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

def update_user_password_by_username(username, password_hash):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET password_hash = ? WHERE username = ?', (password_hash, username))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def update_user_password(user_id, password_hash):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

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
def get_excel_columns(target_type=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if target_type:
        cols = cursor.execute("SELECT column_key, column_label, is_enabled_import, is_enabled_export, is_required, target_type, display_order, parent_column_key, parent_trigger_value FROM excel_columns WHERE target_type = ? ORDER BY display_order ASC", (target_type,)).fetchall()
    else:
        cols = cursor.execute("SELECT column_key, column_label, is_enabled_import, is_enabled_export, is_required, target_type, display_order, parent_column_key, parent_trigger_value FROM excel_columns ORDER BY display_order ASC").fetchall()
    conn.close()
    return [dict(c) for c in cols]

def update_excel_column_status(column_key, type_key, is_enabled, target_type='expense'):
    conn = get_db_connection()
    cursor = conn.cursor()
    field = 'is_enabled_import' if type_key == 'import' else 'is_enabled_export'
    cursor.execute(
        f"UPDATE excel_columns SET {field} = ? WHERE column_key = ? AND target_type = ?",
        (int(is_enabled), column_key, target_type)
    )
    conn.commit()
    conn.close()
    return True

# EMI HELPERS
def add_emi(user_id, name, principal_amount, emi_amount, start_date, end_date, tenure_months, interest_rate, due_date, payment_type, payment_gateway, payment_bank, **kwargs):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(emis)")
    columns = [row['name'] for row in cursor.fetchall()]
    
    fields = {
        'user_id': user_id,
        'name': name,
        'principal_amount': principal_amount,
        'emi_amount': emi_amount,
        'start_date': start_date,
        'end_date': end_date,
        'tenure_months': tenure_months,
        'interest_rate': interest_rate,
        'due_date': due_date,
        'payment_type': payment_type,
        'payment_gateway': payment_gateway,
        'payment_bank': payment_bank
    }
    
    for k, v in kwargs.items():
        if k in columns:
            fields[k] = v
            
    fields = {k: v for k, v in fields.items() if k in columns}
    
    placeholders = ', '.join(['?'] * len(fields))
    col_names = ', '.join(fields.keys())
    values = tuple(fields.values())
    
    query = f"INSERT INTO emis ({col_names}) VALUES ({placeholders})"
    cursor.execute(query, values)
    conn.commit()
    emi_id = cursor.lastrowid
    conn.close()
    return emi_id

def get_emis(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    emis = cursor.execute('SELECT * FROM emis WHERE user_id = ? ORDER BY start_date DESC', (user_id,)).fetchall()
    conn.close()
    return [dict(row) for row in emis]

def get_all_emis():
    conn = get_db_connection()
    cursor = conn.cursor()
    emis = cursor.execute(
        '''SELECT emis.*, users.username 
           FROM emis JOIN users ON emis.user_id = users.id 
           ORDER BY emis.start_date DESC'''
    ).fetchall()
    conn.close()
    return [dict(row) for row in emis]

def get_emi_by_id(emi_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    emi = cursor.execute('SELECT * FROM emis WHERE id = ?', (emi_id,)).fetchone()
    conn.close()
    return dict(emi) if emi else None

def update_emi(emi_id, name, principal_amount, emi_amount, start_date, end_date, tenure_months, interest_rate, due_date, payment_type, payment_gateway, payment_bank, user_id=None, **kwargs):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(emis)")
    columns = [row['name'] for row in cursor.fetchall()]
    
    fields = {
        'name': name,
        'principal_amount': principal_amount,
        'emi_amount': emi_amount,
        'start_date': start_date,
        'end_date': end_date,
        'tenure_months': tenure_months,
        'interest_rate': interest_rate,
        'due_date': due_date,
        'payment_type': payment_type,
        'payment_gateway': payment_gateway,
        'payment_bank': payment_bank
    }
    
    for k, v in kwargs.items():
        if k in columns:
            fields[k] = v
            
    fields = {k: v for k, v in fields.items() if k in columns}
    
    set_clause = ', '.join([f"{k} = ?" for k in fields.keys()])
    values = list(fields.values())
    
    if user_id is not None:
        query = f"UPDATE emis SET {set_clause} WHERE id = ? AND user_id = ?"
        values.extend([emi_id, user_id])
    else:
        query = f"UPDATE emis SET {set_clause} WHERE id = ?"
        values.append(emi_id)
        
    cursor.execute(query, values)
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def delete_emi(emi_id, user_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id is not None:
        cursor.execute('DELETE FROM emis WHERE id = ? AND user_id = ?', (emi_id, user_id))
    else:
        cursor.execute('DELETE FROM emis WHERE id = ?', (emi_id,))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def get_all_currencies():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM currencies ORDER BY country ASC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_active_currency():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM currencies WHERE is_active = 1 LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return {'country': 'India', 'country_desc': 'Indian Rupee', 'symbol': '₹'}

def add_currency(country, country_desc, symbol):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO currencies (country, country_desc, symbol, is_active) VALUES (?, ?, ?, 0)',
            (country, country_desc, symbol)
        )
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return last_id
    except sqlite3.IntegrityError:
        conn.close()
        return None

def update_currency(currency_id, country, country_desc, symbol):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE currencies SET country = ?, country_desc = ?, symbol = ? WHERE id = ?',
            (country, country_desc, symbol, currency_id)
        )
        conn.commit()
        rows_affected = cursor.rowcount
        conn.close()
        return rows_affected > 0
    except sqlite3.IntegrityError:
        conn.close()
        return False

def delete_currency(currency_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    active = cursor.execute('SELECT is_active FROM currencies WHERE id = ?', (currency_id,)).fetchone()
    cursor.execute('DELETE FROM currencies WHERE id = ?', (currency_id,))
    conn.commit()
    rows_affected = cursor.rowcount
    if active and active[0] == 1:
        cursor.execute('SELECT id FROM currencies LIMIT 1')
        next_row = cursor.fetchone()
        if next_row:
            cursor.execute('UPDATE currencies SET is_active = 1 WHERE id = ?', (next_row[0],))
            conn.commit()
    conn.close()
    return rows_affected > 0

def set_active_currency(currency_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE currencies SET is_active = 0')
    cursor.execute('UPDATE currencies SET is_active = 1 WHERE id = ?', (currency_id,))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully at:", DB_PATH)

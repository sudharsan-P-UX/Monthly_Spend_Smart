# database/VercelDb.py: PostgreSQL helper functions and database wrapper for MonthlyExpenseUdDB

import os
import re
import uuid
import hashlib
import datetime
import sqlite3
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
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
        DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'expenses.db')

class PostgresCursorWrapper:
    def __init__(self, cursor):
        self.cursor = cursor
        self._lastrowid = None

    def execute(self, query, params=None):
        # Convert ? to %s for postgres
        query = query.replace('?', '%s')

        # Translate simple metadata queries
        if "PRAGMA table_info" in query:
            match = re.search(r"table_info\((\w+)\)", query, re.IGNORECASE)
            if match:
                table_name = match.group(1)
                query = f"SELECT column_name AS name FROM information_schema.columns WHERE table_name = '{table_name}'"

        if "strftime('%m', date)" in query:
            query = query.replace("strftime('%m', date)", "substring(date from 6 for 2)")
        if "strftime('%Y', date)" in query:
            query = query.replace("strftime('%Y', date)", "substring(date from 1 for 4)")

        if "INSERT OR IGNORE" in query:
            query = query.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            query += " ON CONFLICT DO NOTHING"

        if "INSERT OR REPLACE" in query:
            query = query.replace("INSERT OR REPLACE INTO", "INSERT INTO")
            # Dynamic conflict updates
            if "role_privileges" in query:
                query += " ON CONFLICT (role_id) DO UPDATE SET can_view = EXCLUDED.can_view, can_add = EXCLUDED.can_add, can_edit = EXCLUDED.can_edit, can_delete = EXCLUDED.can_delete"
            elif "settings" in query:
                query += " ON CONFLICT (Setting) DO UPDATE SET value = EXCLUDED.value"
            else:
                query += " ON CONFLICT DO NOTHING"

        if "AUTOINCREMENT" in query:
            query = query.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            query = query.replace("AUTOINCREMENT", "")

        is_insert = query.strip().upper().startswith("INSERT INTO")
        if is_insert and "RETURNING" not in query.upper():
            # Check what key we return
            table_match = re.search(r"INSERT\s+(?:IGNORE\s+|OR\s+REPLACE\s+)?INTO\s+([A-Za-z0-9_]+)", query, re.IGNORECASE)
            if table_match:
                table_name = table_match.group(1).lower()
                pk_map = {
                    'reffieldtype': 'FieldTypeId',
                    'refhome': 'RefHomeId',
                    'refaddexpensemenu': 'AddExpenseMenuId',
                    'refemimenu': 'EmiMenuId',
                    'refrole': 'RoleId',
                    'role': 'RoleId',
                    'refroleaccess': 'RoleAccessId',
                    'importexport': 'ImportExportId',
                    'importexportdtl': 'ImportExportDtlId',
                    'refusers': 'LoginId',
                    'users': 'LoginId',
                    'userrole': 'UserRoleId',
                    'userlogindetails': 'UserLoginDtlId',
                    'refcurreny': 'CurrencyId',
                    'currency': 'CurrencyId',
                    'settings': 'Settingid'
                }
                if table_name == 'excel_columns':
                    pk_col = 'column_key'
                else:
                    pk_col = pk_map.get(table_name, 'id')
                query = query.rstrip('; ') + f" RETURNING {pk_col}"

        try:
            self.cursor.execute(query, params)
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
        return self

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
            row = self.cursor.fetchone()
            if row is not None:
                # Map column access to dictionary-like lowercase keys
                return row
            return None
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

def get_vercel_db_connection():
    """Obtains a Postgres connection compatible with Vercel deployment requirements."""
    if DATABASE_URL:
        try:
            url = DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            conn = psycopg2.connect(url, connect_timeout=15)
            return PostgresConnectionWrapper(conn)
        except Exception as e:
            print(f"[DATABASE WARNING] Failed to connect to Postgres via DATABASE_URL: {e}. Falling back to SQLite.")
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            return conn
    elif os.environ.get('POSTGRES_HOST'):
        is_local = POSTGRES_HOST in ('localhost', '127.0.0.1', '::1')
        sslmode = 'prefer' if is_local else 'require'
        try:
            conn = psycopg2.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                dbname=POSTGRES_DB,
                connect_timeout=15,
                sslmode=sslmode
            )
            return PostgresConnectionWrapper(conn)
        except psycopg2.OperationalError as e:
            print(f"[DATABASE WARNING] Failed to connect to PostgreSQL at {POSTGRES_HOST}: {e}.")
            if "does not exist" in str(e):
                try:
                    conn_default = psycopg2.connect(
                        host=POSTGRES_HOST,
                        port=POSTGRES_PORT,
                        user=POSTGRES_USER,
                        password=POSTGRES_PASSWORD,
                        dbname="postgres",
                        connect_timeout=15,
                        sslmode=sslmode
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
                        dbname=POSTGRES_DB,
                        connect_timeout=15,
                        sslmode=sslmode
                    )
                    return PostgresConnectionWrapper(conn)
                except Exception as create_err:
                    print(f"[DATABASE ERROR] Failed to auto-create database {POSTGRES_DB}: {create_err}. Falling back to SQLite.")
                    conn = sqlite3.connect(DB_PATH)
                    conn.row_factory = sqlite3.Row
                    return conn
            else:
                print(f"[DATABASE WARNING] Falling back to SQLite due to: {e}")
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def init_vercel_db():
    """Initializes the database schema from VercelDb.sql if deployed on Postgres/Vercel."""
    conn = get_vercel_db_connection()
    cursor = conn.cursor()
    
    # Read and execute schema
    schema_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'VercelDb.sql')
    if os.path.exists(schema_path):
        with open(schema_path, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        # Execute script block by block or altogether depending on connection type
        if isinstance(conn, PostgresConnectionWrapper):
            try:
                # Remove commented lines and split by semicolon
                statements = [s.strip() for s in sql.split(';') if s.strip()]
                for stmt in statements:
                    cursor.execute(stmt)
                
                # Reset sequences for tables that were seeded with explicit IDs
                seeded_tables = [
                    ('reffieldtype', 'fieldtypeid'),
                    ('refrole', 'roleid'),
                    ('refimportexport', 'importexportid'),
                    ('refcurreny', 'currencyid'),
                    ('categories', 'id'),
                    ('bank_modes', 'id'),
                    ('payment_types', 'id'),
                    ('payment_categories', 'id')
                ]
                for table, pk in seeded_tables:
                    try:
                        cursor.execute(f"SELECT setval(pg_get_serial_sequence('{table}', '{pk}'), COALESCE(MAX({pk}), 1)) FROM {table}")
                    except Exception as seq_err:
                        print(f"Error resetting sequence for {table}: {seq_err}")
                
                conn.commit()
            except Exception as e:
                print(f"Error running VercelDb.sql: {e}")
                conn.rollback()
        else:
            # SQLite fallback: we need to adapt a few columns, but let's run standard SQL statements
            try:
                # Clean up Postgres-specific syntax
                sql_clean = re.sub(r'SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT', sql, flags=re.IGNORECASE)
                sql_clean = re.sub(r'TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'DATETIME DEFAULT CURRENT_TIMESTAMP', sql_clean, flags=re.IGNORECASE)
                sql_clean = re.sub(r'TIMESTAMP DEFAULT \(CURRENT_TIMESTAMP \+ INTERVAL \'90 days\'\)', "DATETIME", sql_clean, flags=re.IGNORECASE)
                sql_clean = re.sub(r'TIMESTAMP', 'DATETIME', sql_clean, flags=re.IGNORECASE)
                sql_clean = re.sub(r'ON CONFLICT \([^\)]+\) DO NOTHING', '', sql_clean, flags=re.IGNORECASE)
                sql_clean = re.sub(r'INSERT INTO', 'INSERT OR IGNORE INTO', sql_clean, flags=re.IGNORECASE)
                statements = [s.strip() for s in sql_clean.split(';') if s.strip()]
                for stmt in statements:
                    try:
                        cursor.execute(stmt)
                    except Exception as stmt_err:
                        err_msg = str(stmt_err).encode('ascii', 'ignore').decode('ascii')
                        stmt_msg = str(stmt).encode('ascii', 'ignore').decode('ascii')
                        print(f"Failed SQLite statement: {stmt_msg} -> {err_msg}")
                conn.commit()
            except Exception as e:
                err_msg = str(e).encode('ascii', 'ignore').decode('ascii')
                print(f"Error running SQLite init: {err_msg}")
                conn.rollback()
                
    conn.close()

# Password encryption Helpers (saltkey + password)
def generate_salt():
    return uuid.uuid4().hex

def encrypt_password(password, salt):
    """Encrypts a password with the salt using SHA256."""
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def verify_encrypted_password(password, salt, stored_hash):
    return encrypt_password(password, salt) == stored_hash

# Login tracking and password expiry (90 days)
def log_user_login(login_id, browser, otp=None):
    conn = get_vercel_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO UserLoginDetails (Loginid, LoginDate, Browser, Otp) VALUES (?, CURRENT_TIMESTAMP, ?, ?)",
            (login_id, browser, otp)
        )
        conn.commit()
        detail_id = cursor.lastrowid
        return detail_id
    finally:
        conn.close()

def log_user_logout(login_id):
    conn = get_vercel_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE UserLoginDetails SET LogOutDate = CURRENT_TIMESTAMP WHERE Loginid = ? AND LogOutDate IS NULL",
            (login_id,)
        )
        conn.commit()
    finally:
        conn.close()

def check_password_expiry(login_id):
    """Checks if the user password has expired (90 days)."""
    conn = get_vercel_db_connection()
    cursor = conn.cursor()
    try:
        row = cursor.execute(
            "SELECT PasswordExpiry, lastchangePassword FROM UserRole WHERE LoginId = ? LIMIT 1",
            (login_id,)
        ).fetchone()
        if row:
            expiry = row['passwordexpiry'] if 'passwordexpiry' in row else row[0]
            if not expiry:
                return False # Not expired if not set
            
            if isinstance(expiry, str):
                try:
                    expiry = datetime.datetime.strptime(expiry.split('.')[0], "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    expiry = datetime.date.fromisoformat(expiry)
            
            if isinstance(expiry, datetime.date) and not isinstance(expiry, datetime.datetime):
                expiry = datetime.datetime.combine(expiry, datetime.time.min)
                
            return datetime.datetime.now() > expiry
        return False
    except Exception:
        return False
    finally:
        conn.close()

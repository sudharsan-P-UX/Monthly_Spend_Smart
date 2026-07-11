# database/connection.py: Database connection management delegating to VercelDb

import os
from database.VercelDb import (
    get_vercel_db_connection,
    init_vercel_db,
    PostgresCursorWrapper,
    PostgresConnectionWrapper,
    generate_salt,
    encrypt_password
)

DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
DB_PATH = os.environ.get('DATABASE_PATH')

def get_db_connection():
    return get_vercel_db_connection()

def init_db():
    # 1. Initialize schema from VercelDb.sql
    init_vercel_db()
    
    # Run schema migrations
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE Refusers ADD COLUMN active_currency_id INTEGER")
        conn.commit()
    except Exception:
        pass
    try:
        cursor.execute("INSERT OR IGNORE INTO settings (Setting, value) VALUES ('inline_add_enabled', '0')")
        conn.commit()
    except Exception:
        pass
    try:
        # Force register_email_otp_enabled to 0 by default
        cursor.execute("UPDATE settings SET value = '0' WHERE Setting = 'register_email_otp_enabled'")
        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()
    
    # Migration to create role_privileges table
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS role_privileges (
                id SERIAL PRIMARY KEY,
                role_id INTEGER NOT NULL REFERENCES RefRole(RoleId) ON DELETE CASCADE,
                privilege_name VARCHAR(100) NOT NULL,
                display_order INTEGER DEFAULT 1,
                can_add INTEGER DEFAULT 1,
                can_edit INTEGER DEFAULT 1,
                can_delete INTEGER DEFAULT 1,
                can_view INTEGER DEFAULT 1,
                is_mandatory INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 1,
                UNIQUE (role_id, privilege_name)
            )
        """)
        conn.commit()
        
        default_privileges = [
            "EMI Columns List",
            "Add Custom Column for EMIs",
            "Expense Categories",
            "Create Category",
            "Expense Columns List",
            "Add Custom Column for Expenses",
            "Excel Import & Export Columns",
            "Add Custom Column",
            "All Currencies",
            "Add Currency"
        ]
        
        for r_id in [1, 2, 3]:
            for idx, priv in enumerate(default_privileges):
                exists = cursor.execute('SELECT 1 FROM role_privileges WHERE role_id = ? AND privilege_name = ?', (r_id, priv)).fetchone()
                if not exists:
                    val = 1 if r_id == 1 else 0
                    view_val = 1 if r_id == 1 else 0
                    cursor.execute(
                        'INSERT INTO role_privileges (role_id, privilege_name, display_order, can_add, can_edit, can_delete, can_view, is_mandatory, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)',
                        (r_id, priv, idx + 1, val, val, val, view_val)
                    )
        conn.commit()
    except Exception as e:
        print(f"Error migrating role_privileges: {e}")
    finally:
        conn.close()

    # Migration to create custom_labels table
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS custom_labels (
                label_key VARCHAR(255) PRIMARY KEY,
                label_category VARCHAR(100) NOT NULL,
                default_value TEXT NOT NULL,
                custom_value TEXT
            )
        """)
        conn.commit()
        
        default_labels = [
            ("home_dashboard", "Home", "Dashboard"),
            ("home_add_expense", "Home", "Add Expense"),
            ("home_emi", "Home", "EMI"),
            ("home_overview", "Home", "Overview"),
            ("home_admin", "Home", "Admin"),
            ("home_slogan", "Home", "Track your daily spendings and keep your finances healthy."),
            ("home_this_month", "Home", "This Month"),
            ("home_total_spent", "Home", "Total Spent"),
            ("home_transactions", "Home", "Transactions"),
            
            ("all_expenses_date", "All Expenses", "Date"),
            ("all_expenses_category", "All Expenses", "Category"),
            ("all_expenses_description", "All Expenses", "Description"),
            ("all_expenses_amount", "All Expenses", "Amount"),
            ("all_expenses_method", "All Expenses", "Method"),
            
            ("monthly_expenses_date", "This Month's Expenses", "Date"),
            ("monthly_expenses_category", "This Month's Expenses", "Category"),
            ("monthly_expenses_description", "This Month's Expenses", "Description"),
            ("monthly_expenses_amount", "This Month's Expenses", "Amount"),
            ("monthly_expenses_method", "This Month's Expenses", "Method"),
            
            # Recent Expenses
            ("recent_expenses_filtered_debits_lbl", "Recent Expenses", "Filtered Debits"),
            ("recent_expenses_filtered_credits_lbl", "Recent Expenses", "Filtered Credits"),
            ("recent_expenses_filter_btn", "Recent Expenses", "Filter"),
            ("recent_expenses_import_btn", "Recent Expenses", "Import"),
            ("recent_expenses_export_btn", "Recent Expenses", "Export"),
            ("recent_expenses_debits_lbl", "Recent Expenses", "Debits"),
            ("recent_expenses_credits_lbl", "Recent Expenses", "Credits"),
            ("recent_expenses_date", "Recent Expenses", "Date"),
            ("recent_expenses_category", "Recent Expenses", "Category"),
            ("recent_expenses_description", "Recent Expenses", "Description"),
            ("recent_expenses_gateway", "Recent Expenses", "Gateway"),
            ("recent_expenses_source", "Recent Expenses", "Source"),
            ("recent_expenses_method", "Recent Expenses", "Method"),
            ("recent_expenses_amount", "Recent Expenses", "Amount"),
            ("recent_expenses_interest", "Recent Expenses", "Interest"),
            ("recent_expenses_status", "Recent Expenses", "Status"),
            ("recent_expenses_actions", "Recent Expenses", "Actions"),
            
            # Filtered Debits Modal
            ("filtered_debits_title", "Filtered Debits Modal", "Filtered Debits"),
            ("filtered_debits_date", "Filtered Debits Modal", "Date"),
            ("filtered_debits_category", "Filtered Debits Modal", "Category"),
            ("filtered_debits_description", "Filtered Debits Modal", "Description"),
            ("filtered_debits_amount", "Filtered Debits Modal", "Amount"),
            ("filtered_debits_method", "Filtered Debits Modal", "Method"),
            
            # Filtered Credits Modal
            ("filtered_credits_title", "Filtered Credits Modal", "Filtered Credits"),
            ("filtered_credits_date", "Filtered Credits Modal", "Date"),
            ("filtered_credits_category", "Filtered Credits Modal", "Category"),
            ("filtered_credits_description", "Filtered Credits Modal", "Description"),
            ("filtered_credits_amount", "Filtered Credits Modal", "Amount"),
            ("filtered_credits_method", "Filtered Credits Modal", "Method"),
            
            # Year Debits Modal
            ("year_debits_title", "Year Debits Modal", "{year} Debits"),
            ("year_debits_date", "Year Debits Modal", "Date"),
            ("year_debits_category", "Year Debits Modal", "Category"),
            ("year_debits_description", "Year Debits Modal", "Description"),
            ("year_debits_amount", "Year Debits Modal", "Amount"),
            ("year_debits_method", "Year Debits Modal", "Method"),
            
            # Year Credits Modal
            ("year_credits_title", "Year Credits Modal", "{year} Credits"),
            ("year_credits_date", "Year Credits Modal", "Date"),
            ("year_credits_category", "Year Credits Modal", "Category"),
            ("year_credits_description", "Year Credits Modal", "Description"),
            ("year_credits_amount", "Year Credits Modal", "Amount"),
            ("year_credits_method", "Year Credits Modal", "Method"),

            # Administration Panel
            ("admin_panel_title", "Administration Panel", "Administration Panel"),
            ("admin_tab_users", "Administration Panel", "Users"),
            ("admin_tab_emis", "Administration Panel", "EMIs"),
            ("admin_tab_roles", "Administration Panel", "Roles"),
            ("admin_tab_expense_control", "Administration Panel", "Expense Control List"),
            ("admin_tab_expense_columns", "Administration Panel", "Expense Columns"),
            ("admin_tab_excel_columns", "Administration Panel", "Excel Columns"),
            ("admin_tab_currencies", "Administration Panel", "Currencies"),
            ("admin_tab_labels", "Administration Panel", "Label List"),

            # Security Settings (OTP Verification)
            ("admin_security_title", "Security Settings", "Security Settings (OTP Verification)"),

            # System Users Sub-Tab
            ("admin_users_title", "System Users", "System Users"),
            ("admin_users_create_title", "System Users", "Create New User"),
            
            # Dynamic lists headers
            ("admin_emis_title", "EMIs", "EMI Columns List"),
            ("admin_emis_create_title", "EMIs", "Add Custom Column for EMIs"),
            ("admin_roles_title", "Roles", "Roles"),
            ("admin_roles_create_title", "Roles", "Create New Role"),
            ("admin_expense_control_title", "Expense Control List", "Expense Control List"),
            ("admin_expense_columns_title", "Expense Columns", "Expense Columns List"),
            ("admin_expense_columns_create_title", "Expense Columns", "Add Custom Column for Expenses"),
            ("admin_excel_columns_title", "Excel Columns", "Excel Import & Export Columns"),
            ("admin_excel_columns_create_title", "Excel Columns", "Add Custom Column"),
            ("admin_currencies_title", "Currencies", "All Currencies"),
            ("admin_currencies_create_title", "Currencies", "Add Currency"),

            # EMI Column List
            ("emi_columns_description", "EMI Column List", "Manage import/export status and display order for EMI fields. Required fields cannot be disabled. Lower order values display first."),
            ("emi_columns_th_label", "EMI Column List", "Column Label"),
            ("emi_columns_th_field", "EMI Column List", "Database Field"),
            ("emi_columns_th_required", "EMI Column List", "Required"),
            ("emi_columns_th_order", "EMI Column List", "Order"),
            ("emi_columns_th_status", "EMI Column List", "Status"),
            ("emi_columns_th_actions", "EMI Column List", "Actions"),

            # Add Custom Column for EMIs
            ("add_emi_col_field_key", "Add Custom Column for EMIs", "Database Field Key *"),
            ("add_emi_col_label", "Add Custom Column for EMIs", "Column Label / Header *"),
            ("add_emi_col_order", "Add Custom Column for EMIs", "Display Order"),
            ("add_emi_col_parent", "Add Custom Column for EMIs", "Parent Column (Optional)"),
            ("add_emi_col_trigger", "Add Custom Column for EMIs", "Parent Trigger Value"),
            ("add_emi_col_import", "Add Custom Column for EMIs", "Enable Import"),
            ("add_emi_col_export", "Add Custom Column for EMIs", "Enable Export"),

            # Role Privileges
            ("role_privs_select_lbl", "Role Privileges", "Select Role:"),
            ("role_privs_th_list", "Role Privileges", "Privilege List"),
            ("role_privs_th_order", "Role Privileges", "Order"),
            ("role_privs_th_add", "Role Privileges", "Add"),
            ("role_privs_th_edit", "Role Privileges", "Edit"),
            ("role_privs_th_delete", "Role Privileges", "Delete"),
            ("role_privs_th_view", "Role Privileges", "View"),
            ("role_privs_th_mandatory", "Role Privileges", "Mandatory"),
            ("role_privs_th_isactive", "Role Privileges", "IsActive"),

            # Create New Role
            ("create_role_name_lbl", "Create New Role", "Role Name *"),
            ("create_role_btn", "Create New Role", "Create Role"),

            # Expense Categories
            ("exp_cats_manage_type_lbl", "Expense Categories", "Manage List Type:"),
            ("exp_cats_th_name", "Expense Categories", "Category Name"),
            ("exp_cats_th_order", "Expense Categories", "Display Order"),
            ("exp_cats_th_actions", "Expense Categories", "Actions"),
            ("exp_cats_save_btn", "Expense Categories", "Save Changes"),

            # Create Category
            ("create_cat_name_lbl", "Create Category", "Category Name *"),
            ("create_cat_order_lbl", "Create Category", "Display Order"),
            ("create_cat_btn", "Create Category", "Create Category"),

            # Expense Columns List
            ("exp_cols_description", "Expense Columns List", "Manage import/export status and display order for Expense fields. Required fields cannot be disabled. Lower order values display first."),
            ("exp_cols_th_label", "Expense Columns List", "Column Label"),
            ("exp_cols_th_field", "Expense Columns List", "Database Field"),
            ("exp_cols_th_required", "Expense Columns List", "Required"),
            ("exp_cols_th_order", "Expense Columns List", "Order"),
            ("exp_cols_th_status", "Expense Columns List", "Status"),
            ("exp_cols_th_actions", "Expense Columns List", "Actions"),

            # Add Custom Column for Expenses
            ("add_exp_col_field_key", "Add Custom Column for Expenses", "Database Field Key *"),
            ("add_exp_col_label", "Add Custom Column for Expenses", "Column Label / Header *"),
            ("add_exp_col_order", "Add Custom Column for Expenses", "Display Order"),
            ("add_exp_col_parent", "Add Custom Column for Expenses", "Parent Column (Optional)"),
            ("add_exp_col_trigger", "Add Custom Column for Expenses", "Parent Trigger Value"),
            ("add_exp_col_import", "Add Custom Column for Expenses", "Enable Import"),
            ("add_exp_col_export", "Add Custom Column for Expenses", "Enable Export"),
            ("add_exp_col_btn", "Add Custom Column for Expenses", "Create Column"),

            # Excel Import & Export Columns
            ("excel_cols_description", "Excel Import & Export Columns", "Enable or disable optional columns for the Excel templates, exports, and imports. Required columns must always remain active to ensure entries can be properly parsed and saved."),
            ("excel_cols_th_label", "Excel Import & Export Columns", "Column Label"),
            ("excel_cols_th_field", "Excel Import & Export Columns", "Database Field"),
            ("excel_cols_th_required", "Excel Import & Export Columns", "Required"),
            ("excel_cols_th_order", "Excel Import & Export Columns", "Order"),
            ("excel_cols_th_status", "Excel Import & Export Columns", "Status"),
            ("excel_cols_th_actions", "Excel Import & Export Columns", "Actions"),
            ("excel_cols_save_btn", "Excel Import & Export Columns", "Save Changes"),

            # Add Custom Column (Excel)
            ("add_excel_col_field_key", "Add Custom Column", "Database Field Key *"),
            ("add_excel_col_label", "Add Custom Column", "Column Label / Header *"),
            ("add_excel_col_order", "Add Custom Column", "Display Order"),
            ("add_excel_col_parent", "Add Custom Column", "Parent Column (Optional)"),
            ("add_excel_col_trigger", "Add Custom Column", "Parent Trigger Value"),
            ("add_excel_col_target", "Add Custom Column", "Target Table *"),
            ("add_excel_col_import", "Add Custom Column", "Enable Import"),
            ("add_excel_col_export", "Add Custom Column", "Enable Export"),
            ("add_excel_col_btn", "Add Custom Column", "Create Column"),

            # All Currencies
            ("currencies_th_country", "All Currencies", "Country"),
            ("currencies_th_description", "All Currencies", "Description"),
            ("currencies_th_symbol", "All Currencies", "Symbol"),
            ("currencies_th_active", "All Currencies", "Active"),
            ("currencies_th_actions", "All Currencies", "Actions"),

            # Add Currency
            ("add_currency_country_lbl", "Add Currency", "Country *"),
            ("add_currency_desc_lbl", "Add Currency", "Country Description *"),
            ("add_currency_symbol_lbl", "Add Currency", "Currency Symbol *"),
            ("add_currency_btn", "Add Currency", "Add Currency")
        ]
        
        for k, cat, def_val in default_labels:
            exists = cursor.execute('SELECT 1 FROM custom_labels WHERE label_key = ?', (k,)).fetchone()
            if not exists:
                cursor.execute(
                    'INSERT INTO custom_labels (label_key, label_category, default_value, custom_value) VALUES (?, ?, ?, NULL)',
                    (k, cat, def_val)
                )
        conn.commit()
    except Exception as e:
        print(f"Error migrating custom_labels: {e}")
    finally:
        conn.close()

    # 2. Seed default admin users if not present
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check and seed generic 'admin' user
        cursor.execute("SELECT COUNT(*) FROM Refusers WHERE Username = ?", ('admin',))
        row = cursor.fetchone()
        count = row[0] if row else 0
        if count == 0:
            salt = generate_salt()
            pwd_hash = encrypt_password('admin123', salt)
            cursor.execute(
                "INSERT INTO Refusers (Username, Firstname, Lastname, Email, Phone, saltkey, password, isactive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ('admin', 'System', 'Admin', 'admin@spendsmart.local', '1234567890', salt, pwd_hash, 1)
            )
            login_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO UserRole (LoginId, RoleId, isactive) VALUES (?, ?, ?)",
                (login_id, 1, 1)
            )
            cursor.execute("INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'category', name, display_order FROM categories", (login_id,))
            cursor.execute("INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'bank_mode', name, display_order FROM bank_modes", (login_id,))
            cursor.execute("INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'payment_type', name, display_order FROM payment_types", (login_id,))
            cursor.execute("INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'payment_category', name, display_order FROM payment_categories", (login_id,))
            conn.commit()
            print("Default admin user created successfully.")

        # Check and seed user-requested 'Admin' user
        cursor.execute("SELECT COUNT(*) FROM Refusers WHERE Username = ?", ('Admin',))
        row_requested = cursor.fetchone()
        count_requested = row_requested[0] if row_requested else 0
        if count_requested == 0:
            salt = generate_salt()
            pwd_hash = encrypt_password('admin123', salt)
            cursor.execute(
                "INSERT INTO Refusers (Username, Firstname, Lastname, Email, Phone, saltkey, password, isactive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ('Admin', 'Admin', 'user', 'adminuser@gmail.com', '9876543221', salt, pwd_hash, 1)
            )
            login_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO UserRole (LoginId, RoleId, isactive) VALUES (?, ?, ?)",
                (login_id, 1, 1)
            )
            cursor.execute("INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'category', name, display_order FROM categories", (login_id,))
            cursor.execute("INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'bank_mode', name, display_order FROM bank_modes", (login_id,))
            cursor.execute("INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'payment_type', name, display_order FROM payment_types", (login_id,))
            cursor.execute("INSERT OR IGNORE INTO user_expense_controls (user_id, control_type, name, display_order) SELECT ?, 'payment_category', name, display_order FROM payment_categories", (login_id,))
            conn.commit()
            print("Default Admin user (adminuser@gmail.com) created successfully.")
    except Exception as e:
        print(f"Error seeding default admin users: {e}")
        conn.rollback()
    finally:
        conn.close()

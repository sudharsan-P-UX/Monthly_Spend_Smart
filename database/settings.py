from database.connection import get_db_connection

def get_setting(key, default_value='0'):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        row = cursor.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
        if row:
            return row['value']
        return default_value
    except Exception:
        return default_value
    finally:
        conn.close()

def set_setting(key, value):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        row = cursor.execute('SELECT 1 FROM settings WHERE key = ?', (key,)).fetchone()
        if row:
            cursor.execute('UPDATE settings SET value = ? WHERE key = ?', (str(value), key))
        else:
            cursor.execute('INSERT INTO settings (key, value) VALUES (?, ?)', (key, str(value)))
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()

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

# database/currencies.py: Currency CRUD operations targeting Refcurreny table

import sqlite3
from database.connection import get_db_connection

def get_all_currencies():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        rows = cursor.execute('SELECT CurrencyId as id, Country as country, Description as country_desc, symbol, active as is_active FROM Refcurreny ORDER BY Country ASC').fetchall()
        return [{k.lower(): v for k, v in dict(r).items()} for r in rows]
    finally:
        conn.close()

def get_active_currency():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        row = cursor.execute('SELECT CurrencyId as id, Country as country, Description as country_desc, symbol, active as is_active FROM Refcurreny WHERE active = 1 LIMIT 1').fetchone()
        if row:
            # Create a dictionary where all keys are lowercase
            d = dict(row)
            return {k.lower(): v for k, v in d.items()}
        return {'country': 'India', 'country_desc': 'Indian Rupee', 'symbol': '₹'}
    finally:
        conn.close()

def add_currency(country, country_desc, symbol):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO Refcurreny (Country, Description, symbol, active) VALUES (?, ?, ?, 0)',
            (country, country_desc, symbol)
        )
        conn.commit()
        last_id = cursor.lastrowid
        return last_id
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def update_currency(currency_id, country, country_desc, symbol):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'UPDATE Refcurreny SET Country = ?, Description = ?, symbol = ? WHERE CurrencyId = ?',
            (country, country_desc, symbol, currency_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def delete_currency(currency_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        active_row = cursor.execute('SELECT active FROM Refcurreny WHERE CurrencyId = ?', (currency_id,)).fetchone()
        is_active = active_row['active'] if active_row else False
        
        cursor.execute('DELETE FROM Refcurreny WHERE CurrencyId = ?', (currency_id,))
        conn.commit()
        
        if is_active:
            # Set another currency as active if we deleted the active one
            next_row = cursor.execute('SELECT CurrencyId FROM Refcurreny LIMIT 1').fetchone()
            if next_row:
                next_id = next_row['currencyid'] if 'currencyid' in next_row else next_row[0]
                cursor.execute('UPDATE Refcurreny SET active = 1 WHERE CurrencyId = ?', (next_id,))
                conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()

def set_active_currency(currency_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('UPDATE Refcurreny SET active = 0')
        cursor.execute('UPDATE Refcurreny SET active = 1 WHERE CurrencyId = ?', (currency_id,))
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()

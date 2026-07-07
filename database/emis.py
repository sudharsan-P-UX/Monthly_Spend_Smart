from database.connection import get_db_connection

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

def delete_emis_bulk(emi_ids, user_id=None):
    if not emi_ids:
        return True
    conn = get_db_connection()
    cursor = conn.cursor()
    placeholders = ', '.join(['?'] * len(emi_ids))
    if user_id is not None:
        query = f'DELETE FROM emis WHERE id IN ({placeholders}) AND user_id = ?'
        params = list(emi_ids) + [user_id]
    else:
        query = f'DELETE FROM emis WHERE id IN ({placeholders})'
        params = list(emi_ids)
    cursor.execute(query, params)
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

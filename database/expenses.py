import datetime
from database.connection import get_db_connection

def add_expense(user_id, amount, category, description, date, bank_mode=None, payment_type=None, payment_category=None, interest=0.0, payment_method='Debit', status='Paid', **kwargs):
    conn = get_db_connection()
    cursor = conn.cursor()
    
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
    
    for k, v in kwargs.items():
        if k in columns:
            fields[k] = v
            
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

def auto_update_unpaid_expenses(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        is_pg = conn.__class__.__name__ == 'PostgresConnectionWrapper'
        if is_pg:
            cursor.execute(
                "UPDATE expenses SET status = 'Paid' WHERE user_id = ? AND date <= to_char(CURRENT_DATE, 'YYYY-MM-DD') AND status = 'Unpaid'",
                (user_id,)
            )
        else:
            cursor.execute(
                "UPDATE expenses SET status = 'Paid' WHERE user_id = ? AND date <= date('now', 'localtime') AND status = 'Unpaid'",
                (user_id,)
            )
        conn.commit()
    except Exception as e:
        print(f"Error in auto_update_unpaid_expenses: {e}")
        conn.rollback()
    finally:
        conn.close()

def get_expenses(user_id, category=None, start_date=None, end_date=None, search=None, bank_mode=None, payment_type=None, payment_category=None, month=None, year=None, payment_method=None, status=None):
    auto_update_unpaid_expenses(user_id)
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

def delete_expenses_bulk(expense_ids, user_id):
    if not expense_ids:
        return True
    conn = get_db_connection()
    cursor = conn.cursor()
    placeholders = ', '.join(['?'] * len(expense_ids))
    query = f'DELETE FROM expenses WHERE id IN ({placeholders}) AND user_id = ?'
    params = list(expense_ids) + [user_id]
    cursor.execute(query, params)
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def get_overview_data(user_id, month=None, year=None):
    auto_update_unpaid_expenses(user_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    
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
    
    category_data = cursor.execute(
        'SELECT category, SUM(amount) as total FROM expenses WHERE user_id = ? AND date LIKE ? GROUP BY category',
        (user_id, f'{selected_month_str}%')
    ).fetchall()
    
    categories = [dict(row) for row in category_data]
    
    trends = []
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

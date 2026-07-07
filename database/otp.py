import datetime
from database.connection import get_db_connection

def create_otp(target, otp_code, expiry_minutes=10):
    conn = get_db_connection()
    cursor = conn.cursor()
    expires_at = datetime.datetime.now() + datetime.timedelta(minutes=expiry_minutes)
    expires_str = expires_at.strftime('%Y-%m-%d %H:%M:%S')
    try:
        cursor.execute('DELETE FROM otps WHERE target = ?', (target,))
        cursor.execute(
            'INSERT INTO otps (target, otp, expires_at) VALUES (?, ?, ?)',
            (target, otp_code, expires_str)
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()

def verify_otp(target, otp_code):
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        row = cursor.execute(
            'SELECT * FROM otps WHERE target = ? AND otp = ? AND expires_at > ?',
            (target, otp_code, now_str)
        ).fetchone()
        if row:
            cursor.execute('DELETE FROM otps WHERE target = ?', (target,))
            conn.commit()
            return True
        return False
    except Exception:
        return False
    finally:
        conn.close()

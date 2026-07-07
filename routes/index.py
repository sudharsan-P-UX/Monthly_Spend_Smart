from flask import render_template, redirect, url_for, session

def is_logged_in():
    return 'user_id' in session

def register_index_routes(app):
    @app.route('/')
    def index():
        if not is_logged_in():
            return redirect(url_for('login'))
        return render_template('index.html', username=session.get('username'))

    @app.route('/logout')
    def logout():
        user_id = session.get('user_id')
        if user_id:
            try:
                import database.VercelDb
                database.VercelDb.log_user_logout(user_id)
            except Exception:
                pass
        session.clear()
        return redirect(url_for('login'))

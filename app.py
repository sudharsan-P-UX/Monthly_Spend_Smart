from flask import Flask
import os
from dotenv import load_dotenv

load_dotenv()
import database

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'spendsmart-default-secret-key-12345')

# Initialize database
database.init_db()

# Import route registration helpers
from routes.index import register_index_routes
from routes.login import register_login_routes
from routes.register import register_register_routes
from routes.expenses import register_expense_routes
from routes.emis import register_emi_routes
from routes.admin_users import register_admin_users_routes
from routes.admin_roles import register_admin_roles_routes
from routes.admin_categories import register_admin_categories_routes
from routes.admin_dropdowns import register_admin_dropdowns_routes
from routes.admin_settings import register_admin_settings_routes
from routes.admin_currencies import register_admin_currencies_routes
from routes.excel import register_excel_routes
from routes.chat import register_chat_routes
from routes.admin_labels import register_admin_labels_routes

# Register routes on app
register_index_routes(app)
register_login_routes(app)
register_register_routes(app)
register_expense_routes(app)
register_emi_routes(app)
register_admin_users_routes(app)
register_admin_roles_routes(app)
register_admin_categories_routes(app)
register_admin_dropdowns_routes(app)
register_admin_settings_routes(app)
register_admin_currencies_routes(app)
register_excel_routes(app)
register_chat_routes(app)
register_admin_labels_routes(app)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)

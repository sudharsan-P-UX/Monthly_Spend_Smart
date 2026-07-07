# verify_vercel_db.py: Unit tests to verify the VercelDb / Postgres schema and integration

import os
import unittest
import datetime

# Use a test SQLite file to test connection/schema logic without requiring actual PostgreSQL setup
os.environ['DATABASE_PATH'] = 'test_vercel_expenses.db'

# Import database module
import database
import database.VercelDb
import database.users
import database.currencies
import database.admin_data

class VercelDbTestCase(unittest.TestCase):
    def setUp(self):
        database.DB_PATH = 'test_vercel_expenses.db'
        database.connection.DB_PATH = 'test_vercel_expenses.db'
        database.VercelDb.DB_PATH = 'test_vercel_expenses.db'
        
        # Initialize test database
        database.init_db()
        
    def tearDown(self):
        # Remove test database
        if os.path.exists('test_vercel_expenses.db'):
            try:
                os.remove('test_vercel_expenses.db')
            except OSError:
                pass

    def test_tables_creation(self):
        """Test that all 12 requested tables and operational tables are successfully created."""
        conn = database.get_db_connection()
        cursor = conn.cursor()
        
        # List of tables to verify
        expected_tables = [
            'refhome', 'refaddexpensemenu', 'refemimenu', 'refrole', 
            'refroleaccess', 'refimportexport', 'refimportexportdetails', 
            'refusers', 'userrole', 'userlogindetails', 'refcurreny', 'reffieldtype',
            'expenses', 'emis', 'otps', 'settings'
        ]
        
        # Query existing tables in SQLite master
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0].lower() for row in cursor.fetchall()]
        
        for table in expected_tables:
            self.assertIn(table, tables, f"Table {table} was not created.")
            
        conn.close()

    def test_reffieldtype_seeding(self):
        """Verify RefFieldType contains correct default values."""
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT FieldTypeId, Description FROM REfFieldType ORDER BY FieldTypeId ASC")
        rows = cursor.fetchall()
        
        expected = [
            (1, 'Int'),
            (2, 'DateTime'),
            (3, 'Varchar'),
            (4, 'Decimal'),
            (5, 'Bit')
        ]
        for exp, actual in zip(expected, rows):
            self.assertEqual(actual[0], exp[0])
            self.assertEqual(actual[1], exp[1])
            
        conn.close()

    def test_refrole_and_privileges(self):
        """Verify RefRole seeding and privilege retrieval."""
        roles = database.admin_data.get_roles()
        self.assertTrue(len(roles) >= 3)
        
        # Find Admin role
        admin_role = next((r for r in roles if r['name'] == 'Admin'), None)
        self.assertIsNotNone(admin_role)
        self.assertEqual(admin_role['id'], 1)
        self.assertEqual(admin_role['can_edit'], 1)
        
        # Add new role
        new_role_id = database.admin_data.add_role("Manager")
        self.assertIsNotNone(new_role_id)
        
        # Verify Manager defaults to all access
        roles = database.admin_data.get_roles()
        manager_role = next((r for r in roles if r['id'] == new_role_id), None)
        self.assertIsNotNone(manager_role)
        self.assertEqual(manager_role['can_edit'], 1)
        
        # Update privileges to remove edit access
        database.admin_data.update_role_privileges(new_role_id, 1, 1, 0, 1)
        roles = database.admin_data.get_roles()
        manager_role = next((r for r in roles if r['id'] == new_role_id), None)
        self.assertEqual(manager_role['can_edit'], 0)

    def test_user_salted_password_and_login_logs(self):
        """Test salt generation, password hashing, and user role creation."""
        # Create user
        user_id = database.create_user(
            username='testuser', 
            password='testpassword123', 
            role_id=2, 
            first_name='Test', 
            last_name='User', 
            email='test@example.com', 
            phone='12345678'
        )
        self.assertIsNotNone(user_id)
        
        # Verify stored details
        user = database.get_user_by_username('testuser')
        self.assertIsNotNone(user)
        self.assertIsNotNone(user['saltkey'])
        self.assertNotEqual(user['password'], 'testpassword123')
        
        # Verify login
        verified_user = database.users.verify_user_password('testuser', 'testpassword123')
        self.assertIsNotNone(verified_user)
        self.assertEqual(verified_user['id'], user_id)
        
        # Verify bad password fails
        bad_user = database.users.verify_user_password('testuser', 'wrongpass')
        self.assertIsNone(bad_user)
        
        # Test session logging
        log_id = database.VercelDb.log_user_login(user_id, 'Chrome', '123456')
        self.assertIsNotNone(log_id)
        
        # Test password expiry (should not be expired yet since last change was just now)
        is_expired = database.VercelDb.check_password_expiry(user_id)
        self.assertFalse(is_expired)

    def test_currency_management(self):
        """Verify Refcurreny CRUD operations."""
        # Active currency should default to India/Rupee
        active = database.currencies.get_active_currency()
        self.assertEqual(active['country'], 'India')
        self.assertEqual(active['symbol'], '₹')
        
        # Add new currency
        curr_id = database.currencies.add_currency('Canada', 'Canadian Dollar', 'CA$')
        self.assertIsNotNone(curr_id)
        
        # Set active
        database.currencies.set_active_currency(curr_id)
        active = database.currencies.get_active_currency()
        self.assertEqual(active['country'], 'Canada')
        self.assertEqual(active['symbol'], 'CA$')

if __name__ == '__main__':
    unittest.main()

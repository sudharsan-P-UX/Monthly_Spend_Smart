import unittest
import json
from app import app
import database

class SuperAdminStatusColumnsTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_super_admin_status_columns_and_role1_privileges(self):
        # 1. Login as Super Admin
        login_resp = self.app.post('/login', data={
            'username': 'superadmin',
            'password': 'Superadmin@2018'
        }, follow_redirects=True)
        self.assertEqual(login_resp.status_code, 200)

        # 2. Save Excel column changes (toggling required column status)
        save_excel_resp = self.app.post('/api/admin/excel-columns/save-all',
            data=json.dumps({
                'columns': [
                    {'column_key': 'date', 'target_type': 'expense', 'display_order': 1, 'is_enabled': 0},
                    {'column_key': 'category', 'target_type': 'expense', 'display_order': 2, 'is_enabled': 1}
                ],
                'type_key': 'import'
            }),
            content_type='application/json'
        )
        self.assertEqual(save_excel_resp.status_code, 200)
        self.assertTrue(save_excel_resp.json.get('success'))

        # 3. Save Role 1 (Administrator) privileges as Super Admin
        save_role1_resp = self.app.post('/api/admin/roles/privileges/save',
            data=json.dumps({
                'role_id': 1,
                'privileges': [
                    {
                        'privilege_name': 'Expense Columns List',
                        'can_add': 1, 'can_edit': 1, 'can_delete': 1, 'can_view': 1,
                        'is_mandatory': 1, 'is_active': 1
                    }
                ]
            }),
            content_type='application/json'
        )
        self.assertEqual(save_role1_resp.status_code, 200)
        self.assertTrue(save_role1_resp.json.get('success'))

if __name__ == '__main__':
    unittest.main()

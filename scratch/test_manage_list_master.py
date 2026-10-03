import unittest
import json
from app import app
import database

class ManageListMasterTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_manage_list_master_operations(self):
        # 1. Login as Super Admin
        login_resp = self.app.post('/login', data={
            'username': 'superadmin',
            'password': 'Superadmin@2018'
        }, follow_redirects=True)
        self.assertEqual(login_resp.status_code, 200)

        # 2. Get Manage Lists
        get_resp = self.app.get('/api/admin/manage_lists')
        self.assertEqual(get_resp.status_code, 200)
        lists = get_resp.json
        self.assertGreaterEqual(len(lists), 4)

        # 3. Create a new Manage List
        create_resp = self.app.post('/api/admin/manage_lists/create',
            data=json.dumps({'name': 'Vendor List'}),
            content_type='application/json'
        )
        self.assertEqual(create_resp.status_code, 200)
        self.assertTrue(create_resp.json.get('success'))
        key = create_resp.json.get('key')
        self.assertEqual(key, 'vendor-list')

        # 4. Toggle Status
        toggle_resp = self.app.post(f'/api/admin/manage_lists/toggle/{key}',
            data=json.dumps({'is_active': 0}),
            content_type='application/json'
        )
        self.assertEqual(toggle_resp.status_code, 200)
        self.assertTrue(toggle_resp.json.get('success'))

        # 5. Add Sub-Item to custom Manage List
        add_sub_resp = self.app.post('/api/admin/manage_lists/subitems/add',
            data=json.dumps({'key': key, 'name': 'Vendor A', 'display_order': 1}),
            content_type='application/json'
        )
        self.assertEqual(add_sub_resp.status_code, 200)
        self.assertTrue(add_sub_resp.json.get('success'))
        sub_id = add_sub_resp.json.get('id')

        # 6. Fetch Sub-Items
        get_subs_resp = self.app.get(f'/api/admin/manage_lists/subitems/{key}')
        self.assertEqual(get_subs_resp.status_code, 200)
        subs = get_subs_resp.json
        self.assertEqual(len(subs), 1)
        self.assertEqual(subs[0]['name'], 'Vendor A')

        # 7. Edit Sub-Item
        edit_sub_resp = self.app.post(f'/api/admin/manage_lists/subitems/edit/{key}/{sub_id}',
            data=json.dumps({'name': 'Vendor A Updated', 'display_order': 2}),
            content_type='application/json'
        )
        self.assertEqual(edit_sub_resp.status_code, 200)
        self.assertTrue(edit_sub_resp.json.get('success'))

        # 8. Delete Sub-Item
        del_sub_resp = self.app.post(f'/api/admin/manage_lists/subitems/delete/{key}/{sub_id}')
        self.assertEqual(del_sub_resp.status_code, 200)
        self.assertTrue(del_sub_resp.json.get('success'))

        # 9. Delete custom Manage List
        del_list_resp = self.app.post(f'/api/admin/manage_lists/delete/{key}')
        self.assertEqual(del_list_resp.status_code, 200)
        self.assertTrue(del_list_resp.json.get('success'))

if __name__ == '__main__':
    unittest.main()

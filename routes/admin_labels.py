from flask import request, jsonify, session
import database
from routes.utils import is_logged_in, require_privilege

def register_admin_labels_routes(app):
    @app.route('/api/labels', methods=['GET'])
    def get_public_labels():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
            
        conn = database.get_db_connection()
        cursor = conn.cursor()
        try:
            rows = cursor.execute('SELECT label_key, default_value, custom_value FROM custom_labels').fetchall()
            labels = {}
            for r in rows:
                labels[r['label_key']] = r['custom_value'] if r['custom_value'] is not None else r['default_value']
            response = jsonify(labels)
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            return response
        finally:
            conn.close()

    @app.route('/api/admin/labels', methods=['GET'])
    @require_privilege('can_admin')
    def admin_get_labels():
        conn = database.get_db_connection()
        cursor = conn.cursor()
        try:
            rows = cursor.execute('SELECT label_key, label_category, default_value, custom_value FROM custom_labels').fetchall()
            response = jsonify([dict(r) for r in rows])
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            return response
        finally:
            conn.close()

    @app.route('/api/admin/labels/save', methods=['POST'])
    @require_privilege('can_admin')
    def admin_save_labels():
        data = request.get_json() or {}
        labels = data.get('labels', {})
        
        conn = database.get_db_connection()
        cursor = conn.cursor()
        try:
            for k, v in labels.items():
                row = cursor.execute('SELECT default_value FROM custom_labels WHERE label_key = ?', (k,)).fetchone()
                if row:
                    default_val = row['default_value']
                    val_to_save = v.strip()
                    if val_to_save == default_val or val_to_save == '':
                        cursor.execute('UPDATE custom_labels SET custom_value = NULL WHERE label_key = ?', (k,))
                    else:
                        cursor.execute('UPDATE custom_labels SET custom_value = ? WHERE label_key = ?', (val_to_save, k))
            conn.commit()
            return jsonify({'success': True, 'message': 'Labels updated successfully.'})
        except Exception as e:
            conn.rollback()
            return jsonify({'error': f'Failed to save labels: {e}'}), 500
        finally:
            conn.close()

# Implementation Plan: SpendSmart Administration & RBAC Extensions

We will implement major updates to SpendSmart:
1. **Add Expense Page**: Convert the "Add Expense" modal popup into a dedicated sidebar page view.
2. **Administration Menu**: A new menu panel accessible to administrators to manage:
   - **Users**: Create, Edit roles, and Delete users.
   - **Roles**: Create and Delete roles.
   - **Role Privileges**: Control access granularly (View, Add, Edit, Delete permissions per role).
   - **Expense Categories**: Create, Edit, Delete, and specify sorting orders.

## User Review Required

> [!IMPORTANT]
> - **Seeding Default Admin**: During database initialization (handled in `database.py`), we seed a default role `Admin` (with all privileges) and create a default user `admin` with password `admin123`.
> - **Role-Based API Security**: The backend APIs are protected by python decorators checking the user's role privileges in the database.
> - **Dynamic Categories**: The expense category selectors in all forms (Add, Edit, Filters) will be loaded dynamically from the SQLite database instead of being hardcoded in HTML.

## Open Questions

None at this time. The requirements are clear, and the backend logic in `database.py` and `app.py` is already mostly present. We need to implement the frontend SPA elements and styling, and write automated tests for verification.

## Proposed Changes

### Backend Routing and DB Verification

#### [MODIFY] [database.py](file:///C:/Users/sudharsanp/.gemini/antigravity/scratch/monthly_expenses/database.py)
- Confirm existing schemas and helper queries work correctly. No functional changes needed unless debugging reveals issues.

#### [MODIFY] [app.py](file:///C:/Users/sudharsanp/.gemini/antigravity/scratch/monthly_expenses/app.py)
- Verify `require_privilege` decorators and admin routes work as expected.

---

### Styling changes

#### [MODIFY] [styles.css](file:///C:/Users/sudharsanp/.gemini/antigravity/scratch/monthly_expenses/static/css/styles.css)
- Add CSS layout styles for the standalone Add Expense section.
- Add CSS layout styles for the Administration Panel including sub-tabs (`Users`, `Roles & Privileges`, `Categories`).
- Add styling for grid matrices, checkbox inputs, display order inputs, badges, and tables inside the admin panel.

---

### Frontend UI Changes

#### [MODIFY] [index.html](file:///C:/Users/sudharsanp/.gemini/antigravity/scratch/monthly_expenses/templates/index.html)
- Remove the Add Expense Modal (leaving the Edit Expense Modal intact).
- Add `#section-add-expense` section in the main content container.
- Add "Add Expense" navigation item in the sidebar nav list (as a tab instead of a modal trigger button).
- Add "Admin" navigation item in the sidebar nav list.
- Add `#section-admin` section with sub-tabs for Users, Roles & Privileges, Categories.

#### [MODIFY] [app.js](file:///C:/Users/sudharsanp/.gemini/antigravity/scratch/monthly_expenses/static/js/app.js)
- Fetch current user's privileges `/api/user/privileges` on app startup.
- Hide or disable UI elements dynamically based on user privileges (e.g. hide Admin sidebar tab if not admin, hide Add Expense sidebar tab if not `can_add`, hide edit/delete action buttons if not `can_edit`/`can_delete`).
- Replace static category drop-downs with dynamic options fetched from `/api/categories` for Add, Edit, and Filter selectors.
- Implement switching logic for the new `#section-add-expense` and `#section-admin` views.
- Add admin sub-tab switching and event listeners.
- Implement fetch requests to:
  - List and create users, change roles, delete users.
  - List and create roles, update privileges.
  - List, create, edit, delete, and save categories sorting order.

---

### Verification Plan

#### Automated Tests

#### [MODIFY] [verify_app.py](file:///C:/Users/sudharsanp/.gemini/antigravity/scratch/monthly_expenses/verify_app.py)
- Update to test new DB schemas & default seed records.
- Test role-based API protection (verify 403 Forbidden is returned if the privilege is disabled).
- Test dynamic categories creation, listing, editing, deletion, and sorting retrieval order.

#### Manual Verification
1. Run server: `python app.py`.
2. Log in as default admin `admin` (password `admin123`).
3. Verify the Admin sidebar tab is visible.
4. Navigate to Admin -> Categories, add a new category and change display order, verify order changes in all selectors.
5. Create a new user with the `Viewer` role. Log in as that user:
   - Verify the Add Expense sidebar item is hidden/disabled.
   - Verify that Edit and Delete action icons are hidden in the table.
   - Verify accessing `/api/expenses/add` directly returns 403 Forbidden.

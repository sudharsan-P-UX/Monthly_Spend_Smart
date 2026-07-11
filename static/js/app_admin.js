// ADMIN TABS INITIALIZATION
function initAdminTabs() {
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            adminTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetTab = tab.getAttribute('data-tab');
            document.querySelectorAll('.admin-sub-section').forEach(sec => {
                sec.classList.add('hidden');
            });
            const subSec = document.getElementById(`tab-${targetTab}`);
            if (subSec) {
                subSec.classList.remove('hidden');
            }
            if (targetTab === 'admin-emis') {
                adminFetchEmiColumns();
            }
            if (targetTab === 'admin-expense-columns') {
                adminFetchExpenseColumnsTab();
            }
            if (targetTab === 'admin-expense-control') {
                const selectVal = document.getElementById('expense-control-select').value;
                document.querySelectorAll('.control-sub-section').forEach(sec => {
                    sec.classList.add('hidden');
                });
                const targetSec = document.getElementById(`sub-expense-control-${selectVal}`);
                if (targetSec) {
                    targetSec.classList.remove('hidden');
                }
            }
        });
    });
}

function switchAdminTab(tabName) {
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    document.querySelectorAll('.admin-sub-section').forEach(sec => {
        sec.classList.add('hidden');
    });

    const subSec = document.getElementById(`tab-${tabName}`);
    if (subSec) {
        subSec.classList.remove('hidden');
    }
    if (tabName === 'admin-emis') {
        adminFetchEmiColumns();
    }
    if (tabName === 'admin-expense-columns') {
        adminFetchExpenseColumnsTab();
    }
    if (tabName === 'admin-expense-control') {
        const selectVal = document.getElementById('expense-control-select').value;
        document.querySelectorAll('.control-sub-section').forEach(sec => {
            sec.classList.add('hidden');
        });
        const targetSec = document.getElementById(`sub-expense-control-${selectVal}`);
        if (targetSec) {
            targetSec.classList.remove('hidden');
        }
    }
    if (tabName === 'admin-labels') {
        adminFetchLabels();
    }
}

async function loadAdminPanel() {
    try {
        await adminFetchRoles();
    } catch (e) {
        console.error("Failed to load roles:", e);
    }
    await Promise.all([
        adminFetchUsers(),
        adminFetchEmiColumns(),
        adminFetchCategories(),
        adminFetchBankModes(),
        adminFetchPaymentTypes(),
        adminFetchPaymentCategories(),
        adminFetchExcelColumns(),
        adminFetchSettings(),
        adminFetchLabels()
    ]);
}

// ADMIN USERS
async function adminFetchUsers() {
    try {
        const response = await fetch('/api/admin/users');
        if (response.ok) {
            const users = await response.json();
            renderAdminUsersTable(users);
        }
    } catch (err) {
        console.error('Error fetching admin users:', err);
    }
}

function renderAdminUsersTable(users) {
    const tbody = document.getElementById('admin-users-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        
        let roleOptions = '';
        systemRoles.forEach(r => {
            const selected = r.id === user.role_id ? 'selected' : '';
            roleOptions += `<option value="${r.id}" ${selected}>${escapeHTML(r.name)}</option>`;
        });

        let badgeClass = 'badge-user';
        if (user.role_id === 1) badgeClass = 'badge-admin';
        else if (user.role_id === 3) badgeClass = 'badge-viewer';

        tr.innerHTML = `
            <td><span style="font-weight: 500;">${escapeHTML(user.username)}</span></td>
            <td><span class="role-badge ${badgeClass}">${escapeHTML(user.role_name || 'User')}</span></td>
            <td>
                <select class="table-input" style="max-width: 140px; background-color: #ffffff; color: #000000; border: 1px solid var(--border-color); padding: 6px; border-radius: 4px;">
                    ${roleOptions}
                </select>
            </td>
            <td class="text-center" style="display: flex; justify-content: center; gap: 8px;">
                <button class="btn-icon btn-icon-update" onclick="adminChangeUserRole(${user.id}, this.closest('tr').querySelector('select').value)" title="Update User Role" style="color: var(--color-primary); margin: 0;">
                    <i class="fa-solid fa-floppy-disk"></i>
                </button>
                <button class="btn-icon btn-icon-edit" onclick="openEditUserModal(${user.id}, '${escapeHTML(user.username)}', '${escapeHTML(user.first_name || '')}', '${escapeHTML(user.last_name || '')}', '${escapeHTML(user.email || '')}', '${escapeHTML(user.phone || '')}')" title="Edit User" style="color: var(--color-warning); margin: 0;">
                    <i class="fa-solid fa-key"></i>
                </button>
                <button class="btn-icon btn-icon-delete" onclick="adminDeleteUser(${user.id}, '${escapeHTML(user.username)}')" title="Delete User" style="margin: 0;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function adminChangeUserRole(userId, roleId) {
    try {
        const response = await fetch('/api/admin/users/edit_role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, role_id: roleId })
        });
        const result = await response.json();
        if (response.ok) {
            showAppAlert('User role updated successfully!', true);
            await adminFetchUsers();
            await fetchUserPrivileges();
        } else {
            showAppAlert(result.error || 'Failed to update user role.');
            await adminFetchUsers();
        }
    } catch (err) {
        showAppAlert('Network error updating user role.');
    }
}

async function adminDeleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"? This will delete all their expense records.`)) return;

    try {
        const response = await fetch(`/api/admin/users/delete/${userId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('User deleted successfully.', true);
            await adminFetchUsers();
        } else {
            showAppAlert(result.error || 'Failed to delete user.');
        }
    } catch (err) {
        showAppAlert('Network error deleting user.');
    }
}

async function handleAdminCreateUser(e) {
    e.preventDefault();
    const username = document.getElementById('admin-new-username').value;
    const password = document.getElementById('admin-new-password').value;
    const role_id = document.getElementById('admin-new-role').value;
    const first_name = document.getElementById('admin-new-firstname') ? document.getElementById('admin-new-firstname').value : '';
    const last_name = document.getElementById('admin-new-lastname') ? document.getElementById('admin-new-lastname').value : '';
    const email = document.getElementById('admin-new-email') ? document.getElementById('admin-new-email').value : '';
    const phone = document.getElementById('admin-new-phone') ? document.getElementById('admin-new-phone').value : '';

    try {
        const response = await fetch('/api/admin/users/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role_id, first_name, last_name, email, phone })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('User created successfully!', true);
            document.getElementById('admin-create-user-form').reset();
            await adminFetchUsers();
        } else {
            showAppAlert(result.error || 'Failed to create user.');
        }
    } catch (err) {
        showAppAlert('Network error creating user.');
    }
}

function openEditUserModal(userId, username, firstname, lastname, email, phone) {
    const modal = document.getElementById('change-user-password-modal');
    if (!modal) return;
    document.getElementById('change-user-id').value = userId;
    document.getElementById('change-user-username').textContent = username;
    document.getElementById('change-user-firstname').value = firstname;
    document.getElementById('change-user-lastname').value = lastname;
    document.getElementById('change-user-email').value = email;
    document.getElementById('change-user-phone').value = phone;
    document.getElementById('change-user-new-password').value = '';
    document.getElementById('change-user-confirm-password').value = '';
    modal.classList.remove('hidden');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('change-user-password-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function handleAdminChangeUserPassword(e) {
    e.preventDefault();
    const userId = document.getElementById('change-user-id').value;
    const newPassword = document.getElementById('change-user-new-password').value;
    const confirmPassword = document.getElementById('change-user-confirm-password').value;
    const firstName = document.getElementById('change-user-firstname').value;
    const lastName = document.getElementById('change-user-lastname').value;
    const email = document.getElementById('change-user-email').value;
    const phone = document.getElementById('change-user-phone').value;

    if (newPassword && newPassword !== confirmPassword) {
        showAppAlert('Passwords do not match.');
        return;
    }

    if (!confirm('Are you sure you want to save changes for this user?')) {
        return;
    }

    closeChangePasswordModal();

    try {
        const response = await fetch('/api/admin/users/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                new_password: newPassword,
                confirm_password: confirmPassword,
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone
            })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            alert('User details updated successfully!');
            showAppAlert('User details updated successfully!', true);
            await adminFetchUsers();
        } else {
            showAppAlert(result.error || 'Failed to update user.');
            openEditUserModal(userId, document.getElementById('change-user-username').textContent, firstName, lastName, email, phone);
        }
    } catch (err) {
        showAppAlert('Network error updating user.');
        openEditUserModal(userId, document.getElementById('change-user-username').textContent, firstName, lastName, email, phone);
    }
}

// ADMIN // ADMIN ROLES
async function adminFetchRoles() {
    try {
        const response = await fetch('/api/admin/roles');
        if (response.ok) {
            systemRoles = await response.json();
            renderRolesDropdowns();
        }
    } catch (err) {
        console.error('Error fetching admin roles:', err);
    }
}

function renderRolesDropdowns() {
    const roleSelect = document.getElementById('admin-new-role');
    if (roleSelect) {
        roleSelect.innerHTML = '<option value="" disabled selected>Select Role</option>';
        systemRoles.forEach(role => {
            roleSelect.innerHTML += `<option value="${role.id}">${escapeHTML(role.name)}</option>`;
        });
    }

    const adminRoleSelect = document.getElementById('admin-role-select');
    if (adminRoleSelect) {
        const previousVal = adminRoleSelect.value;
        adminRoleSelect.innerHTML = '';
        systemRoles.forEach(role => {
            adminRoleSelect.innerHTML += `<option value="${role.id}">${escapeHTML(role.name)}</option>`;
        });
        if (previousVal && [...adminRoleSelect.options].some(o => o.value === previousVal)) {
            adminRoleSelect.value = previousVal;
        } else {
            adminRoleSelect.value = "1";
        }
        adminOnRoleSelected();
    }
}

let currentSelectedRolePrivileges = [];

async function adminOnRoleSelected() {
    const roleSelect = document.getElementById('admin-role-select');
    if (!roleSelect) return;
    const roleId = parseInt(roleSelect.value);
    
    const actionsContainer = document.getElementById('admin-role-actions-container');
    const renameInput = document.getElementById('admin-rename-role-input');
    if (actionsContainer) {
        if (roleId > 3) {
            actionsContainer.classList.remove('hidden');
            const selectedRole = systemRoles.find(r => r.id === roleId);
            if (renameInput && selectedRole) {
                renameInput.value = selectedRole.name;
            }
        } else {
            actionsContainer.classList.add('hidden');
        }
    }
    
    await adminFetchRolePrivileges(roleId);
}

async function adminFetchRolePrivileges(roleId) {
    try {
        const response = await fetch(`/api/admin/roles/privileges?role_id=${roleId}`);
        if (response.ok) {
            currentSelectedRolePrivileges = await response.json();
            renderRolePrivilegesTable(roleId);
        }
    } catch (err) {
        console.error('Error fetching role privileges:', err);
    }
}

function renderRolePrivilegesTable(roleId) {
    const tbody = document.getElementById('admin-role-privileges-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const isReadOnly = roleId === 1;
    const disabledAttr = isReadOnly ? 'disabled' : '';

    currentSelectedRolePrivileges.forEach((p, idx) => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><span style="font-weight: 500;">${escapeHTML(p.privilege_name)}</span></td>
            <td class="text-center">${p.display_order}</td>
            <td class="text-center">
                <label class="checkbox-container">
                    <input type="checkbox" ${p.can_add ? 'checked' : ''} ${disabledAttr} onchange="updateLocalRolePrivilege(${idx}, 'can_add', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">
                <label class="checkbox-container">
                    <input type="checkbox" ${p.can_edit ? 'checked' : ''} ${disabledAttr} onchange="updateLocalRolePrivilege(${idx}, 'can_edit', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">
                <label class="checkbox-container">
                    <input type="checkbox" ${p.can_delete ? 'checked' : ''} ${disabledAttr} onchange="updateLocalRolePrivilege(${idx}, 'can_delete', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">
                <label class="checkbox-container">
                    <input type="checkbox" ${p.can_view ? 'checked' : ''} ${disabledAttr} onchange="updateLocalRolePrivilege(${idx}, 'can_view', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">
                <label class="checkbox-container">
                    <input type="checkbox" ${p.is_mandatory ? 'checked' : ''} ${disabledAttr} onchange="updateLocalRolePrivilege(${idx}, 'is_mandatory', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">
                <label class="checkbox-container">
                    <input type="checkbox" ${p.is_active ? 'checked' : ''} ${disabledAttr} onchange="updateLocalRolePrivilege(${idx}, 'is_active', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateLocalRolePrivilege(index, field, value) {
    if (currentSelectedRolePrivileges[index]) {
        currentSelectedRolePrivileges[index][field] = value ? 1 : 0;
    }
}

async function adminSaveRolePrivileges() {
    const roleSelect = document.getElementById('admin-role-select');
    if (!roleSelect) return;
    const roleId = parseInt(roleSelect.value);
    
    if (roleId === 1) {
        showAppAlert('Administrator role privileges cannot be modified.');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/roles/privileges/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role_id: roleId,
                privileges: currentSelectedRolePrivileges
            })
        });
        
        if (response.ok) {
            showAppAlert('Role privileges saved successfully!', 'success');
            await fetchUserPrivileges();
        } else {
            const data = await response.json();
            showAppAlert(data.error || 'Failed to save role privileges.');
        }
    } catch (err) {
        console.error('Error saving role privileges:', err);
        showAppAlert('Error saving role privileges.');
    }
}

async function adminRenameSelectedRole() {
    const roleSelect = document.getElementById('admin-role-select');
    const renameInput = document.getElementById('admin-rename-role-input');
    if (!roleSelect || !renameInput) return;
    const roleId = parseInt(roleSelect.value);
    const newName = renameInput.value.trim();
    if (!newName) {
        showAppAlert('Role name cannot be empty.');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/roles/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role_id: roleId, name: newName })
        });
        if (response.ok) {
            showAppAlert('Role renamed successfully!', 'success');
            await adminFetchRoles();
        } else {
            const data = await response.json();
            showAppAlert(data.error || 'Failed to rename role.');
        }
    } catch (err) {
        console.error('Error renaming role:', err);
    }
}

async function adminDeleteSelectedRole() {
    const roleSelect = document.getElementById('admin-role-select');
    if (!roleSelect) return;
    const roleId = parseInt(roleSelect.value);
    const selectedRole = systemRoles.find(r => r.id === roleId);
    if (!selectedRole) return;
    
    if (!confirm(`Are you sure you want to delete the role "${selectedRole.name}"?`)) return;
    
    try {
        const response = await fetch(`/api/admin/roles/delete/${roleId}`, { method: 'POST' });
        if (response.ok) {
            showAppAlert('Role deleted successfully!', 'success');
            roleSelect.value = "1";
            await adminFetchRoles();
        } else {
            const data = await response.json();
            showAppAlert(data.error || 'Failed to delete role.');
        }
    } catch (err) {
        console.error('Error deleting role:', err);
    }
}

async function handleAdminCreateRole(e) {
    e.preventDefault();
    const name = document.getElementById('admin-new-role-name').value;

    try {
        const response = await fetch('/api/admin/roles/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Role created successfully!', true);
            document.getElementById('admin-create-role-form').reset();
            await adminFetchRoles();
            await adminFetchUsers();
        } else {
            showAppAlert(result.error || 'Failed to create role.');
        }
    } catch (err) {
        showAppAlert('Network error creating role.');
    }
}

// ADMIN SECURITY SETTINGS
async function adminFetchSettings() {
    try {
        const response = await fetch(`/api/admin/settings?t=${new Date().getTime()}`);
        if (response.ok) {
            const settings = await response.json();
            const emailCheckbox = document.getElementById('setting-register-email-otp');
            const phoneCheckbox = document.getElementById('setting-register-phone-otp');
            const loginCheckbox = document.getElementById('setting-login-otp');
            const inlineAddCheckbox = document.getElementById('setting-inline-add');
            
            if (emailCheckbox) emailCheckbox.checked = settings.register_email_otp_enabled;
            if (phoneCheckbox) phoneCheckbox.checked = settings.register_phone_otp_enabled;
            if (loginCheckbox) loginCheckbox.checked = settings.login_otp_enabled;
            if (inlineAddCheckbox) inlineAddCheckbox.checked = settings.inline_add_enabled;
        }
    } catch (err) {
        console.error('Error fetching security settings:', err);
    }
}

async function adminUpdateSettings() {
    const emailCheckbox = document.getElementById('setting-register-email-otp');
    const phoneCheckbox = document.getElementById('setting-register-phone-otp');
    const loginCheckbox = document.getElementById('setting-login-otp');
    const inlineAddCheckbox = document.getElementById('setting-inline-add');
    if (!emailCheckbox || !phoneCheckbox || !loginCheckbox || !inlineAddCheckbox) return;

    try {
        const response = await fetch('/api/admin/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                register_email_otp_enabled: emailCheckbox.checked,
                register_phone_otp_enabled: phoneCheckbox.checked,
                login_otp_enabled: loginCheckbox.checked,
                inline_add_enabled: inlineAddCheckbox.checked
            })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Security settings updated successfully!', true);
            // Refresh privilege UI immediately if settings changed
            if (typeof applyUserPrivileges === 'function') {
                applyUserPrivileges();
            }
        } else {
            showAppAlert(result.error || 'Failed to update security settings.');
            await adminFetchSettings();
        }
    } catch (err) {
        showAppAlert('Network error updating security settings.');
        await adminFetchSettings();
    }
}

// ADMIN CATEGORIES
async function adminFetchCategories() {
    try {
        const response = await fetch('/api/categories');
        if (response.ok) {
            adminCategoriesLocal = await response.json();
            renderAdminCategoriesTable();
        }
    } catch (err) {
        console.error('Error fetching admin categories:', err);
    }
}

function renderAdminCategoriesTable() {
    const tbody = document.getElementById('admin-categories-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const canAdd = checkFinePrivilege('Create Category', 'add');
    const canEdit = checkFinePrivilege('Expense Categories', 'edit');
    const canDelete = checkFinePrivilege('Expense Categories', 'delete');
    const canView = checkFinePrivilege('Expense Categories', 'view');

    const listCard = document.getElementById('admin-categories-list')?.closest('.content-card');
    if (listCard) {
        if (canView) listCard.classList.remove('hidden');
        else listCard.classList.add('hidden');
    }

    const createCard = document.getElementById('admin-create-category-form')?.closest('.content-card');
    const gridContainer = document.querySelector('#sub-expense-control-categories .admin-grid');
    if (createCard) {
        if (canAdd) {
            createCard.classList.remove('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '2fr 1fr';
        } else {
            createCard.classList.add('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr';
        }
    }

    const saveBtn = document.getElementById('btn-save-categories-order');
    if (saveBtn) {
        if (canEdit) saveBtn.classList.remove('hidden');
        else saveBtn.classList.add('hidden');
    }

    adminCategoriesLocal.forEach((cat, index) => {
        const tr = document.createElement('tr');
        const nameInputHtml = canEdit
            ? `<input type="text" class="table-input" value="${escapeHTML(cat.name)}" onchange="updateLocalCategoryName(${index}, this.value)">`
            : `<span>${escapeHTML(cat.name)}</span>`;
        const orderInputHtml = canEdit
            ? `<input type="number" class="table-input table-input-order" value="${cat.display_order}" onchange="updateLocalCategoryOrder(${index}, this.value)">`
            : `<span>${cat.display_order}</span>`;
        const deleteHtml = canDelete
            ? `<button class="btn-icon btn-icon-delete" onclick="adminDeleteCategory(${cat.id}, '${escapeHTML(cat.name)}')" title="Delete Category" style="margin: 0;"><i class="fa-solid fa-trash-can"></i></button>`
            : '';
        const updateHtml = canEdit
            ? `<button class="btn-icon btn-icon-update" onclick="adminUpdateSingleCategory(this, ${cat.id}, ${index})" title="Update Category" style="color: var(--color-primary); margin: 0;"><i class="fa-solid fa-floppy-disk"></i></button>`
            : '';
        const finalActionHtml = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">${updateHtml}${deleteHtml}</div>`;

        tr.innerHTML = `
            <td>${nameInputHtml}</td>
            <td class="text-center">${orderInputHtml}</td>
            <td class="text-center">${finalActionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateLocalCategoryName(index, name) {
    if (adminCategoriesLocal[index]) {
        adminCategoriesLocal[index].name = name.trim();
    }
}

function updateLocalCategoryOrder(index, order) {
    if (adminCategoriesLocal[index]) {
        const parsed = parseInt(order, 10);
        adminCategoriesLocal[index].display_order = isNaN(parsed) ? 0 : parsed;
    }
}

async function saveAllCategories() {
    let successCount = 0;
    let failCount = 0;
    
    for (const cat of adminCategoriesLocal) {
        try {
            const response = await fetch(`/api/admin/categories/edit/${cat.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: cat.name, display_order: cat.display_order })
            });
            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
        }
    }

    if (failCount === 0) {
        showAppAlert('All categories updated successfully!', true);
    } else {
        showAppAlert(`Categories updated: ${successCount} succeeded, ${failCount} failed.`);
    }

    await fetchCategories();
    await adminFetchCategories();
}

async function adminDeleteCategory(catId, name) {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
        const response = await fetch(`/api/admin/categories/delete/${catId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Category deleted successfully.', true);
            await fetchCategories();
            await adminFetchCategories();
        } else {
            showAppAlert(result.error || 'Failed to delete category.');
        }
    } catch (err) {
        showAppAlert('Network error deleting category.');
    }
}

async function handleAdminCreateCategory(e) {
    e.preventDefault();
    const name = document.getElementById('admin-new-cat-name').value;
    const display_order = document.getElementById('admin-new-cat-order').value;

    try {
        const response = await fetch('/api/admin/categories/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, display_order })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Category created successfully!', true);
            document.getElementById('admin-create-category-form').reset();
            await fetchCategories();
            await adminFetchCategories();
        } else {
            showAppAlert(result.error || 'Failed to create category.');
        }
    } catch (err) {
        showAppAlert('Network error creating category.');
    }
}

// ADMIN BANK MODES
async function adminFetchBankModes() {
    try {
        const response = await fetch('/api/bank_modes');
        if (response.ok) {
            adminBankModesLocal = await response.json();
            renderAdminBankModesTable();
        }
    } catch (err) {
        console.error('Error fetching admin bank modes:', err);
    }
}

function renderAdminBankModesTable() {
    const tbody = document.getElementById('admin-bank-modes-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const canAdd = checkFinePrivilege('Create Category', 'add');
    const canEdit = checkFinePrivilege('Expense Categories', 'edit');
    const canDelete = checkFinePrivilege('Expense Categories', 'delete');
    const canView = checkFinePrivilege('Expense Categories', 'view');

    const listCard = document.getElementById('admin-bank-modes-list')?.closest('.content-card');
    if (listCard) {
        if (canView) listCard.classList.remove('hidden');
        else listCard.classList.add('hidden');
    }

    const createCard = document.getElementById('admin-create-bank-mode-form')?.closest('.content-card');
    const gridContainer = document.querySelector('#sub-expense-control-bank-modes .admin-grid');
    if (createCard) {
        if (canAdd) {
            createCard.classList.remove('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '2fr 1fr';
        } else {
            createCard.classList.add('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr';
        }
    }

    const saveBtn = document.getElementById('btn-save-bank-modes');
    if (saveBtn) {
        if (canEdit) saveBtn.classList.remove('hidden');
        else saveBtn.classList.add('hidden');
    }

    adminBankModesLocal.forEach((bm, index) => {
        const tr = document.createElement('tr');
        const nameInputHtml = canEdit
            ? `<input type="text" class="table-input" value="${escapeHTML(bm.name)}" onchange="updateLocalBankModeName(${index}, this.value)">`
            : `<span>${escapeHTML(bm.name)}</span>`;
        const orderInputHtml = canEdit
            ? `<input type="number" class="table-input table-input-order" value="${bm.display_order}" onchange="updateLocalBankModeOrder(${index}, this.value)">`
            : `<span>${bm.display_order}</span>`;
        const deleteHtml = canDelete
            ? `<button class="btn-icon btn-icon-delete" onclick="adminDeleteBankMode(${bm.id}, '${escapeHTML(bm.name)}')" title="Delete Bank Mode" style="margin: 0;"><i class="fa-solid fa-trash-can"></i></button>`
            : '';
        const updateHtml = canEdit
            ? `<button class="btn-icon btn-icon-update" onclick="adminUpdateSingleBankMode(this, ${bm.id}, ${index})" title="Update Bank Mode" style="color: var(--color-primary); margin: 0;"><i class="fa-solid fa-floppy-disk"></i></button>`
            : '';
        const finalActionHtml = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">${updateHtml}${deleteHtml}</div>`;

        tr.innerHTML = `
            <td>${nameInputHtml}</td>
            <td class="text-center">${orderInputHtml}</td>
            <td class="text-center">${finalActionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateLocalBankModeName(index, name) {
    if (adminBankModesLocal[index]) {
        adminBankModesLocal[index].name = name.trim();
    }
}

function updateLocalBankModeOrder(index, order) {
    if (adminBankModesLocal[index]) {
        const parsed = parseInt(order, 10);
        adminBankModesLocal[index].display_order = isNaN(parsed) ? 0 : parsed;
    }
}

async function saveAllBankModes() {
    let successCount = 0;
    let failCount = 0;
    
    for (const bm of adminBankModesLocal) {
        try {
            const response = await fetch(`/api/admin/bank_modes/edit/${bm.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: bm.name, display_order: bm.display_order })
            });
            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
        }
    }

    if (failCount === 0) {
        showAppAlert('All bank modes updated successfully!', true);
    } else {
        showAppAlert(`Bank modes updated: ${successCount} succeeded, ${failCount} failed.`);
    }

    await fetchBankModes();
    await adminFetchBankModes();
}

async function adminDeleteBankMode(bmId, name) {
    if (!confirm(`Are you sure you want to delete bank mode "${name}"?`)) return;

    try {
        const response = await fetch(`/api/admin/bank_modes/delete/${bmId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Bank mode deleted successfully.', true);
            await fetchBankModes();
            await adminFetchBankModes();
        } else {
            showAppAlert(result.error || 'Failed to delete bank mode.');
        }
    } catch (err) {
        showAppAlert('Network error deleting bank mode.');
    }
}

async function handleAdminCreateBankMode(e) {
    e.preventDefault();
    const name = document.getElementById('admin-new-bm-name').value;
    const display_order = document.getElementById('admin-new-bm-order').value;

    try {
        const response = await fetch('/api/admin/bank_modes/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, display_order })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Bank mode created successfully!', true);
            document.getElementById('admin-create-bank-mode-form').reset();
            await fetchBankModes();
            await adminFetchBankModes();
        } else {
            showAppAlert(result.error || 'Failed to create bank mode.');
        }
    } catch (err) {
        showAppAlert('Network error creating bank mode.');
    }
}

// ADMIN PAYMENT TYPES
async function adminFetchPaymentTypes() {
    try {
        const response = await fetch('/api/payment_types');
        if (response.ok) {
            adminPaymentTypesLocal = await response.json();
            renderAdminPaymentTypesTable();
        }
    } catch (err) {
        console.error('Error fetching admin payment types:', err);
    }
}

function renderAdminPaymentTypesTable() {
    const tbody = document.getElementById('admin-payment-types-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const canAdd = checkFinePrivilege('Create Category', 'add');
    const canEdit = checkFinePrivilege('Expense Categories', 'edit');
    const canDelete = checkFinePrivilege('Expense Categories', 'delete');
    const canView = checkFinePrivilege('Expense Categories', 'view');

    const listCard = document.getElementById('admin-payment-types-list')?.closest('.content-card');
    if (listCard) {
        if (canView) listCard.classList.remove('hidden');
        else listCard.classList.add('hidden');
    }

    const createCard = document.getElementById('admin-create-payment-type-form')?.closest('.content-card');
    const gridContainer = document.querySelector('#sub-expense-control-payment-types .admin-grid');
    if (createCard) {
        if (canAdd) {
            createCard.classList.remove('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '2fr 1fr';
        } else {
            createCard.classList.add('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr';
        }
    }

    const saveBtn = document.getElementById('btn-save-payment-types');
    if (saveBtn) {
        if (canEdit) saveBtn.classList.remove('hidden');
        else saveBtn.classList.add('hidden');
    }

    adminPaymentTypesLocal.forEach((pt, index) => {
        const tr = document.createElement('tr');
        const nameInputHtml = canEdit
            ? `<input type="text" class="table-input" value="${escapeHTML(pt.name)}" onchange="updateLocalPaymentTypeName(${index}, this.value)">`
            : `<span>${escapeHTML(pt.name)}</span>`;
        const orderInputHtml = canEdit
            ? `<input type="number" class="table-input table-input-order" value="${pt.display_order}" onchange="updateLocalPaymentTypeOrder(${index}, this.value)">`
            : `<span>${pt.display_order}</span>`;
        const deleteHtml = canDelete
            ? `<button class="btn-icon btn-icon-delete" onclick="adminDeletePaymentType(${pt.id}, '${escapeHTML(pt.name)}')" title="Delete Payment Type" style="margin: 0;"><i class="fa-solid fa-trash-can"></i></button>`
            : '';
        const updateHtml = canEdit
            ? `<button class="btn-icon btn-icon-update" onclick="adminUpdateSinglePaymentType(this, ${pt.id}, ${index})" title="Update Payment Type" style="color: var(--color-primary); margin: 0;"><i class="fa-solid fa-floppy-disk"></i></button>`
            : '';
        const finalActionHtml = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">${updateHtml}${deleteHtml}</div>`;

        tr.innerHTML = `
            <td>${nameInputHtml}</td>
            <td class="text-center">${orderInputHtml}</td>
            <td class="text-center">${finalActionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateLocalPaymentTypeName(index, name) {
    if (adminPaymentTypesLocal[index]) {
        adminPaymentTypesLocal[index].name = name.trim();
    }
}

function updateLocalPaymentTypeOrder(index, order) {
    if (adminPaymentTypesLocal[index]) {
        const parsed = parseInt(order, 10);
        adminPaymentTypesLocal[index].display_order = isNaN(parsed) ? 0 : parsed;
    }
}

async function saveAllPaymentTypes() {
    let successCount = 0;
    let failCount = 0;
    
    for (const pt of adminPaymentTypesLocal) {
        try {
            const response = await fetch(`/api/admin/payment_types/edit/${pt.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: pt.name, display_order: pt.display_order })
            });
            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
        }
    }

    if (failCount === 0) {
        showAppAlert('All payment types updated successfully!', true);
    } else {
        showAppAlert(`Payment types updated: ${successCount} succeeded, ${failCount} failed.`);
    }

    await fetchPaymentTypes();
    await adminFetchPaymentTypes();
}

async function adminDeletePaymentType(ptId, name) {
    if (!confirm(`Are you sure you want to delete payment type "${name}"?`)) return;

    try {
        const response = await fetch(`/api/admin/payment_types/delete/${ptId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Payment type deleted successfully.', true);
            await fetchPaymentTypes();
            await adminFetchPaymentTypes();
        } else {
            showAppAlert(result.error || 'Failed to delete payment type.');
        }
    } catch (err) {
        showAppAlert('Network error deleting payment type.');
    }
}

async function handleAdminCreatePaymentType(e) {
    e.preventDefault();
    const name = document.getElementById('admin-new-pt-name').value;
    const display_order = document.getElementById('admin-new-pt-order').value;

    try {
        const response = await fetch('/api/admin/payment_types/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, display_order })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Payment type created successfully!', true);
            document.getElementById('admin-create-payment-type-form').reset();
            await fetchPaymentTypes();
            await adminFetchPaymentTypes();
        } else {
            showAppAlert(result.error || 'Failed to create payment type.');
        }
    } catch (err) {
        showAppAlert('Network error creating payment type.');
    }
}

// ADMIN PAYMENT CATEGORIES
async function adminFetchPaymentCategories() {
    try {
        const response = await fetch('/api/payment_categories');
        if (response.ok) {
            adminPaymentCategoriesLocal = await response.json();
            renderAdminPaymentCategoriesTable();
        }
    } catch (err) {
        console.error('Error fetching admin payment categories:', err);
    }
}

function renderAdminPaymentCategoriesTable() {
    const tbody = document.getElementById('admin-payment-categories-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const canAdd = checkFinePrivilege('Create Category', 'add');
    const canEdit = checkFinePrivilege('Expense Categories', 'edit');
    const canDelete = checkFinePrivilege('Expense Categories', 'delete');
    const canView = checkFinePrivilege('Expense Categories', 'view');

    const listCard = document.getElementById('admin-payment-categories-list')?.closest('.content-card');
    if (listCard) {
        if (canView) listCard.classList.remove('hidden');
        else listCard.classList.add('hidden');
    }

    const createCard = document.getElementById('admin-create-payment-category-form')?.closest('.content-card');
    const gridContainer = document.querySelector('#sub-expense-control-payment-categories .admin-grid');
    if (createCard) {
        if (canAdd) {
            createCard.classList.remove('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '2fr 1fr';
        } else {
            createCard.classList.add('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr';
        }
    }

    const saveBtn = document.getElementById('btn-save-payment-categories');
    if (saveBtn) {
        if (canEdit) saveBtn.classList.remove('hidden');
        else saveBtn.classList.add('hidden');
    }

    adminPaymentCategoriesLocal.forEach((pc, index) => {
        const tr = document.createElement('tr');
        const nameInputHtml = canEdit
            ? `<input type="text" class="table-input" value="${escapeHTML(pc.name)}" onchange="updateLocalPaymentCategoryName(${index}, this.value)">`
            : `<span>${escapeHTML(pc.name)}</span>`;
        const orderInputHtml = canEdit
            ? `<input type="number" class="table-input table-input-order" value="${pc.display_order}" onchange="updateLocalPaymentCategoryOrder(${index}, this.value)">`
            : `<span>${pc.display_order}</span>`;
        const deleteHtml = canDelete
            ? `<button class="btn-icon btn-icon-delete" onclick="adminDeletePaymentCategory(${pc.id}, '${escapeHTML(pc.name)}')" title="Delete Payment Category" style="margin: 0;"><i class="fa-solid fa-trash-can"></i></button>`
            : '';
        const updateHtml = canEdit
            ? `<button class="btn-icon btn-icon-update" onclick="adminUpdateSinglePaymentCategory(this, ${pc.id}, ${index})" title="Update Payment Source" style="color: var(--color-primary); margin: 0;"><i class="fa-solid fa-floppy-disk"></i></button>`
            : '';
        const finalActionHtml = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">${updateHtml}${deleteHtml}</div>`;

        tr.innerHTML = `
            <td>${nameInputHtml}</td>
            <td class="text-center">${orderInputHtml}</td>
            <td class="text-center">${finalActionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateLocalPaymentCategoryName(index, name) {
    if (adminPaymentCategoriesLocal[index]) {
        adminPaymentCategoriesLocal[index].name = name.trim();
    }
}

function updateLocalPaymentCategoryOrder(index, order) {
    if (adminPaymentCategoriesLocal[index]) {
        const parsed = parseInt(order, 10);
        adminPaymentCategoriesLocal[index].display_order = isNaN(parsed) ? 0 : parsed;
    }
}

async function saveAllPaymentCategories() {
    let successCount = 0;
    let failCount = 0;
    
    for (const pc of adminPaymentCategoriesLocal) {
        try {
            const response = await fetch(`/api/admin/payment_categories/edit/${pc.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: pc.name, display_order: pc.display_order })
            });
            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            failCount++;
        }
    }

    if (failCount === 0) {
        showAppAlert('All payment categories updated successfully!', true);
    } else {
        showAppAlert(`Payment categories updated: ${successCount} succeeded, ${failCount} failed.`);
    }

    await fetchPaymentCategories();
    await adminFetchPaymentCategories();
}

async function adminDeletePaymentCategory(pcId, name) {
    if (!confirm(`Are you sure you want to delete payment source "${name}"?`)) return;

    try {
        const response = await fetch(`/api/admin/payment_categories/delete/${pcId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Payment source deleted successfully.', true);
            await fetchPaymentCategories();
            await adminFetchPaymentCategories();
        } else {
            showAppAlert(result.error || 'Failed to delete payment source.');
        }
    } catch (err) {
        showAppAlert('Network error deleting payment source.');
    }
}

async function handleAdminCreatePaymentCategory(e) {
    e.preventDefault();
    const name = document.getElementById('admin-new-pc-name').value;
    const display_order = document.getElementById('admin-new-pc-order').value;

    try {
        const response = await fetch('/api/admin/payment_categories/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, display_order })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Payment category created successfully!', true);
            document.getElementById('admin-create-payment-category-form').reset();
            await fetchPaymentCategories();
            await adminFetchPaymentCategories();
        } else {
            showAppAlert(result.error || 'Failed to create payment category.');
        }
    } catch (err) {
        showAppAlert('Network error creating payment category.');
    }
}

// ADMIN EXCEL COLUMNS
async function adminFetchExcelColumns() {
    const targetSelect = document.getElementById('admin-excel-columns-target');
    const targetType = targetSelect ? targetSelect.value : 'expense';
    try {
        const response = await fetch(`/api/admin/excel-columns?target_type=${targetType}`);
        if (response.ok) {
            const cols = await response.json();
            renderAdminExcelColumnsTable(cols);
        }
    } catch (err) {
        console.error('Error fetching admin excel columns:', err);
    }
}

function renderAdminExcelColumnsTable(columns) {
    const tbody = document.getElementById('admin-excel-columns-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterSelect = document.getElementById('admin-excel-columns-filter');
    const filterType = filterSelect ? filterSelect.value : 'import';
    const targetSelect = document.getElementById('admin-excel-columns-target');
    const targetType = targetSelect ? targetSelect.value : 'expense';
    const canAdd = checkFinePrivilege('Add Custom Column', 'add');
    const canEdit = checkFinePrivilege('Excel Import & Export Columns', 'edit');
    const canDelete = checkFinePrivilege('Excel Import & Export Columns', 'delete');
    const canView = checkFinePrivilege('Excel Import & Export Columns', 'view');
    const isDisabled = canEdit ? '' : 'disabled';

    const listCard = document.getElementById('admin-excel-columns-list')?.closest('.content-card');
    if (listCard) {
        if (canView) listCard.classList.remove('hidden');
        else listCard.classList.add('hidden');
    }

    const systemKeys = {
        expense: ['amount', 'category', 'date', 'description', 'bank_mode', 'payment_type', 'payment_category', 'interest', 'payment_method', 'status'],
        emi: ['name', 'principal_amount', 'interest_rate', 'tenure_months', 'emi_amount', 'start_date', 'end_date', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank']
    };

    // Hide or show the form card and adjust grid layout
    const colFormCard = document.getElementById('admin-create-column-form')?.closest('.content-card');
    const gridContainer = document.querySelector('#tab-admin-excel-columns .admin-grid');
    if (colFormCard) {
        if (canAdd) {
            colFormCard.classList.remove('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '2fr 1fr';
        } else {
            colFormCard.classList.add('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr';
        }
    }

    // Hide or show Save Changes button
    const saveBtn = document.getElementById('btn-save-excel-columns');
    if (saveBtn) {
        if (canEdit) {
            saveBtn.parentElement.classList.remove('hidden');
        } else {
            saveBtn.parentElement.classList.add('hidden');
        }
    }

    // Populate Parent dropdown choices
    populateParentDropdowns(targetType, columns);

    columns.forEach(col => {
        const tr = document.createElement('tr');
        
        const isReq = col.is_required === 1;
        const requiredHtml = isReq 
            ? `<span class="badge badge-admin"><i class="fa-solid fa-check"></i> Yes</span>` 
            : `<span class="badge badge-viewer">No</span>`;
            
        const isChecked = (filterType === 'import' ? col.is_enabled_import : col.is_enabled_export) === 1 ? 'checked' : '';
        const isDeletable = !systemKeys[targetType].includes(col.column_key);
        const deleteHtml = isDeletable && canDelete
            ? `<button type="button" class="btn-icon btn-icon-delete" onclick="adminDeleteExcelColumn('${col.column_key}', '${targetType}')" title="Delete Column" style="color: var(--color-danger); margin: 0;"><i class="fa-solid fa-trash-can"></i></button>`
            : '';
        const updateHtml = canEdit
            ? `<button type="button" class="btn-icon btn-icon-update" onclick="adminUpdateSingleColumn(this, '${col.column_key}', '${targetType}')" title="Update Column" style="color: var(--color-primary); margin: 0;">
                 <i class="fa-solid fa-floppy-disk"></i>
               </button>`
            : '';
        const finalActionHtml = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">${updateHtml}${deleteHtml}</div>`;

        // Order input field
        const orderInputHtml = canEdit
            ? `<input type="number" class="table-input text-center" style="width: 70px; margin: 0 auto; display: block; padding: 4px;" value="${col.display_order || 0}" min="0">`
            : `<span class="text-center" style="display: block;">${col.display_order || 0}</span>`;
        
        const labelHtml = canEdit
            ? `<input type="text" class="table-input column-label-input" value="${escapeHTML(col.column_label)}" style="width: 140px; font-weight: 500; display: inline-block; padding: 4px 8px;">`
            : `<span style="font-weight: 500;">${escapeHTML(col.column_label)}</span>`;

        tr.innerHTML = `
            <td>${labelHtml}</td>
            <td><code>${escapeHTML(col.column_key)}</code></td>
            <td class="text-center">${requiredHtml}</td>
            <td class="text-center">${orderInputHtml}</td>
            <td class="text-center">
                <label class="checkbox-container" style="display: inline-block;">
                    <input type="checkbox" ${isChecked} ${isDisabled}>
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">${finalActionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveExcelColumnsChanges() {
    const tbody = document.getElementById('admin-excel-columns-list');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    const filterSelect = document.getElementById('admin-excel-columns-filter');
    const filterType = filterSelect ? filterSelect.value : 'import';
    const targetSelect = document.getElementById('admin-excel-columns-target');
    const targetType = targetSelect ? targetSelect.value : 'expense';
    
    const columnsData = [];
    rows.forEach(tr => {
        const orderInput = tr.querySelector('input[type="number"]');
        const checkbox = tr.querySelector('input[type="checkbox"]');
        const codeTag = tr.querySelector('code');
        if (codeTag) {
            const columnKey = codeTag.textContent.trim();
            const displayOrder = orderInput ? parseInt(orderInput.value) || 0 : 0;
            const isEnabled = checkbox ? (checkbox.checked ? 1 : 0) : 1;
            columnsData.push({
                column_key: columnKey,
                target_type: targetType,
                display_order: displayOrder,
                is_enabled: isEnabled
            });
        }
    });
    
    try {
        const response = await fetch('/api/admin/excel-columns/save-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columns: columnsData, type_key: filterType })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Excel column configurations saved successfully!', true);
            await adminFetchExcelColumns();
            await loadDynamicCustomFields();
        } else {
            showAppAlert(result.error || 'Failed to save changes.');
        }
    } catch (err) {
        showAppAlert('Network error saving changes.');
    }
}

async function adminDeleteExcelColumn(columnKey, targetType) {
    if (!confirm(`Are you sure you want to delete the custom column "${columnKey}"? This will not drop the database column, but it will remove it from configuration and templates.`)) {
        return;
    }
    try {
        const response = await fetch('/api/admin/excel-columns/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ column_key: columnKey, target_type: targetType })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Column deleted successfully!', true);
            await adminFetchExcelColumns();
            await loadDynamicCustomFields();
        } else {
            showAppAlert(result.error || 'Failed to delete column.');
        }
    } catch (err) {
        showAppAlert('Network error deleting column.');
    }
}

// ADMIN EMI COLUMNS MANAGEMENT
async function adminFetchEmiColumns() {
    try {
        const response = await fetch('/api/admin/excel-columns?target_type=emi');
        if (response.ok) {
            const cols = await response.json();
            renderAdminEmiColumnsTable(cols);
        }
    } catch (err) {
        console.error('Error fetching admin EMI columns:', err);
    }
}

function renderAdminEmiColumnsTable(columns) {
    const tbody = document.getElementById('admin-emi-columns-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterSelect = document.getElementById('admin-emi-columns-filter');
    const filterType = filterSelect ? filterSelect.value : 'import';
    const canAdd = checkFinePrivilege('Add Custom Column for EMIs', 'add');
    const canEdit = checkFinePrivilege('EMI Columns List', 'edit');
    const canDelete = checkFinePrivilege('EMI Columns List', 'delete');
    const canView = checkFinePrivilege('EMI Columns List', 'view');
    const isDisabled = canEdit ? '' : 'disabled';

    const listCard = document.getElementById('admin-emi-columns-list')?.closest('.content-card');
    if (listCard) {
        if (canView) listCard.classList.remove('hidden');
        else listCard.classList.add('hidden');
    }

    const systemKeys = ['name', 'tenure_months', 'emi_amount', 'start_date', 'end_date', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank'];

    // Hide or show the form card and adjust grid layout
    const colFormCard = document.getElementById('admin-create-emi-column-form')?.closest('.content-card');
    const gridContainer = document.querySelector('#tab-admin-emis .admin-grid');
    if (colFormCard) {
        if (canAdd) {
            colFormCard.classList.remove('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '2fr 1fr';
        } else {
            colFormCard.classList.add('hidden');
            if (gridContainer) gridContainer.style.gridTemplateColumns = '1fr';
        }
    }

    // Hide or show Save Changes button
    const btnSave = document.getElementById('btn-save-emi-columns');
    if (btnSave) {
        if (canEdit) {
            btnSave.parentElement.classList.remove('hidden');
        } else {
            btnSave.parentElement.classList.add('hidden');
        }
    }

    // Populate Parent dropdown choices for EMIs
    populateParentDropdowns('emi', columns);

    columns.forEach(col => {
        const tr = document.createElement('tr');

        const isReq = col.is_required === 1;
        const requiredHtml = isReq
            ? `<span class="badge badge-admin"><i class="fa-solid fa-check"></i> Yes</span>`
            : `<span class="badge badge-viewer">No</span>`;

        const isChecked = (filterType === 'import' ? col.is_enabled_import : col.is_enabled_export) === 1 ? 'checked' : '';
        const isDeletable = !systemKeys.includes(col.column_key);
        const deleteHtml = isDeletable && canDelete
            ? `<button type="button" class="btn-icon btn-icon-delete" onclick="adminDeleteEmiColumn('${col.column_key}')" title="Delete Custom Column" style="color: var(--color-danger); margin: 0;">
                 <i class="fa-solid fa-trash-can"></i>
               </button>`
            : '';
        const updateHtml = canEdit
            ? `<button type="button" class="btn-icon btn-icon-update" onclick="adminUpdateSingleColumn(this, '${col.column_key}', 'emi')" title="Update Column" style="color: var(--color-primary); margin: 0;">
                 <i class="fa-solid fa-floppy-disk"></i>
               </button>`
            : '';
        const finalActionHtml = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">${updateHtml}${deleteHtml}</div>`;

        // Order input field
        const orderInputHtml = canEdit
            ? `<input type="number" class="table-input text-center" style="width: 70px; margin: 0 auto; display: block; padding: 4px;" value="${col.display_order || 0}" min="0">`
            : `<span class="text-center" style="display: block;">${col.display_order || 0}</span>`;

        const labelHtml = canEdit
            ? `<input type="text" class="table-input column-label-input" value="${escapeHTML(col.column_label)}" style="width: 140px; font-weight: 500; display: inline-block; padding: 4px 8px;">`
            : `<span style="font-weight: 500;">${escapeHTML(col.column_label)}</span>`;

        tr.innerHTML = `
            <td>${labelHtml}</td>
            <td><code>${escapeHTML(col.column_key)}</code></td>
            <td class="text-center">${requiredHtml}</td>
            <td class="text-center">${orderInputHtml}</td>
            <td class="text-center">
                <label class="checkbox-container" style="display: inline-block;">
                    <input type="checkbox" ${isChecked} ${isDisabled}>
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">${finalActionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveEmiColumnsChanges() {
    const tbody = document.getElementById('admin-emi-columns-list');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    const filterSelect = document.getElementById('admin-emi-columns-filter');
    const filterType = filterSelect ? filterSelect.value : 'import';
    
    const columnsData = [];
    rows.forEach(tr => {
        const orderInput = tr.querySelector('input[type="number"]');
        const checkbox = tr.querySelector('input[type="checkbox"]');
        const codeTag = tr.querySelector('code');
        if (codeTag) {
            const columnKey = codeTag.textContent.trim();
            const displayOrder = orderInput ? parseInt(orderInput.value) || 0 : 0;
            const isEnabled = checkbox ? (checkbox.checked ? 1 : 0) : 1;
            columnsData.push({
                column_key: columnKey,
                target_type: 'emi',
                display_order: displayOrder,
                is_enabled: isEnabled
            });
        }
    });
    
    try {
        const response = await fetch('/api/admin/excel-columns/save-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columns: columnsData, type_key: filterType })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('EMI column configurations saved successfully!', true);
            await adminFetchEmiColumns();
            await loadDynamicCustomFields();
        } else {
            showAppAlert(result.error || 'Failed to save changes.');
        }
    } catch (err) {
        showAppAlert('Network error saving changes.');
    }
}

async function adminDeleteEmiColumn(columnKey) {
    if (!confirm(`Are you sure you want to delete the custom column "${columnKey}"? This will not drop the database column, but it will remove it from configuration and templates.`)) return;
    try {
        const response = await fetch('/api/admin/excel-columns/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ column_key: columnKey, target_type: 'emi' })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('EMI custom column deleted successfully.', true);
            await adminFetchEmiColumns();
            await loadDynamicCustomFields();
        } else {
            showAppAlert(result.error || 'Failed to delete custom column.');
        }
    } catch (err) {
        showAppAlert('Network error deleting custom column.');
    }
}

// POPULATE PARENT COLUMN CHOICES IN DYNAMIC FIELDS FORMS
function populateParentDropdowns(targetType, columns) {
    const standardKeys = {
        expense: [
            { key: 'amount', label: 'Amount' },
            { key: 'category', label: 'Category' },
            { key: 'date', label: 'Date' },
            { key: 'description', label: 'Description' },
            { key: 'bank_mode', label: 'Bank Mode' },
            { key: 'payment_type', label: 'Payment Gateway' },
            { key: 'payment_category', label: 'Payment Source' },
            { key: 'interest', label: 'Interest' },
            { key: 'payment_method', label: 'Payment Method' },
            { key: 'status', label: 'Status' }
        ],
        emi: [
            { key: 'name', label: 'EMI Name' },
            { key: 'principal_amount', label: 'Principal Amount' },
            { key: 'interest_rate', label: 'Interest Rate' },
            { key: 'tenure_months', label: 'Tenure (Months)' },
            { key: 'emi_amount', label: 'Monthly EMI Amount' },
            { key: 'start_date', label: 'Start Date' },
            { key: 'end_date', label: 'End Date' },
            { key: 'due_date', label: 'Due Date' },
            { key: 'payment_type', label: 'Payment Type' },
            { key: 'payment_gateway', label: 'Payment Gateway' },
            { key: 'payment_bank', label: 'Payment Bank' }
        ]
    };
    
    const selectIds = targetType === 'expense'
        ? ['admin-new-col-parent', 'admin-new-expense-col-parent']
        : ['admin-new-emi-col-parent'];

    selectIds.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        let options = '<option value="">None (Always Show)</option>';
        standardKeys[targetType].forEach(col => {
            options += `<option value="${col.key}">${escapeHTML(col.label)} (${col.key})</option>`;
        });
        const standardStrKeys = standardKeys[targetType].map(k => k.key);
        columns.forEach(col => {
            if (!standardStrKeys.includes(col.column_key)) {
                options += `<option value="${col.column_key}">${escapeHTML(col.column_label)} (${col.column_key})</option>`;
            }
        });
        select.innerHTML = options;
    });
}

// DYNAMIC CONDITIONAL VISIBILITY MANAGER
function applyConditionalFields(formType) {
    const stdKeys = {
        expense: ['amount', 'category', 'date', 'description', 'bank_mode', 'payment_type', 'payment_category', 'interest', 'payment_method', 'status'],
        emi: ['name', 'principal_amount', 'interest_rate', 'tenure_months', 'emi_amount', 'start_date', 'end_date', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank']
    };
    
    let selector, prefix, targetType;
    if (formType === 'add-expense') {
        selector = '.custom-expense-field';
        prefix = 'add';
        targetType = 'expense';
    } else if (formType === 'edit-expense') {
        selector = '.custom-expense-field';
        prefix = 'edit';
        targetType = 'expense';
    } else if (formType === 'user-emi') {
        selector = '.custom-emi-field';
        prefix = 'emi';
        targetType = 'emi';
    } else if (formType === 'admin-emi') {
        selector = '.custom-emi-field';
        prefix = 'admin-emi';
        targetType = 'emi';
    } else {
        return;
    }
    
    const inputs = document.querySelectorAll(selector);
    inputs.forEach(input => {
        const parentKey = input.getAttribute('data-parent-key');
        const triggerVal = input.getAttribute('data-parent-val');
        if (parentKey && triggerVal) {
            const isStd = stdKeys[targetType].includes(parentKey);
            const parentId = isStd ? `${prefix}-${parentKey.replace(/_/g, '-')}` : `${prefix}-custom-${parentKey}`;
            const parentInput = document.getElementById(parentId);
            
            if (parentInput) {
                const groupDiv = input.closest('.input-group') || input.parentElement;
                
                function checkTrigger() {
                    let val = parentInput.value;
                    if (parentInput.type === 'checkbox') {
                        val = parentInput.checked ? 'Yes' : 'No';
                    }
                    if (String(val).trim().toLowerCase() === String(triggerVal).trim().toLowerCase()) {
                        groupDiv.style.display = 'block';
                        input.required = input.getAttribute('data-required') === '1';
                    } else {
                        groupDiv.style.display = 'none';
                        input.required = false;
                    }
                }
                
                parentInput.addEventListener('change', checkTrigger);
                parentInput.addEventListener('input', checkTrigger);
                checkTrigger();
            } else {
                const groupDiv = input.closest('.input-group') || input.parentElement;
                groupDiv.style.display = 'none';
                input.required = false;
            }
        }
    });
}

let adminLabelsLocal = [];

async function adminFetchLabels() {
    try {
        const response = await fetch('/api/admin/labels');
        if (response.ok) {
            adminLabelsLocal = await response.json();
            renderAdminLabelsList();
        }
    } catch (err) {
        console.error('Error fetching admin labels:', err);
    }
}

function renderAdminLabelsList() {
    const container = document.getElementById('admin-labels-container');
    if (!container) return;
    container.innerHTML = '';
    
    const grouped = {};
    adminLabelsLocal.forEach(lbl => {
        if (!grouped[lbl.label_category]) {
            grouped[lbl.label_category] = [];
        }
        grouped[lbl.label_category].push(lbl);
    });
    
    Object.keys(grouped).forEach(cat => {
        const groupDiv = document.createElement('div');
        groupDiv.style.background = 'var(--bg-secondary)';
        groupDiv.style.padding = '15px';
        groupDiv.style.borderRadius = '8px';
        groupDiv.style.border = '1px solid var(--border-color)';
        groupDiv.style.marginBottom = '15px';
        
        let titleHtml = `<h3 style="margin-bottom: 15px; color: var(--accent-color); font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${escapeHTML(cat)}</h3>`;
        let fieldsHtml = '';
        
        grouped[cat].forEach(lbl => {
            const cleanName = lbl.label_key.split('_').slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            
            fieldsHtml += `
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; align-items: center; margin-bottom: 12px;">
                    <span style="font-weight: 500; color: var(--text-muted); font-size: 0.95rem;">${escapeHTML(cleanName)}</span>
                    <input type="text" class="form-control label-input" data-key="${escapeHTML(lbl.label_key)}" value="${escapeHTML(lbl.custom_value !== null ? lbl.custom_value : lbl.default_value)}" style="background: white; color: black; border-radius: 4px; border: 1px solid var(--border-color); padding: 8px 12px; font-size: 0.95rem; width: 100%;">
                </div>
            `;
        });
        
        groupDiv.innerHTML = titleHtml + fieldsHtml;
        container.appendChild(groupDiv);
    });
}

async function adminSaveLabels() {
    const container = document.getElementById('admin-labels-container');
    if (!container) return;
    
    const inputs = container.querySelectorAll('input.label-input');
    const labelsData = {};
    inputs.forEach(input => {
        const key = input.getAttribute('data-key');
        const val = input.value;
        labelsData[key] = val;
    });
    
    try {
        const response = await fetch('/api/admin/labels/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labels: labelsData })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Labels updated successfully!', 'success');
            await fetchPublicLabels();
            await adminFetchExcelColumns();
            await adminFetchEmiColumns();
        } else {
            showAppAlert(result.error || 'Failed to save labels.');
        }
    } catch (err) {
        showAppAlert('Network error saving labels.');
    }
}

async function adminUpdateSingleColumn(btn, columnKey, targetType) {
    const tr = btn.closest('tr');
    if (!tr) return;
    
    // Find inputs in this row
    const labelInput = tr.querySelector('.column-label-input');
    const orderInput = tr.querySelector('input[type="number"]');
    const statusCheckbox = tr.querySelector('input[type="checkbox"]');
    
    const labelVal = labelInput ? labelInput.value.trim() : null;
    const orderVal = orderInput ? parseInt(orderInput.value) || 0 : 0;
    const isChecked = statusCheckbox ? (statusCheckbox.checked ? 1 : 0) : null;
    
    // Determine filterType (import vs export) from the tab's switcher dropdown
    let filterType = 'import';
    if (targetType === 'emi') {
        const filterSelect = document.getElementById('admin-emi-columns-filter');
        filterType = filterSelect ? filterSelect.value : 'import';
    } else if (targetType === 'expense') {
        // Wait, depending on which tab: Expense Columns or Excel Columns.
        // Excel Columns tab has two targets (expense/emi) and two filters (import/export).
        // Let's check which tab we are inside.
        const excelTab = tr.closest('#tab-admin-excel-columns');
        if (excelTab) {
            const filterSelect = document.getElementById('admin-excel-columns-filter');
            filterType = filterSelect ? filterSelect.value : 'import';
        } else {
            const filterSelect = document.getElementById('admin-expense-columns-filter');
            filterType = filterSelect ? filterSelect.value : 'import';
        }
    }
    
    const payload = {
        column_key: columnKey,
        target_type: targetType, // 'expense' or 'emi'
        display_order: orderVal
    };
    if (labelVal !== null) {
        payload.column_label = labelVal;
    }
    if (isChecked !== null) {
        if (filterType === 'import') {
            payload.is_enabled_import = isChecked;
        } else {
            payload.is_enabled_export = isChecked;
        }
    }
    
    try {
        const response = await fetch('/api/admin/excel-columns/update-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Column updated successfully!', true);
            // Refresh list
            if (targetType === 'emi') {
                await adminFetchEmiColumns();
            } else if (targetType === 'expense') {
                const excelTab = tr.closest('#tab-admin-excel-columns');
                if (excelTab) {
                    await adminFetchExcelColumns();
                } else {
                    if (typeof adminFetchExpenseColumnsTab === 'function') {
                        await adminFetchExpenseColumnsTab();
                    } else if (typeof fetchExpenseColumns === 'function') {
                        await fetchExpenseColumns();
                    }
                }
            }
        } else {
            showAppAlert(result.error || 'Failed to update column.');
        }
    } catch (err) {
        showAppAlert('Network error updating column.');
    }
}

async function adminUpdateSingleCategory(btn, catId, index) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const nameInput = tr.querySelector('input[type="text"]');
    const orderInput = tr.querySelector('input[type="number"]');
    if (!nameInput || !orderInput) return;
    const name = nameInput.value.trim();
    const order = parseInt(orderInput.value) || 0;
    
    if (!name) {
        showAppAlert('Category name is required.');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/categories/edit/${catId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, display_order: order })
        });
        const result = await response.json();
        if (response.ok) {
            showAppAlert('Category updated successfully!', true);
            if (adminCategoriesLocal[index]) {
                adminCategoriesLocal[index].name = name;
                adminCategoriesLocal[index].display_order = order;
            }
            await fetchCategories();
            await adminFetchCategories();
        } else {
            showAppAlert(result.error || 'Failed to update category.');
        }
    } catch (err) {
        showAppAlert('Network error updating category.');
    }
}

async function adminUpdateSingleBankMode(btn, bmId, index) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const nameInput = tr.querySelector('input[type="text"]');
    const orderInput = tr.querySelector('input[type="number"]');
    if (!nameInput || !orderInput) return;
    const name = nameInput.value.trim();
    const order = parseInt(orderInput.value) || 0;
    
    if (!name) {
        showAppAlert('Bank mode name is required.');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/bank_modes/edit/${bmId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, display_order: order })
        });
        const result = await response.json();
        if (response.ok) {
            showAppAlert('Bank mode updated successfully!', true);
            if (adminBankModesLocal[index]) {
                adminBankModesLocal[index].name = name;
                adminBankModesLocal[index].display_order = order;
            }
            await fetchBankModes();
            await adminFetchBankModes();
        } else {
            showAppAlert(result.error || 'Failed to update bank mode.');
        }
    } catch (err) {
        showAppAlert('Network error updating bank mode.');
    }
}

async function adminUpdateSinglePaymentType(btn, ptId, index) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const nameInput = tr.querySelector('input[type="text"]');
    const orderInput = tr.querySelector('input[type="number"]');
    if (!nameInput || !orderInput) return;
    const name = nameInput.value.trim();
    const order = parseInt(orderInput.value) || 0;
    
    if (!name) {
        showAppAlert('Payment Gateway name is required.');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/payment_types/edit/${ptId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, display_order: order })
        });
        const result = await response.json();
        if (response.ok) {
            showAppAlert('Payment Gateway updated successfully!', true);
            if (adminPaymentTypesLocal[index]) {
                adminPaymentTypesLocal[index].name = name;
                adminPaymentTypesLocal[index].display_order = order;
            }
            await fetchPaymentTypes();
            await adminFetchPaymentTypes();
        } else {
            showAppAlert(result.error || 'Failed to update payment type.');
        }
    } catch (err) {
        showAppAlert('Network error updating payment type.');
    }
}

async function adminUpdateSinglePaymentCategory(btn, pcId, index) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const nameInput = tr.querySelector('input[type="text"]');
    const orderInput = tr.querySelector('input[type="number"]');
    if (!nameInput || !orderInput) return;
    const name = nameInput.value.trim();
    const order = parseInt(orderInput.value) || 0;
    
    if (!name) {
        showAppAlert('Payment Source name is required.');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/payment_categories/edit/${pcId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, display_order: order })
        });
        const result = await response.json();
        if (response.ok) {
            showAppAlert('Payment Source updated successfully!', true);
            if (adminPaymentCategoriesLocal[index]) {
                adminPaymentCategoriesLocal[index].name = name;
                adminPaymentCategoriesLocal[index].display_order = order;
            }
            await fetchPaymentCategories();
            await adminFetchPaymentCategories();
        } else {
            showAppAlert(result.error || 'Failed to update payment source.');
        }
    } catch (err) {
        showAppAlert('Network error updating payment source.');
    }
}

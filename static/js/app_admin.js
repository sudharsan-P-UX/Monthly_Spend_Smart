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
        adminFetchSettings()
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
                <select class="table-input" style="max-width: 140px;" onchange="adminChangeUserRole(${user.id}, this.value)">
                    ${roleOptions}
                </select>
            </td>
            <td class="text-center">
                <button class="btn-icon btn-icon-edit" onclick="openChangePasswordModal(${user.id}, '${escapeHTML(user.username)}')" title="Change Password" style="margin-right: 5px; color: var(--color-warning);">
                    <i class="fa-solid fa-key"></i>
                </button>
                <button class="btn-icon btn-icon-delete" onclick="adminDeleteUser(${user.id}, '${escapeHTML(user.username)}')" title="Delete User">
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

    try {
        const response = await fetch('/api/admin/users/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role_id })
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

function openChangePasswordModal(userId, username) {
    const modal = document.getElementById('change-user-password-modal');
    if (!modal) return;
    document.getElementById('change-user-id').value = userId;
    document.getElementById('change-user-username').textContent = username;
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

    if (newPassword !== confirmPassword) {
        showAppAlert('Passwords do not match.');
        return;
    }

    try {
        const response = await fetch('/api/admin/users/change_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                new_password: newPassword,
                confirm_password: confirmPassword
            })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('User password changed successfully!', true);
            closeChangePasswordModal();
        } else {
            showAppAlert(result.error || 'Failed to change password.');
        }
    } catch (err) {
        showAppAlert('Network error changing password.');
    }
}

// ADMIN ROLES
async function adminFetchRoles() {
    try {
        const response = await fetch('/api/admin/roles');
        if (response.ok) {
            systemRoles = await response.json();
            renderRolesDropdowns();
            renderPrivilegesMatrix();
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
}

function renderPrivilegesMatrix() {
    const tbody = document.getElementById('admin-privileges-matrix-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    systemRoles.forEach(role => {
        const tr = document.createElement('tr');
        const isDisabled = role.id === 1 ? 'disabled' : '';

        let nameFieldHtml = '';
        if (role.id === 1) {
            nameFieldHtml = `<span style="font-weight: 500;">${escapeHTML(role.name)}</span>`;
        } else {
            nameFieldHtml = `<input type="text" class="table-input" value="${escapeHTML(role.name)}" onchange="adminRenameRole(${role.id}, this.value)">`;
        }

        let actionBtnHtml = '';
        if (role.id === 1) {
            actionBtnHtml = `<span class="text-muted">-</span>`;
        } else {
            actionBtnHtml = `
                <button class="btn-icon btn-icon-delete" onclick="adminDeleteRole(${role.id}, '${escapeHTML(role.name)}')" title="Delete Role">
                    <i class="fa-solid fa-trash-can"></i>
                </button>`;
        }

        tr.innerHTML = `
            <td>${nameFieldHtml}</td>
            <td>
                <label class="checkbox-container">
                    <input type="checkbox" ${role.can_view ? 'checked' : ''} ${isDisabled} onchange="adminUpdatePrivilege(${role.id}, 'can_view', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td>
                <label class="checkbox-container">
                    <input type="checkbox" ${role.can_add ? 'checked' : ''} ${isDisabled} onchange="adminUpdatePrivilege(${role.id}, 'can_add', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td>
                <label class="checkbox-container">
                    <input type="checkbox" ${role.can_edit ? 'checked' : ''} ${isDisabled} onchange="adminUpdatePrivilege(${role.id}, 'can_edit', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td>
                <label class="checkbox-container">
                    <input type="checkbox" ${role.can_delete ? 'checked' : ''} ${isDisabled} onchange="adminUpdatePrivilege(${role.id}, 'can_delete', this.checked)">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">${actionBtnHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function adminRenameRole(roleId, newName) {
    newName = newName.trim();
    if (!newName) {
        showAppAlert('Role name cannot be empty.');
        await adminFetchRoles();
        return;
    }

    try {
        const response = await fetch('/api/admin/roles/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role_id: roleId, name: newName })
        });
        const result = await response.json();
        if (response.ok) {
            showAppAlert('Role name updated successfully!', true);
            await adminFetchRoles();
            await adminFetchUsers();
        } else {
            showAppAlert(result.error || 'Failed to update role name.');
            await adminFetchRoles();
        }
    } catch (err) {
        showAppAlert('Network error updating role name.');
        await adminFetchRoles();
    }
}

async function adminDeleteRole(roleId, name) {
    if (!confirm(`Are you sure you want to delete role "${name}"? Users assigned to this role will default to the standard "User" role.`)) return;

    try {
        const response = await fetch(`/api/admin/roles/delete/${roleId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Role deleted successfully.', true);
            await adminFetchRoles();
            await adminFetchUsers();
        } else {
            showAppAlert(result.error || 'Failed to delete role.');
        }
    } catch (err) {
        showAppAlert('Network error deleting role.');
    }
}

async function adminUpdatePrivilege(roleId, privilegeField, isChecked) {
    const roleObj = systemRoles.find(r => r.id === roleId);
    if (!roleObj) return;

    const updatePayload = {
        role_id: roleId,
        can_view: roleObj.can_view,
        can_add: roleObj.can_add,
        can_edit: roleObj.can_edit,
        can_delete: roleObj.can_delete
    };
    updatePayload[privilegeField] = isChecked ? 1 : 0;

    try {
        const response = await fetch('/api/admin/privileges/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Privileges updated successfully!', true);
            roleObj[privilegeField] = isChecked ? 1 : 0;
            await fetchUserPrivileges();
        } else {
            showAppAlert(result.error || 'Failed to update privileges.');
            renderPrivilegesMatrix();
        }
    } catch (err) {
        showAppAlert('Network error updating privileges.');
        renderPrivilegesMatrix();
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
        const response = await fetch('/api/admin/settings');
        if (response.ok) {
            const settings = await response.json();
            const regCheckbox = document.getElementById('setting-register-otp');
            const loginCheckbox = document.getElementById('setting-login-otp');
            
            if (regCheckbox) regCheckbox.checked = settings.registration_otp_enabled;
            if (loginCheckbox) loginCheckbox.checked = settings.login_otp_enabled;
        }
    } catch (err) {
        console.error('Error fetching security settings:', err);
    }
}

async function adminUpdateSettings() {
    const regCheckbox = document.getElementById('setting-register-otp');
    const loginCheckbox = document.getElementById('setting-login-otp');
    if (!regCheckbox || !loginCheckbox) return;

    try {
        const response = await fetch('/api/admin/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                registration_otp_enabled: regCheckbox.checked,
                login_otp_enabled: loginCheckbox.checked
            })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Security settings updated successfully!', true);
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

    adminCategoriesLocal.forEach((cat, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" class="table-input" value="${escapeHTML(cat.name)}" onchange="updateLocalCategoryName(${index}, this.value)">
            </td>
            <td class="text-center">
                <input type="number" class="table-input table-input-order" value="${cat.display_order}" onchange="updateLocalCategoryOrder(${index}, this.value)">
            </td>
            <td class="text-center">
                <button class="btn-icon btn-icon-delete" onclick="adminDeleteCategory(${cat.id}, '${escapeHTML(cat.name)}')" title="Delete Category">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
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

    adminBankModesLocal.forEach((bm, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" class="table-input" value="${escapeHTML(bm.name)}" onchange="updateLocalBankModeName(${index}, this.value)">
            </td>
            <td class="text-center">
                <input type="number" class="table-input table-input-order" value="${bm.display_order}" onchange="updateLocalBankModeOrder(${index}, this.value)">
            </td>
            <td class="text-center">
                <button class="btn-icon btn-icon-delete" onclick="adminDeleteBankMode(${bm.id}, '${escapeHTML(bm.name)}')" title="Delete Bank Mode">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
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

    adminPaymentTypesLocal.forEach((pt, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" class="table-input" value="${escapeHTML(pt.name)}" onchange="updateLocalPaymentTypeName(${index}, this.value)">
            </td>
            <td class="text-center">
                <input type="number" class="table-input table-input-order" value="${pt.display_order}" onchange="updateLocalPaymentTypeOrder(${index}, this.value)">
            </td>
            <td class="text-center">
                <button class="btn-icon btn-icon-delete" onclick="adminDeletePaymentType(${pt.id}, '${escapeHTML(pt.name)}')" title="Delete Payment Type">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
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

    adminPaymentCategoriesLocal.forEach((pc, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" class="table-input" value="${escapeHTML(pc.name)}" onchange="updateLocalPaymentCategoryName(${index}, this.value)">
            </td>
            <td class="text-center">
                <input type="number" class="table-input table-input-order" value="${pc.display_order}" onchange="updateLocalPaymentCategoryOrder(${index}, this.value)">
            </td>
            <td class="text-center">
                <button class="btn-icon btn-icon-delete" onclick="adminDeletePaymentCategory(${pc.id}, '${escapeHTML(pc.name)}')" title="Delete Payment Category">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
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
    const isAdmin = currentUserPrivileges && currentUserPrivileges.is_admin;
    const isDisabled = isAdmin ? '' : 'disabled';

    const systemKeys = {
        expense: ['amount', 'category', 'date', 'description', 'bank_mode', 'payment_type', 'payment_category', 'interest', 'payment_method', 'status'],
        emi: ['name', 'principal_amount', 'interest_rate', 'tenure_months', 'emi_amount', 'start_date', 'end_date', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank']
    };

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
        const actionHtml = isDeletable && isAdmin
            ? `<button type="button" class="btn-icon btn-icon-delete" onclick="adminDeleteExcelColumn('${col.column_key}', '${targetType}')" title="Delete Column"><i class="fa-solid fa-trash"></i></button>`
            : '';

        // Order input field
        const orderInputHtml = isAdmin
            ? `<input type="number" class="table-input text-center" style="width: 70px; margin: 0 auto; display: block; padding: 4px;" value="${col.display_order || 0}" min="0">`
            : `<span class="text-center" style="display: block;">${col.display_order || 0}</span>`;
        
        tr.innerHTML = `
            <td><span style="font-weight: 500;">${escapeHTML(col.column_label)}</span></td>
            <td><code>${escapeHTML(col.column_key)}</code></td>
            <td class="text-center">${requiredHtml}</td>
            <td class="text-center">${orderInputHtml}</td>
            <td class="text-center">
                <label class="checkbox-container" style="display: inline-block;">
                    <input type="checkbox" ${isChecked} ${isDisabled}>
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">${actionHtml}</td>
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
    const isAdmin = currentUserPrivileges && currentUserPrivileges.is_admin;
    const isDisabled = isAdmin ? '' : 'disabled';

    const systemKeys = ['name', 'tenure_months', 'emi_amount', 'start_date', 'end_date', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank'];

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
        const actionHtml = isDeletable && isAdmin
            ? `<button type="button" class="btn-icon btn-icon-delete" onclick="adminDeleteEmiColumn('${col.column_key}')" title="Delete Custom Column" style="color: var(--color-danger);">
                 <i class="fa-solid fa-trash-can"></i>
               </button>`
            : '';

        // Order input field
        const orderInputHtml = isAdmin
            ? `<input type="number" class="table-input text-center" style="width: 70px; margin: 0 auto; display: block; padding: 4px;" value="${col.display_order || 0}" min="0">`
            : `<span class="text-center" style="display: block;">${col.display_order || 0}</span>`;

        tr.innerHTML = `
            <td><span style="font-weight: 500;">${escapeHTML(col.column_label)}</span></td>
            <td><code>${escapeHTML(col.column_key)}</code></td>
            <td class="text-center">${requiredHtml}</td>
            <td class="text-center">${orderInputHtml}</td>
            <td class="text-center">
                <label class="checkbox-container" style="display: inline-block;">
                    <input type="checkbox" ${isChecked} ${isDisabled}>
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="text-center">${actionHtml}</td>
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

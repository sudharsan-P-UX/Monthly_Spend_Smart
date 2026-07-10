// SWITCH VIEWS IN SPA
function switchView(target) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => {
        if (n.getAttribute('data-target') === target) {
            n.classList.add('active');
        } else {
            n.classList.remove('active');
        }
    });

    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    
    const targetSec = document.getElementById(`section-${target}`);
    if (targetSec) {
        targetSec.classList.remove('hidden');
    }

    if (target === 'overview') {
        loadCharts();
    } else if (target === 'emi') {
        fetchUserEMIs();
    } else if (target === 'admin') {
        loadAdminPanel();
        if (!currentUserPrivileges.is_admin) {
            switchAdminTab('admin-expense-control');
        } else {
            switchAdminTab('admin-users');
        }
    } else if (target === 'add-expense' || target === 'dashboard') {
        // Refresh dropdown configurations to guarantee they are in sync
        fetchCategories();
        fetchBankModes();
        fetchPaymentTypes();
        fetchPaymentCategories();
    }
}

// USER PRIVILEGES LOADING
async function fetchUserPrivileges() {
    try {
        const response = await fetch('/api/user/privileges');
        if (response.ok) {
            const data = await response.json();
            currentUserPrivileges = data.privileges;
            applyUserPrivileges();
        }
    } catch (err) {
        console.error('Error fetching user privileges:', err);
    }
}

function applyUserPrivileges() {
    // Show Admin sidebar item for everyone (admins edit, users view read-only column config)
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) {
        navAdmin.classList.remove('hidden');
    }

    // Hide or show individual admin sub-tabs based on role
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => {
        const targetTab = tab.getAttribute('data-tab');
        if (targetTab === 'admin-expense-control' || targetTab === 'admin-currencies') {
            tab.classList.remove('hidden');
        } else {
            if (currentUserPrivileges.is_admin) {
                tab.classList.remove('hidden');
            } else {
                tab.classList.add('hidden');
            }
        }
    });

    // Hide or show Add Expense sidebar item
    const navAddExpense = document.getElementById('nav-add-expense');
    if (navAddExpense) {
        if (currentUserPrivileges.can_add) {
            navAddExpense.classList.remove('hidden');
        } else {
            navAddExpense.classList.add('hidden');
        }
    }

    // Toggle inline add buttons - visible to everyone since users manage their own child table config
    const inlineBtns = document.querySelectorAll('.inline-add-btn');
    inlineBtns.forEach(btn => {
        btn.style.display = 'inline-block';
    });

    // Refresh expense table to reflect action buttons privileges
    renderExpenseTable(expensesList);
}

// CATEGORIES FETCH & BIND
async function fetchCategories() {
    try {
        const response = await fetch('/api/categories');
        if (response.ok) {
            systemCategories = await response.json();
            populateCategoryDropdowns();
        }
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

function populateCategoryDropdowns() {
    const addCat = document.getElementById('add-category');
    const editCat = document.getElementById('edit-category');
    const filterCat = document.getElementById('filter-category');

    const addVal = addCat ? addCat.value : '';
    const editVal = editCat ? editCat.value : '';
    const filterVal = filterCat ? filterCat.value : '';

    if (addCat) {
        addCat.innerHTML = '<option value="" disabled selected>Select Category</option>';
        systemCategories.forEach(cat => {
            if (cat.name.toLowerCase() !== 'other') {
                addCat.innerHTML += `<option value="${escapeHTML(cat.name)}">${escapeHTML(cat.name)}</option>`;
            }
        });
        addCat.innerHTML += `<option value="Other">Other</option>`;
        if (addVal) addCat.value = addVal;
    }

    if (editCat) {
        editCat.innerHTML = '<option value="" disabled>Select Category</option>';
        systemCategories.forEach(cat => {
            if (cat.name.toLowerCase() !== 'other') {
                editCat.innerHTML += `<option value="${escapeHTML(cat.name)}">${escapeHTML(cat.name)}</option>`;
            }
        });
        editCat.innerHTML += `<option value="Other">Other</option>`;
        if (editVal) editCat.value = editVal;
    }

    if (filterCat) {
        filterCat.innerHTML = '<option value="">All Categories</option>';
        systemCategories.forEach(cat => {
            if (cat.name.toLowerCase() !== 'other') {
                filterCat.innerHTML += `<option value="${escapeHTML(cat.name)}">${escapeHTML(cat.name)}</option>`;
            }
        });
        filterCat.innerHTML += `<option value="Other">Other</option>`;
        if (filterVal) filterCat.value = filterVal;
    }
}

// BANK MODES FETCH & BIND
async function fetchBankModes() {
    try {
        const response = await fetch('/api/bank_modes');
        if (response.ok) {
            systemBankModes = await response.json();
            populateBankModesDropdowns();
        }
    } catch (err) {
        console.error('Error fetching bank modes:', err);
    }
}

// populateBankModesDropdowns implementation
function populateBankModesDropdowns() {
    const addBM = document.getElementById('add-bank-mode');
    const editBM = document.getElementById('edit-bank-mode');
    const filterBM = document.getElementById('filter-bank-mode');

    const addVal = addBM ? addBM.value : '';
    const editVal = editBM ? editBM.value : '';
    const filterVal = filterBM ? filterBM.value : '';

    if (addBM) {
        addBM.innerHTML = '<option value="">None / N/A</option>';
        systemBankModes.forEach(bm => {
            addBM.innerHTML += `<option value="${escapeHTML(bm.name)}">${escapeHTML(bm.name)}</option>`;
        });
        addBM.value = addVal;
    }

    if (editBM) {
        editBM.innerHTML = '<option value="">None / N/A</option>';
        systemBankModes.forEach(bm => {
            editBM.innerHTML += `<option value="${escapeHTML(bm.name)}">${escapeHTML(bm.name)}</option>`;
        });
        editBM.value = editVal;
    }

    if (filterBM) {
        filterBM.innerHTML = '<option value="">All Banks</option>';
        systemBankModes.forEach(bm => {
            filterBM.innerHTML += `<option value="${escapeHTML(bm.name)}">${escapeHTML(bm.name)}</option>`;
        });
        filterBM.value = filterVal;
    }
}

// PAYMENT TYPES FETCH & BIND
async function fetchPaymentTypes() {
    try {
        const response = await fetch('/api/payment_types');
        if (response.ok) {
            systemPaymentTypes = await response.json();
            populatePaymentTypesDropdowns();
        }
    } catch (err) {
        console.error('Error fetching payment types:', err);
    }
}

function populatePaymentTypesDropdowns() {
    const addPT = document.getElementById('add-payment-type');
    const editPT = document.getElementById('edit-payment-type');
    const filterPT = document.getElementById('filter-payment-type');

    const addVal = addPT ? addPT.value : '';
    const editVal = editPT ? editPT.value : '';
    const filterVal = filterPT ? filterPT.value : '';

    if (addPT) {
        addPT.innerHTML = '<option value="">None / N/A</option>';
        systemPaymentTypes.forEach(pt => {
            addPT.innerHTML += `<option value="${escapeHTML(pt.name)}">${escapeHTML(pt.name)}</option>`;
        });
        addPT.value = addVal;
    }

    if (editPT) {
        editPT.innerHTML = '<option value="">None / N/A</option>';
        systemPaymentTypes.forEach(pt => {
            editPT.innerHTML += `<option value="${escapeHTML(pt.name)}">${escapeHTML(pt.name)}</option>`;
        });
        editPT.value = editVal;
    }

    if (filterPT) {
        filterPT.innerHTML = '<option value="">All Types</option>';
        systemPaymentTypes.forEach(pt => {
            filterPT.innerHTML += `<option value="${escapeHTML(pt.name)}">${escapeHTML(pt.name)}</option>`;
        });
        filterPT.value = filterVal;
    }
}

// PAYMENT CATEGORIES FETCH & BIND
async function fetchPaymentCategories() {
    try {
        const response = await fetch('/api/payment_categories');
        if (response.ok) {
            systemPaymentCategories = await response.json();
            populatePaymentCategoriesDropdowns();
        }
    } catch (err) {
        console.error('Error fetching payment categories:', err);
    }
}

function populatePaymentCategoriesDropdowns() {
    const addPC = document.getElementById('add-payment-category');
    const editPC = document.getElementById('edit-payment-category');
    const filterPC = document.getElementById('filter-payment-category');

    const addVal = addPC ? addPC.value : '';
    const editVal = editPC ? editPC.value : '';
    const filterVal = filterPC ? filterPC.value : '';

    if (addPC) {
        addPC.innerHTML = '<option value="">None / N/A</option>';
        systemPaymentCategories.forEach(pc => {
            addPC.innerHTML += `<option value="${escapeHTML(pc.name)}">${escapeHTML(pc.name)}</option>`;
        });
        if (addVal) addPC.value = addVal;
    }

    if (editPC) {
        editPC.innerHTML = '<option value="">None / N/A</option>';
        systemPaymentCategories.forEach(pc => {
            editPC.innerHTML += `<option value="${escapeHTML(pc.name)}">${escapeHTML(pc.name)}</option>`;
        });
        if (editVal) editPC.value = editVal;
    }

    if (filterPC) {
        filterPC.innerHTML = '<option value="">All Sources</option>';
        systemPaymentCategories.forEach(pc => {
            filterPC.innerHTML += `<option value="${escapeHTML(pc.name)}">${escapeHTML(pc.name)}</option>`;
        });
        filterPC.value = filterVal;
    }
}

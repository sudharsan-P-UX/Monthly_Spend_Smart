// Global state for expenses list and Chart instances
let expensesList = [];
let categoryChartInstance = null;
let trendChartInstance = null;
let trendMonthsState = [];
let currentUserPrivileges = { can_view: 1, can_add: 1, can_edit: 1, can_delete: 1, is_admin: false };
let systemRoles = [];
let systemCategories = [];
let adminCategoriesLocal = [];

let systemBankModes = [];
let systemPaymentTypes = [];
let systemPaymentCategories = [];
let adminBankModesLocal = [];
let adminPaymentTypesLocal = [];
let adminPaymentCategoriesLocal = [];
let activeCurrencySymbol = '₹';
let adminCurrenciesLocal = [];

// Initialize Page
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch active currency first to set dynamic labels
    await fetchActiveCurrency();

    // Set default date to today in forms
    const today = new Date().toISOString().split('T')[0];
    const addDateInput = document.getElementById('add-date');
    if (addDateInput) {
        addDateInput.value = today;
    }
    const addCreatedDateInput = document.getElementById('add-createddate');
    if (addCreatedDateInput) {
        addCreatedDateInput.value = today;
    }

    // Initialize default filters to Current Month
    const currentDate = new Date();
    const currentYear = String(currentDate.getFullYear());
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    
    const filterMonthSelect = document.getElementById('filter-month');
    if (filterMonthSelect) {
        filterMonthSelect.value = currentMonth;
    }
    const filterYearSelect = document.getElementById('filter-year');
    if (filterYearSelect) {
        filterYearSelect.value = currentYear;
    }

    const filterStartInput = document.getElementById('filter-start-date');
    if (filterStartInput) {
        filterStartInput.value = "";
    }
    const filterEndInput = document.getElementById('filter-end-date');
    if (filterEndInput) {
        filterEndInput.value = "";
    }
    
    // Tab/Section switching
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            switchView(target);
        });
    });

    // Toggle custom category text fields
    const addCatSelect = document.getElementById('add-category');
    if (addCatSelect) {
        addCatSelect.addEventListener('change', (e) => {
            const wrapper = document.getElementById('add-category-other-wrapper');
            if (e.target.value.toLowerCase() === 'other') {
                wrapper.classList.remove('hidden');
                document.getElementById('add-category-other').required = true;
            } else {
                wrapper.classList.add('hidden');
                document.getElementById('add-category-other').required = false;
            }
        });
    }

    const editCatSelect = document.getElementById('edit-category');
    if (editCatSelect) {
        editCatSelect.addEventListener('change', (e) => {
            const wrapper = document.getElementById('edit-category-other-wrapper');
            if (e.target.value.toLowerCase() === 'other') {
                wrapper.classList.remove('hidden');
                document.getElementById('edit-category-other').required = true;
            } else {
                wrapper.classList.add('hidden');
                document.getElementById('edit-category-other').required = false;
            }
        });
    }

    // Toggle interest fields dynamically based on payment method selection
    const addPayMethodSelect = document.getElementById('add-payment-method');
    if (addPayMethodSelect) {
        addPayMethodSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const isCredit = (val === 'Credit');
            const wrapper = document.getElementById('add-interest-wrapper');
            if (wrapper) {
                if (isCredit) {
                    wrapper.classList.remove('hidden');
                } else {
                    wrapper.classList.add('hidden');
                    document.getElementById('add-interest').value = '';
                }
            }
            const statusWrapper = document.getElementById('add-status-wrapper');
            if (statusWrapper) {
                if (val === 'Debit') {
                    statusWrapper.classList.remove('hidden');
                } else {
                    statusWrapper.classList.add('hidden');
                    const addStatus = document.getElementById('add-status');
                    if (addStatus) addStatus.checked = true;
                }
            }
        });
    }

    const editPayMethodSelect = document.getElementById('edit-payment-method');
    if (editPayMethodSelect) {
        editPayMethodSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const isCredit = (val === 'Credit');
            const wrapper = document.getElementById('edit-interest-wrapper');
            if (wrapper) {
                if (isCredit) {
                    wrapper.classList.remove('hidden');
                } else {
                    wrapper.classList.add('hidden');
                    document.getElementById('edit-interest').value = '';
                }
            }
            const statusWrapper = document.getElementById('edit-status-wrapper');
            if (statusWrapper) {
                if (val === 'Debit') {
                    statusWrapper.classList.remove('hidden');
                } else {
                    statusWrapper.classList.add('hidden');
                    const editStatus = document.getElementById('edit-status');
                    if (editStatus) editStatus.checked = true;
                }
            }
        });
    }

    // Handle Admin Tabs Navigation
    initAdminTabs();

    // Handle Forms Submission
    const standaloneAddForm = document.getElementById('standalone-add-expense-form');
    if (standaloneAddForm) {
        standaloneAddForm.addEventListener('submit', handleAddExpense);
    }
    const btnAddItemToList = document.getElementById('btn-add-item-to-list');
    if (btnAddItemToList) {
        btnAddItemToList.addEventListener('click', handleAddItemToExpenseList);
    }
    const resetBtn = document.getElementById('add-expense-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (typeof pendingExpensesList !== 'undefined') {
                pendingExpensesList = [];
                renderPendingExpensesTable();
            }
        });
    }
    const editForm = document.getElementById('edit-expense-form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditExpense);
    }

    // Admin Panel Form Event Listeners
    const adminCreateUserForm = document.getElementById('admin-create-user-form');
    if (adminCreateUserForm) {
        adminCreateUserForm.addEventListener('submit', handleAdminCreateUser);
    }
    const changeUserPasswordForm = document.getElementById('change-user-password-form');
    if (changeUserPasswordForm) {
        changeUserPasswordForm.addEventListener('submit', handleAdminChangeUserPassword);
    }

    const expenseSelectAll = document.getElementById('expense-select-all');
    if (expenseSelectAll) {
        expenseSelectAll.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.expense-row-checkbox').forEach(cb => {
                cb.checked = checked;
            });
            updateExpenseSelection();
        });
    }

    const userEmiSelectAll = document.getElementById('user-emi-select-all');
    if (userEmiSelectAll) {
        userEmiSelectAll.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.user-emi-row-checkbox').forEach(cb => {
                cb.checked = checked;
            });
            updateUserEmiSelection();
        });
    }
    const adminCreateRoleForm = document.getElementById('admin-create-role-form');
    if (adminCreateRoleForm) {
        adminCreateRoleForm.addEventListener('submit', handleAdminCreateRole);
    }
    
    // Config Lists
    const adminCreateCategoryForm = document.getElementById('admin-create-category-form');
    if (adminCreateCategoryForm) {
        adminCreateCategoryForm.addEventListener('submit', handleAdminCreateCategory);
    }
    const saveCatsBtn = document.getElementById('btn-save-categories-order');
    if (saveCatsBtn) {
        saveCatsBtn.addEventListener('click', saveAllCategories);
    }

    const adminCreateBMForm = document.getElementById('admin-create-bank-mode-form');
    if (adminCreateBMForm) {
        adminCreateBMForm.addEventListener('submit', handleAdminCreateBankMode);
    }
    const saveBMBtn = document.getElementById('btn-save-bank-modes');
    if (saveBMBtn) {
        saveBMBtn.addEventListener('click', saveAllBankModes);
    }

    const adminCreatePTForm = document.getElementById('admin-create-payment-type-form');
    if (adminCreatePTForm) {
        adminCreatePTForm.addEventListener('submit', handleAdminCreatePaymentType);
    }
    const savePTBtn = document.getElementById('btn-save-payment-types');
    if (savePTBtn) {
        savePTBtn.addEventListener('click', saveAllPaymentTypes);
    }

    const adminCreatePCForm = document.getElementById('admin-create-payment-category-form');
    if (adminCreatePCForm) {
        adminCreatePCForm.addEventListener('submit', handleAdminCreatePaymentCategory);
    }
    const savePCBtn = document.getElementById('btn-save-payment-categories');
    if (savePCBtn) {
        savePCBtn.addEventListener('click', saveAllPaymentCategories);
    }

    // Excel Export Form Submit binding (Month/Year selection)
    const exportExpenseForm = document.getElementById('export-expense-form');
    if (exportExpenseForm) {
        exportExpenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const month = document.getElementById('export-month').value;
            const year = document.getElementById('export-year').value;
            
            let query = '';
            if (month) query += `month=${encodeURIComponent(month)}&`;
            if (year) query += `year=${encodeURIComponent(year)}`;
            
            window.location.href = `/api/expenses/export?${query}`;
            closeExportModal();
        });
    }

    // Excel Import Form Submit binding
    const importExpenseForm = document.getElementById('import-expense-form');
    if (importExpenseForm) {
        importExpenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('import-file');
            if (!fileInput || fileInput.files.length === 0) {
                showAppAlert('Please select a file.');
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            try {
                const response = await fetch('/api/expenses/import', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showAppAlert(result.message, true);
                    closeImportModal();
                    // Reload data
                    await fetchExpenses();
                    await updateOverviewStats();
                } else {
                    showAppAlert(result.error || 'Failed to import expenses.');
                }
            } catch (err) {
                showAppAlert('Network error importing expenses.');
            }
        });
    }

    const excelColumnsFilter = document.getElementById('admin-excel-columns-filter');
    if (excelColumnsFilter) {
        excelColumnsFilter.addEventListener('change', () => {
            adminFetchExcelColumns();
        });
    }

    // EMI Form calculation triggers (user)
    const emiForm = document.getElementById('emi-form');
    if (emiForm) {
        emiForm.addEventListener('submit', handleEmiSubmit);
        
        const emiPrincipal = document.getElementById('emi-principal');
        const emiInterest = document.getElementById('emi-interest-rate');
        const emiTenure = document.getElementById('emi-tenure');
        const emiAmount = document.getElementById('emi-amount');
        const emiStart = document.getElementById('emi-start-date');
        const emiEnd = document.getElementById('emi-end-date');

        function triggerUserEmiCalc() {
            const principal = parseFloat(emiPrincipal.value) || 0;
            const rate = parseFloat(emiInterest.value) || 0;
            const tenure = parseInt(emiTenure.value) || 0;
            if (principal > 0 && tenure > 0) {
                const emi = calculateEMI(principal, rate, tenure);
                emiAmount.value = emi.toFixed(2);
            }
        }

        function triggerUserEndDateCalc() {
            const startVal = emiStart.value;
            const tenure = parseInt(emiTenure.value) || 0;
            if (startVal && tenure > 0) {
                emiEnd.value = calculateEndDate(startVal, tenure);
            }
        }

        emiPrincipal.addEventListener('input', triggerUserEmiCalc);
        emiInterest.addEventListener('input', triggerUserEmiCalc);
        emiTenure.addEventListener('input', () => {
            triggerUserEmiCalc();
            triggerUserEndDateCalc();
        });
        emiStart.addEventListener('change', triggerUserEndDateCalc);
    }

    // Admin EMI form submission and calculations
    const adminEmiForm = document.getElementById('admin-emi-form');
    if (adminEmiForm) {
        adminEmiForm.addEventListener('submit', handleAdminEmiSubmit);
        
        const adminEmiPrincipal = document.getElementById('admin-emi-principal');
        const adminEmiInterest = document.getElementById('admin-emi-interest-rate');
        const adminEmiTenure = document.getElementById('admin-emi-tenure');
        const adminEmiAmount = document.getElementById('admin-emi-amount');
        const adminEmiStart = document.getElementById('admin-emi-start-date');
        const adminEmiEnd = document.getElementById('admin-emi-end-date');

        function triggerAdminEmiCalc() {
            const principal = parseFloat(adminEmiPrincipal.value) || 0;
            const rate = parseFloat(adminEmiInterest.value) || 0;
            const tenure = parseInt(adminEmiTenure.value) || 0;
            if (principal > 0 && tenure > 0) {
                const emi = calculateEMI(principal, rate, tenure);
                adminEmiAmount.value = emi.toFixed(2);
            }
        }

        function triggerAdminEndDateCalc() {
            const startVal = adminEmiStart.value;
            const tenure = parseInt(adminEmiTenure.value) || 0;
            if (startVal && tenure > 0) {
                adminEmiEnd.value = calculateEndDate(startVal, tenure);
            }
        }

        adminEmiPrincipal.addEventListener('input', triggerAdminEmiCalc);
        adminEmiInterest.addEventListener('input', triggerAdminEmiCalc);
        adminEmiTenure.addEventListener('input', () => {
            triggerAdminEmiCalc();
            triggerAdminEndDateCalc();
        });
        adminEmiStart.addEventListener('change', triggerAdminEndDateCalc);

        const adminCancelEmiBtn = document.getElementById('btn-admin-emi-cancel');
        if (adminCancelEmiBtn) {
            adminCancelEmiBtn.addEventListener('click', resetAdminEmiForm);
        }
    }

    // User EMI Import Form
    const emiImportForm = document.getElementById('emi-import-form');
    if (emiImportForm) {
        emiImportForm.addEventListener('submit', handleEmiImportSubmit);
    }

    // Admin EMI Import Form
    const adminEmiImportForm = document.getElementById('admin-emi-import-form');
    if (adminEmiImportForm) {
        adminEmiImportForm.addEventListener('submit', handleAdminEmiImportSubmit);
    }

    // Currencies Config Form Submit
    const currencyForm = document.getElementById('admin-currency-form');
    if (currencyForm) {
        currencyForm.addEventListener('submit', adminSaveCurrency);
    }

    // Expense Control List Switcher Dropdown Listener
    const expenseControlSelect = document.getElementById('expense-control-select');
    if (expenseControlSelect) {
        expenseControlSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            document.querySelectorAll('.control-sub-section').forEach(sec => {
                sec.classList.add('hidden');
            });
            const targetSec = document.getElementById(`sub-expense-control-${val}`);
            if (targetSec) {
                targetSec.classList.remove('hidden');
            }
        });
    }

    // Excel Columns Target Select Dropdown Listener
    const excelColumnsTarget = document.getElementById('admin-excel-columns-target');
    if (excelColumnsTarget) {
        excelColumnsTarget.addEventListener('change', () => {
            adminFetchExcelColumns();
        });
    }

    // Excel Columns Custom EMI Column Creation Form Submit Listener
    const adminCreateEmiColumnForm = document.getElementById('admin-create-emi-column-form');
    if (adminCreateEmiColumnForm) {
        adminCreateEmiColumnForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const key = document.getElementById('admin-new-emi-col-key').value.trim().toLowerCase();
            const label = document.getElementById('admin-new-emi-col-label').value.trim();
            const orderVal = parseInt(document.getElementById('admin-new-emi-col-order').value) || 0;
            const parentKey = document.getElementById('admin-new-emi-col-parent').value.trim() || null;
            const parentVal = document.getElementById('admin-new-emi-col-trigger').value.trim() || null;
            const imp = document.getElementById('admin-new-emi-col-import').checked ? 1 : 0;
            const exp = document.getElementById('admin-new-emi-col-export').checked ? 1 : 0;
            
            try {
                const response = await fetch('/api/admin/excel-columns/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        column_key: key,
                        column_label: label,
                        target_type: 'emi',
                        is_enabled_import: imp,
                        is_enabled_export: exp,
                        is_required: 0,
                        display_order: orderVal,
                        parent_column_key: parentKey,
                        parent_trigger_value: parentVal
                    })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showAppAlert('Custom EMI column registered successfully!', true);
                    adminCreateEmiColumnForm.reset();
                    document.getElementById('admin-new-emi-col-order').value = '';
                    document.getElementById('admin-new-emi-col-parent').value = '';
                    document.getElementById('admin-new-emi-col-trigger').value = '';
                    await adminFetchEmiColumns();
                    await loadDynamicCustomFields();
                } else {
                    showAppAlert(result.error || 'Failed to create custom column.');
                }
            } catch (err) {
                showAppAlert('Network error creating custom column.');
            }
        });
    }

    // EMI Columns Filter Change Listener
    const adminEmiColumnsFilter = document.getElementById('admin-emi-columns-filter');
    if (adminEmiColumnsFilter) {
        adminEmiColumnsFilter.addEventListener('change', () => {
            adminFetchEmiColumns();
        });
    }

    // Save EMI Columns Changes Button Listener
    const btnSaveEmiColumns = document.getElementById('btn-save-emi-columns');
    if (btnSaveEmiColumns) {
        btnSaveEmiColumns.addEventListener('click', saveEmiColumnsChanges);
    }

    // Expense Columns (New Menu) Filter Change Listener
    const adminExpenseColumnsFilter = document.getElementById('admin-expense-columns-filter');
    if (adminExpenseColumnsFilter) {
        adminExpenseColumnsFilter.addEventListener('change', () => {
            adminFetchExpenseColumnsTab();
        });
    }

    // Save Expense Columns Button Listener
    const btnSaveExpenseColumnsTab = document.getElementById('btn-save-expense-columns-tab');
    if (btnSaveExpenseColumnsTab) {
        btnSaveExpenseColumnsTab.addEventListener('click', saveExpenseColumnsTabChanges);
    }

    // Expense Columns Custom Column Creation Form Submit Listener
    const adminCreateExpenseColumnTabForm = document.getElementById('admin-create-expense-column-tab-form');
    if (adminCreateExpenseColumnTabForm) {
        adminCreateExpenseColumnTabForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const key = document.getElementById('admin-new-expense-col-key').value.trim().toLowerCase();
            const label = document.getElementById('admin-new-expense-col-label').value.trim();
            const orderVal = parseInt(document.getElementById('admin-new-expense-col-order').value) || 0;
            const parentKey = document.getElementById('admin-new-expense-col-parent').value.trim() || null;
            const parentVal = document.getElementById('admin-new-expense-col-trigger').value.trim() || null;
            const imp = document.getElementById('admin-new-expense-col-import').checked ? 1 : 0;
            const exp = document.getElementById('admin-new-expense-col-export').checked ? 1 : 0;
            
            try {
                const response = await fetch('/api/admin/excel-columns/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        column_key: key,
                        column_label: label,
                        target_type: 'expense',
                        is_enabled_import: imp,
                        is_enabled_export: exp,
                        is_required: 0,
                        display_order: orderVal,
                        parent_column_key: parentKey,
                        parent_trigger_value: parentVal
                    })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showAppAlert('Custom Expense column registered successfully!', true);
                    adminCreateExpenseColumnTabForm.reset();
                    document.getElementById('admin-new-expense-col-order').value = '';
                    document.getElementById('admin-new-expense-col-parent').value = '';
                    document.getElementById('admin-new-expense-col-trigger').value = '';
                    await adminFetchExpenseColumnsTab();
                    await loadDynamicCustomFields();
                } else {
                    showAppAlert(result.error || 'Failed to create custom column.');
                }
            } catch (err) {
                showAppAlert('Network error creating custom column.');
            }
        });
    }

    // Excel Columns Custom Column Creation Form Submit Listener
    const adminCreateColumnForm = document.getElementById('admin-create-column-form');
    if (adminCreateColumnForm) {
        adminCreateColumnForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const key = document.getElementById('admin-new-col-key').value.trim().toLowerCase();
            const label = document.getElementById('admin-new-col-label').value.trim();
            const targetType = document.getElementById('admin-new-col-target-type').value;
            const orderVal = parseInt(document.getElementById('admin-new-col-order').value) || 0;
            const parentKey = document.getElementById('admin-new-col-parent').value.trim() || null;
            const parentVal = document.getElementById('admin-new-col-trigger').value.trim() || null;
            const imp = document.getElementById('admin-new-col-import').checked ? 1 : 0;
            const exp = document.getElementById('admin-new-col-export').checked ? 1 : 0;
            
            try {
                const response = await fetch('/api/admin/excel-columns/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        column_key: key,
                        column_label: label,
                        target_type: targetType,
                        is_enabled_import: imp,
                        is_enabled_export: exp,
                        is_required: 0,
                        display_order: orderVal,
                        parent_column_key: parentKey,
                        parent_trigger_value: parentVal
                    })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showAppAlert('Custom column registered successfully!', true);
                    adminCreateColumnForm.reset();
                    document.getElementById('admin-new-col-order').value = '';
                    document.getElementById('admin-new-col-parent').value = '';
                    document.getElementById('admin-new-col-trigger').value = '';
                    await adminFetchExcelColumns();
                    await loadDynamicCustomFields();
                } else {
                    showAppAlert(result.error || 'Failed to create custom column.');
                }
            } catch (err) {
                showAppAlert('Network error creating custom column.');
            }
        });
    }

    // Save Excel Columns Changes Button Listener
    const btnSaveExcelColumns = document.getElementById('btn-save-excel-columns');
    if (btnSaveExcelColumns) {
        btnSaveExcelColumns.addEventListener('click', saveExcelColumnsChanges);
    }

    // Inline Control Item Creation Form Submit Listener
    const inlineControlForm = document.getElementById('inline-control-form');
    if (inlineControlForm) {
        inlineControlForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('inline-control-type').value;
            const name = document.getElementById('inline-control-name').value.trim();
            const order = parseInt(document.getElementById('inline-control-order').value) || 0;
            
            let url = '';
            let payload = {};
            if (type === 'category') {
                url = '/api/admin/categories/create';
                payload = { name, display_order: order };
            } else if (type === 'bank-mode') {
                url = '/api/admin/bank-modes/create';
                payload = { name, display_order: order };
            } else if (type === 'payment-type') {
                url = '/api/admin/payment-types/create';
                payload = { name, display_order: order };
            } else if (type === 'payment-category') {
                url = '/api/admin/payment-categories/create';
                payload = { name, display_order: order };
            }
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    showAppAlert('Item created successfully!', true);
                    closeInlineControlModal();
                    if (type === 'category') {
                        await fetchCategories();
                        await adminFetchCategories();
                    } else if (type === 'bank-mode') {
                        await fetchBankModes();
                        await adminFetchBankModes();
                    } else if (type === 'payment-type') {
                        await fetchPaymentTypes();
                        await adminFetchPaymentTypes();
                    } else if (type === 'payment-category') {
                        await fetchPaymentCategories();
                        await adminFetchPaymentCategories();
                    }
                } else {
                    showAppAlert(result.error || 'Failed to create item.');
                }
            } catch (err) {
                showAppAlert('Network error creating item.');
            }
        });
    }

    // Inline Add Button Event Listeners
    document.querySelectorAll('.inline-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const type = btn.getAttribute('data-type');
            openInlineControlModal(type);
        });
    });

    // Initial data fetch
    await fetchUserPrivileges();
    await fetchCategories();
    await fetchBankModes();
    await fetchPaymentTypes();
    await fetchPaymentCategories();
    await fetchExpenses();
    await updateOverviewStats();
    await loadDynamicCustomFields();
    if (currentUserPrivileges.is_admin) {
        await adminFetchCurrencies();
    }
});

// ALERTS HELPER
function showAppAlert(msg, isSuccess = false) {
    const alertBox = document.getElementById('app-alert');
    const alertMsg = alertBox.querySelector('.alert-message');
    alertBox.className = 'alert ' + (isSuccess ? 'alert-success' : 'alert-error');
    alertMsg.textContent = msg;
    alertBox.classList.remove('hidden');
    
    // Auto close after 4 seconds
    setTimeout(closeAppAlert, 4000);
}

function closeAppAlert() {
    document.getElementById('app-alert').classList.add('hidden');
}

// TOGGLE FILTER PANEL
function toggleFilters() {
    const filterPanel = document.getElementById('filters-panel');
    filterPanel.classList.toggle('hidden');
}

function resetFilters() {
    document.getElementById('filter-category').value = "";
    document.getElementById('filter-bank-mode').value = "";
    document.getElementById('filter-payment-type').value = "";
    document.getElementById('filter-payment-category').value = "";
    const filterMethod = document.getElementById('filter-payment-method');
    if (filterMethod) filterMethod.value = "";
    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) filterStatus.value = "";
    
    const currentDate = new Date();
    const currentYear = String(currentDate.getFullYear());
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    
    const filterMonth = document.getElementById('filter-month');
    if (filterMonth) filterMonth.value = currentMonth;
    const filterYear = document.getElementById('filter-year');
    if (filterYear) filterYear.value = currentYear;
    
    document.getElementById('filter-start-date').value = "";
    document.getElementById('filter-end-date').value = "";
    document.getElementById('filter-search').value = "";
    fetchExpenses();
}

// Profile menu dropdown toggle
const profileTrigger = document.getElementById('user-profile-menu-trigger');
const profileDropdown = document.getElementById('profile-dropdown');

if (profileTrigger && profileDropdown) {
    profileTrigger.addEventListener('click', function(e) {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking elsewhere
    document.addEventListener('click', function(e) {
        if (!profileTrigger.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
    });
}

// Modal open/close helpers
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Open Profile Modal & Load Data
const dropdownProfileBtn = document.getElementById('dropdown-profile-btn');
if (dropdownProfileBtn) {
    dropdownProfileBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (profileDropdown) profileDropdown.classList.remove('show');

        try {
            const response = await fetch('/api/user/profile');
            if (response.ok) {
                const data = await response.json();
                document.getElementById('profile-first-name').value = data.first_name || '';
                document.getElementById('profile-last-name').value = data.last_name || '';
                document.getElementById('profile-username').value = data.username || '';
                document.getElementById('profile-email').value = data.email || '';
                document.getElementById('profile-phone').value = data.phone || '';
                openModal('user-profile-modal');
            } else {
                showAppAlert('Failed to load profile details.');
            }
        } catch (err) {
            showAppAlert('Network error loading profile.');
        }
    });
}

// Save Profile Form
const userProfileForm = document.getElementById('user-profile-form');
if (userProfileForm) {
    userProfileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const firstName = document.getElementById('profile-first-name').value;
        const lastName = document.getElementById('profile-last-name').value;
        const email = document.getElementById('profile-email').value;
        const phone = document.getElementById('profile-phone').value;

        try {
            const response = await fetch('/api/user/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    phone: phone
                })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                showAppAlert(result.message || 'Profile saved successfully.', true);
                closeModal('user-profile-modal');
            } else {
                showAppAlert(result.message || 'Failed to update profile.');
            }
        } catch (err) {
            showAppAlert('Network error saving profile.');
        }
    });
}

// Open Change Password Modal
const dropdownPasswordBtn = document.getElementById('dropdown-password-btn');
if (dropdownPasswordBtn) {
    dropdownPasswordBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (profileDropdown) profileDropdown.classList.remove('show');
        
        // Clear fields
        document.getElementById('profile-new-password').value = '';
        document.getElementById('profile-confirm-password').value = '';
        
        openModal('user-change-password-modal');
    });
}

// Save Password Form
const userChangePasswordForm = document.getElementById('user-change-password-form');
if (userChangePasswordForm) {
    userChangePasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const newPassword = document.getElementById('profile-new-password').value;
        const confirmPassword = document.getElementById('profile-confirm-password').value;

        if (newPassword !== confirmPassword) {
            showAppAlert('Passwords do not match.');
            return;
        }

        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                showAppAlert(result.message || 'Password changed successfully.', true);
                closeModal('user-change-password-modal');
            } else {
                showAppAlert(result.message || 'Failed to update password.');
            }
        } catch (err) {
            showAppAlert('Network error saving password.');
        }
    });
}

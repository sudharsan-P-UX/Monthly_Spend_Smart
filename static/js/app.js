// Global state for expenses list and Chart instances
let expensesList = [];
let categoryChartInstance = null;
let trendChartInstance = null;
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

    // Initialize default filters to All Months
    const currentDate = new Date();
    const currentYear = String(currentDate.getFullYear());
    
    const filterMonthSelect = document.getElementById('filter-month');
    if (filterMonthSelect) {
        filterMonthSelect.value = "";
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
    
    const filterMonth = document.getElementById('filter-month');
    if (filterMonth) filterMonth.value = "";
    const filterYear = document.getElementById('filter-year');
    if (filterYear) filterYear.value = currentYear;
    
    document.getElementById('filter-start-date').value = "";
    document.getElementById('filter-end-date').value = "";
    document.getElementById('filter-search').value = "";
    fetchExpenses();
}

// IMPORT MODAL CONTROL
function openImportModal() {
    const importModal = document.getElementById('import-modal');
    if (importModal) {
        importModal.classList.remove('hidden');
    }
}

function closeImportModal() {
    const importModal = document.getElementById('import-modal');
    if (importModal) {
        importModal.classList.add('hidden');
        const importForm = document.getElementById('import-expense-form');
        if (importForm) importForm.reset();
    }
}

// EXPORT MODAL CONTROL
function openExportModal() {
    const exportModal = document.getElementById('export-modal');
    if (exportModal) {
        exportModal.classList.remove('hidden');
    }
}

function closeExportModal() {
    const exportModal = document.getElementById('export-modal');
    if (exportModal) {
        exportModal.classList.add('hidden');
        const exportForm = document.getElementById('export-expense-form');
        if (exportForm) exportForm.reset();
    }
}

// FETCH EXPENSES
async function fetchExpenses() {
    const category = document.getElementById('filter-category').value;
    const bankMode = document.getElementById('filter-bank-mode').value;
    const paymentType = document.getElementById('filter-payment-type').value;
    const paymentCategory = document.getElementById('filter-payment-category').value;
    const paymentMethod = document.getElementById('filter-payment-method') ? document.getElementById('filter-payment-method').value : "";
    const status = document.getElementById('filter-status') ? document.getElementById('filter-status').value : "";
    const month = document.getElementById('filter-month') ? document.getElementById('filter-month').value : "";
    const year = document.getElementById('filter-year') ? document.getElementById('filter-year').value : "";
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    const search = document.getElementById('filter-search').value;

    let query = `/api/expenses?`;
    if (category) query += `category=${encodeURIComponent(category)}&`;
    if (bankMode) query += `bank_mode=${encodeURIComponent(bankMode)}&`;
    if (paymentType) query += `payment_type=${encodeURIComponent(paymentType)}&`;
    if (paymentCategory) query += `payment_category=${encodeURIComponent(paymentCategory)}&`;
    if (paymentMethod) query += `payment_method=${encodeURIComponent(paymentMethod)}&`;
    if (status) query += `status=${encodeURIComponent(status)}&`;
    if (month) query += `month=${encodeURIComponent(month)}&`;
    if (year) query += `year=${encodeURIComponent(year)}&`;
    if (startDate) query += `start_date=${startDate}&`;
    if (endDate) query += `end_date=${endDate}&`;
    if (search) query += `search=${encodeURIComponent(search)}`;

    try {
        const response = await fetch(query);
        if (response.ok) {
            expensesList = await response.json();
            renderExpenseTable(expensesList);
        } else {
            showAppAlert('Failed to load expenses.');
        }
    } catch (err) {
        showAppAlert('Network error loading expenses.');
    }

    // Fetch year-based totals
    const selectedYear = year || new Date().getFullYear();
    try {
        const yearResponse = await fetch(`/api/year_totals?year=${selectedYear}`);
        if (yearResponse.ok) {
            const yearData = await yearResponse.json();
            const formatter = getCurrencyFormatter(activeCurrencySymbol);
            
            const yearWrapper = document.getElementById('dashboard-year-total-wrapper');
            const yearLabel = document.getElementById('dashboard-year-total-label');
            const yearDebit = document.getElementById('dashboard-year-debit');
            const yearCredit = document.getElementById('dashboard-year-credit');
            
            if (yearWrapper) yearWrapper.classList.remove('hidden');
            if (yearLabel) yearLabel.textContent = `${selectedYear} Totals:`;
            if (yearDebit) yearDebit.textContent = `Debits: ${formatter.format(yearData.debit)}`;
            if (yearCredit) yearCredit.textContent = `Credits: ${formatter.format(yearData.credit)}`;
        }
    } catch (err) {
        console.error('Error fetching year totals:', err);
    }
}

// RENDER TABLE
function renderExpenseTable(expenses) {
    const tbody = document.getElementById('expense-list-body');
    const emptyState = document.getElementById('no-expenses-msg');
    tbody.innerHTML = '';

    // Calculate filtered debit and credit amounts based on payment_method
    let filteredDebit = 0;
    let filteredCredit = 0;
    expenses.forEach(exp => {
        const amt = parseFloat(exp.amount) || 0;
        const isCredit = (exp.payment_method === 'Credit');
        if (isCredit) {
            filteredCredit += amt;
        } else {
            filteredDebit += amt;
        }
    });

    const formatter = getCurrencyFormatter(activeCurrencySymbol);
    const fdEl = document.getElementById('dashboard-filtered-debit');
    const fcEl = document.getElementById('dashboard-filtered-credit');
    if (fdEl) fdEl.textContent = formatter.format(filteredDebit);
    if (fcEl) fcEl.textContent = formatter.format(filteredCredit);

    // Update transaction count card with filtered list length
    const txCountEl = document.getElementById('transaction-count');
    if (txCountEl) txCountEl.textContent = expenses.length;

    if (expenses.length === 0) {
        emptyState.classList.remove('hidden');
        document.getElementById('expense-table').style.display = 'none';
        return;
    }

    emptyState.classList.add('hidden');
    document.getElementById('expense-table').style.display = 'table';

    expenses.forEach(exp => {
        const tr = document.createElement('tr');
        
        // CSS class for category tag
        let catClass = 'cat-other';
        const cleanCat = exp.category.toLowerCase().replace(/\s+/g, '-').replace('&', '');
        
        if (cleanCat.includes('food')) catClass = 'cat-food-dining';
        else if (cleanCat.includes('shopping')) catClass = 'cat-shopping';
        else if (cleanCat.includes('housing')) catClass = 'cat-housing-rent';
        else if (cleanCat.includes('transportation')) catClass = 'cat-transportation';
        else if (cleanCat.includes('entertainment')) catClass = 'cat-entertainment';
        else if (cleanCat.includes('utilities')) catClass = 'cat-utilities';
        else if (cleanCat.includes('medical')) catClass = 'cat-medical-healthcare';
        else if (cleanCat.includes('education')) catClass = 'cat-education';
        else catClass = 'cat-other';

        // Payment Gateway combined column
        let gateway = '-';
        if (exp.payment_type && exp.bank_mode) {
            gateway = `${exp.payment_type} (${exp.bank_mode})`;
        } else if (exp.payment_type) {
            gateway = exp.payment_type;
        } else if (exp.bank_mode) {
            gateway = exp.bank_mode;
        }

        // Debit / Credit method badge
        const payMethod = exp.payment_method || 'Debit';
        const badgeClass = (payMethod === 'Credit') ? 'badge-credit' : 'badge-debit';
        const badgeHtml = `<span class="badge ${badgeClass}">${payMethod}</span>`;

        // Payment Source
        const paySource = exp.payment_category || '-';

        // Render Action Buttons based on privileges
        let actionsHtml = '';
        if (currentUserPrivileges.can_edit || currentUserPrivileges.can_delete) {
            actionsHtml = `<div class="action-buttons">`;
            if (currentUserPrivileges.can_edit) {
                actionsHtml += `
                    <button class="btn-icon btn-icon-edit" onclick="openEditModal(${exp.id})" title="Edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>`;
            }
            if (currentUserPrivileges.can_delete) {
                actionsHtml += `
                    <button class="btn-icon btn-icon-delete" onclick="deleteExpense(${exp.id})" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>`;
            }
            actionsHtml += `</div>`;
        } else {
            actionsHtml = `<span class="text-muted">-</span>`;
        }

        // Status Badge
        const statusVal = exp.status || 'Paid';
        const statusBadgeClass = (statusVal === 'Paid') ? 'badge-credit' : 'badge-debit';
        const statusHtml = `<span class="badge ${statusBadgeClass}">${statusVal}</span>`;

        tr.innerHTML = `
            <td>${formatDate(exp.date)}</td>
            <td><span class="category-tag ${catClass}">${exp.category}</span></td>
            <td>${escapeHTML(exp.description || '-')}</td>
            <td>${escapeHTML(gateway)}</td>
            <td>${escapeHTML(paySource)}</td>
            <td class="text-center">${badgeHtml}</td>
            <td class="text-right expense-amount">${activeCurrencySymbol}${parseFloat(exp.amount).toFixed(2)}</td>
            <td class="text-right expense-interest">${activeCurrencySymbol}${parseFloat(exp.interest || 0).toFixed(2)}</td>
            <td class="text-center">${statusHtml}</td>
            <td class="text-center">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// UPDATE TOP METRIC CARDS
async function updateOverviewStats() {
    try {
        const response = await fetch('/api/overview');
        if (response.ok) {
            const data = await response.json();
            
            // Format currency
            const formatter = getCurrencyFormatter(activeCurrencySymbol);
            
            document.getElementById('month-total').textContent = formatter.format(data.total_month);
            document.getElementById('all-total').textContent = formatter.format(data.total_all);
            
            // Update transaction count directly from the length of current list
            document.getElementById('transaction-count').textContent = expensesList.length;

            // Overview Credit/Debit totals
            const ovMonthDebit = document.getElementById('overview-month-debit');
            const ovMonthCredit = document.getElementById('overview-month-credit');
            const ovTotalDebit = document.getElementById('overview-total-debit');
            const ovTotalCredit = document.getElementById('overview-total-credit');
            
            if (ovMonthDebit) ovMonthDebit.textContent = formatter.format(data.month_debit || 0);
            if (ovMonthCredit) ovMonthCredit.textContent = formatter.format(data.month_credit || 0);
            if (ovTotalDebit) ovTotalDebit.textContent = formatter.format(data.total_debit || 0);
            if (ovTotalCredit) ovTotalCredit.textContent = formatter.format(data.total_credit || 0);
        }
    } catch (err) {
        console.error('Error fetching statistics:', err);
    }
}

// ADD EXPENSE
async function handleAddExpense(e) {
    e.preventDefault();
    const amount = document.getElementById('add-amount').value;
    let category = document.getElementById('add-category').value;
    const date = document.getElementById('add-date').value;
    const bank_mode = document.getElementById('add-bank-mode').value;
    const payment_type = document.getElementById('add-payment-type').value;
    const payment_category = document.getElementById('add-payment-category').value;
    const payment_method = document.getElementById('add-payment-method') ? document.getElementById('add-payment-method').value : 'Debit';
    const status = document.getElementById('add-status') && document.getElementById('add-status').checked ? 'Paid' : 'Unpaid';
    const description = document.getElementById('add-description').value;
    const interestVal = document.getElementById('add-interest') ? document.getElementById('add-interest').value : '';
    const interest = interestVal === '' ? 0.0 : parseFloat(interestVal) || 0.0;

    if (category.toLowerCase() === 'other') {
        const customCat = document.getElementById('add-category-other').value.trim();
        if (!customCat) {
            showAppAlert('Please specify the custom category name.');
            return;
        }
        category = customCat;
    }

    try {
        const payload = { amount, category, date, description, bank_mode, payment_type, payment_category, interest, payment_method, status };
        document.querySelectorAll('#add-expense-custom-fields .custom-expense-field').forEach(input => {
            payload[input.getAttribute('data-key')] = input.value;
        });

        const response = await fetch('/api/expenses/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
            showAppAlert('Expense added successfully!', true);
            
            // Reset form fields but keep date as today
            document.getElementById('standalone-add-expense-form').reset();
            document.querySelectorAll('#add-expense-custom-fields .custom-expense-field').forEach(input => {
                input.value = '';
            });
            document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('add-bank-mode').value = "";
            document.getElementById('add-payment-type').value = "";
            document.getElementById('add-payment-category').value = "";
            if (document.getElementById('add-payment-method')) {
                document.getElementById('add-payment-method').value = "Debit";
            }
            if (document.getElementById('add-status')) {
                document.getElementById('add-status').checked = true;
            }
            if (document.getElementById('add-status-wrapper')) {
                document.getElementById('add-status-wrapper').classList.remove('hidden');
            }
            document.getElementById('add-interest').value = "";
            document.getElementById('add-interest-wrapper').classList.add('hidden');
            document.getElementById('add-category-other-wrapper').classList.add('hidden');
            
            // Redirect to dashboard page view
            switchView('dashboard');
            
            // Refresh dashboard lists and metrics
            await fetchExpenses();
            await updateOverviewStats();
        } else {
            showAppAlert(result.error || 'Failed to add expense.');
        }
    } catch (err) {
        showAppAlert('Network error adding expense.');
    }
}

// EDIT EXPENSE
async function handleEditExpense(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const amount = document.getElementById('edit-amount').value;
    let category = document.getElementById('edit-category').value;
    const date = document.getElementById('edit-date').value;
    const bank_mode = document.getElementById('edit-bank-mode').value;
    const payment_type = document.getElementById('edit-payment-type').value;
    const payment_category = document.getElementById('edit-payment-category').value;
    const payment_method = document.getElementById('edit-payment-method') ? document.getElementById('edit-payment-method').value : 'Debit';
    const status = document.getElementById('edit-status') && document.getElementById('edit-status').checked ? 'Paid' : 'Unpaid';
    const description = document.getElementById('edit-description').value;
    const interestVal = document.getElementById('edit-interest') ? document.getElementById('edit-interest').value : '';
    const interest = interestVal === '' ? 0.0 : parseFloat(interestVal) || 0.0;

    if (category.toLowerCase() === 'other') {
        const customCat = document.getElementById('edit-category-other').value.trim();
        if (!customCat) {
            showAppAlert('Please specify the custom category name.');
            return;
        }
        category = customCat;
    }

    try {
        const payload = { amount, category, date, description, bank_mode, payment_type, payment_category, interest, payment_method, status };
        document.querySelectorAll('#edit-expense-custom-fields .custom-expense-field').forEach(input => {
            payload[input.getAttribute('data-key')] = input.value;
        });

        const response = await fetch(`/api/expenses/edit/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (response.ok && result.success) {
            showAppAlert('Expense updated successfully!', true);
            closeEditModal();
            
            // Refresh lists and metrics
            await fetchExpenses();
            await updateOverviewStats();
        } else {
            showAppAlert(result.error || 'Failed to update expense.');
        }
    } catch (err) {
        showAppAlert('Network error updating expense.');
    }
}

// DELETE EXPENSE
async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
        const response = await fetch(`/api/expenses/delete/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
            showAppAlert('Expense deleted successfully.', true);
            await fetchExpenses();
            await updateOverviewStats();
        } else {
            showAppAlert(result.error || 'Failed to delete expense.');
        }
    } catch (err) {
        showAppAlert('Network error deleting expense.');
    }
}

function openEditModal(id) {
    const expense = expensesList.find(x => x.id === id);
    if (!expense) return;

    // Refresh dropdowns to ensure all options are fully updated
    populateCategoryDropdowns();
    populateBankModesDropdowns();
    populatePaymentTypesDropdowns();
    populatePaymentCategoriesDropdowns();

    document.getElementById('edit-id').value = expense.id;
    document.getElementById('edit-amount').value = expense.amount;
    
    // Check if category is standard
    const isStandardCategory = systemCategories.some(cat => cat.name === expense.category);
    const wrapper = document.getElementById('edit-category-other-wrapper');
    const customInput = document.getElementById('edit-category-other');
    if (isStandardCategory) {
        document.getElementById('edit-category').value = expense.category;
        wrapper.classList.add('hidden');
        customInput.required = false;
        customInput.value = '';
    } else {
        document.getElementById('edit-category').value = 'Other';
        wrapper.classList.remove('hidden');
        customInput.required = true;
        customInput.value = expense.category;
    }
    
    document.getElementById('edit-date').value = expense.date;
    document.getElementById('edit-bank-mode').value = expense.bank_mode || '';
    document.getElementById('edit-payment-type').value = expense.payment_type || '';
    document.getElementById('edit-payment-category').value = expense.payment_category || '';
    if (document.getElementById('edit-payment-method')) {
        document.getElementById('edit-payment-method').value = expense.payment_method || 'Debit';
    }
    if (document.getElementById('edit-status')) {
        document.getElementById('edit-status').checked = (expense.status === 'Paid');
    }
    document.getElementById('edit-description').value = expense.description || '';
    
    // Populate interest amount and handle visibility wrapper
    const interestInput = document.getElementById('edit-interest');
    const interestWrapper = document.getElementById('edit-interest-wrapper');
    if (interestInput) {
        interestInput.value = parseFloat(expense.interest || 0).toFixed(2);
    }
    if (interestWrapper) {
        const isCredit = (expense.payment_method === 'Credit');
        if (isCredit) {
            interestWrapper.classList.remove('hidden');
        } else {
            interestWrapper.classList.add('hidden');
        }
    }
    const statusWrapper = document.getElementById('edit-status-wrapper');
    if (statusWrapper) {
        if (expense.payment_method === 'Debit' || !expense.payment_method) {
            statusWrapper.classList.remove('hidden');
        } else {
            statusWrapper.classList.add('hidden');
        }
    }
    
    document.querySelectorAll('#edit-expense-custom-fields .custom-expense-field').forEach(input => {
        const key = input.getAttribute('data-key');
        input.value = expense[key] || '';
    });
    
    applyConditionalFields('edit-expense');
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function loadCharts() {
    try {
        const monthVal = document.getElementById('overview-month') ? document.getElementById('overview-month').value : '';
        const yearVal = document.getElementById('overview-year') ? document.getElementById('overview-year').value : '';
        let query = '/api/overview';
        const params = [];
        if (monthVal) params.push(`month=${encodeURIComponent(monthVal)}`);
        if (yearVal) params.push(`year=${encodeURIComponent(yearVal)}`);
        if (params.length > 0) {
            query += '?' + params.join('&');
        }

        const response = await fetch(query);
        if (!response.ok) return;
        const data = await response.json();
        
        // Update Overview Credit/Debit/Interest totals reactively
        const formatter = getCurrencyFormatter(activeCurrencySymbol);
        const ovMonthDebit = document.getElementById('overview-month-debit');
        const ovMonthCredit = document.getElementById('overview-month-credit');
        const ovMonthInterest = document.getElementById('overview-month-interest');
        const ovTotalDebit = document.getElementById('overview-total-debit');
        const ovTotalCredit = document.getElementById('overview-total-credit');
        const ovTotalInterest = document.getElementById('overview-total-interest');
        
        if (ovMonthDebit) ovMonthDebit.textContent = formatter.format(data.month_debit || 0);
        if (ovMonthCredit) ovMonthCredit.textContent = formatter.format(data.month_credit || 0);
        if (ovMonthInterest) ovMonthInterest.textContent = formatter.format(data.month_interest || 0);
        if (ovTotalDebit) ovTotalDebit.textContent = formatter.format(data.total_debit || 0);
        if (ovTotalCredit) ovTotalCredit.textContent = formatter.format(data.total_credit || 0);
        if (ovTotalInterest) ovTotalInterest.textContent = formatter.format(data.total_interest || 0);
        
        // --- 1. Category Donut Chart ---
        const catLabels = data.categories.map(c => c.category);
        const catTotals = data.categories.map(c => c.total);
        
        // Destroy existing chart to rebuild cleanly
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        const catCtx = document.getElementById('categoryChart').getContext('2d');
        if (catLabels.length === 0) {
            // Draw empty state on canvas (handled by chart.js or fallback text)
            catCtx.clearRect(0, 0, 400, 400);
            catCtx.fillStyle = '#94a3b8';
            catCtx.textAlign = 'center';
            catCtx.fillText('No data available for this month', 200, 150);
        } else {
            categoryChartInstance = new Chart(catCtx, {
                type: 'doughnut',
                data: {
                    labels: catLabels,
                    datasets: [{
                        data: catTotals,
                        backgroundColor: [
                            'rgba(99, 102, 241, 0.75)',  // Indigo
                            'rgba(6, 182, 212, 0.75)',   // Cyan
                            'rgba(244, 63, 94, 0.75)',   // Rose
                            'rgba(16, 185, 129, 0.75)',  // Emerald
                            'rgba(168, 85, 247, 0.75)',  // Purple
                            'rgba(245, 158, 11, 0.75)',  // Amber
                            'rgba(59, 130, 246, 0.75)',   // Blue
                            'rgba(239, 68, 68, 0.75)',   // Red
                            'rgba(100, 116, 139, 0.75)'  // Slate
                        ],
                        borderColor: '#0f172a',
                        borderWidth: 2,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#f8fafc',
                                font: { family: 'Poppins', size: 11 },
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return ` ${context.label}: ${activeCurrencySymbol}${context.raw.toFixed(2)}`;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // --- 2. Trend Line Chart ---
        const trendLabels = data.trends.map(t => t.label);
        const trendTotals = data.trends.map(t => t.total);
        
        if (trendChartInstance) {
            trendChartInstance.destroy();
        }
        
        const trendCtx = document.getElementById('trendChart').getContext('2d');
        
        // Create gradients for lines
        const gradientStroke = trendCtx.createLinearGradient(0, 0, 0, 300);
        gradientStroke.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
        gradientStroke.addColorStop(1, 'rgba(6, 182, 212, 0.02)');
        
        trendChartInstance = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: trendLabels,
                datasets: [{
                    label: 'Monthly Spending',
                    data: trendTotals,
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    pointBackgroundColor: '#06b6d4',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 8,
                    pointRadius: 5,
                    fill: true,
                    backgroundColor: gradientStroke,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Spent: ${activeCurrencySymbol}${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#94a3b8', font: { family: 'Poppins', size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Poppins', size: 10 },
                            callback: function(value) {
                                return activeCurrencySymbol + value;
                            }
                        }
                    }
                }
            }
        });

    } catch (err) {
        console.error('Error generating overview charts:', err);
    }
}

// UTILITIES
function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    // Format YYYY-MM-DD to e.g. "Jun 25, 2026"
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return `${months[monthIndex]} ${day}, ${year}`;
}

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

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
            switchAdminTab('admin-excel-columns');
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
        if (targetTab === 'admin-excel-columns') {
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

    // Toggle inline add buttons based on admin privileges
    const inlineBtns = document.querySelectorAll('.inline-add-btn');
    inlineBtns.forEach(btn => {
        if (currentUserPrivileges && currentUserPrivileges.is_admin) {
            btn.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
        }
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
        adminFetchExcelColumns()
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
        // Add standard keys
        standardKeys[targetType].forEach(col => {
            options += `<option value="${col.key}">${escapeHTML(col.label)} (${col.key})</option>`;
        });
        // Add custom keys
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
                // If parent field is missing or not active, hide this dependent field
                const groupDiv = input.closest('.input-group') || input.parentElement;
                groupDiv.style.display = 'none';
                input.required = false;
            }
        }
    });
}

// ==========================================
// EMI MANAGEMENT SYSTEM
// ==========================================

// Global state for user EMIs
let userEMIs = [];

// Fetch bank modes to populate Payment Bank dropdowns
function populateEmiBankDropdowns() {
    const userBankSelect = document.getElementById('emi-payment-bank');
    const adminBankSelect = document.getElementById('admin-emi-payment-bank');
    if (!userBankSelect && !adminBankSelect) return;
    
    let optionsHtml = '<option value="" selected>None / N/A</option>';
    systemBankModes.forEach(bm => {
        optionsHtml += `<option value="${escapeHTML(bm.name)}">${escapeHTML(bm.name)}</option>`;
    });
    
    if (userBankSelect) userBankSelect.innerHTML = optionsHtml;
    if (adminBankSelect) adminBankSelect.innerHTML = optionsHtml;
}

// Fetch EMIs for logged-in user
async function fetchUserEMIs() {
    try {
        const response = await fetch('/api/emis');
        if (response.ok) {
            userEMIs = await response.json();
            renderUserEMIsTable(userEMIs);
            updateEmiSummaryCards(userEMIs);
            populateEmiBankDropdowns();
        }
    } catch (err) {
        console.error('Error fetching user EMIs:', err);
    }
}

function calculateEmiPendingDetails(emi) {
    const principal = parseFloat(emi.principal_amount || 0);
    const rate = parseFloat(emi.interest_rate || 0);
    const tenure = parseInt(emi.tenure_months) || 12;
    const emiAmount = parseFloat(emi.emi_amount);
    const r = rate / 12 / 100;
    
    let startDate = new Date(emi.start_date);
    if (isNaN(startDate.getTime())) {
        startDate = new Date();
    }
    
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    
    let monthsElapsed = (todayYear - startYear) * 12 + (todayMonth - startMonth);
    if (today < startDate) {
        monthsElapsed = 0;
    } else {
        const dueDay = parseInt(emi.due_date) || 1;
        if (today.getDate() < dueDay) {
            monthsElapsed = Math.max(0, monthsElapsed - 1);
        }
    }
    monthsElapsed = Math.min(Math.max(0, monthsElapsed), tenure);
    
    let currentBalance = principal;
    for (let i = 1; i <= monthsElapsed; i++) {
        let interestPaid = currentBalance * r;
        let principalPaid = emiAmount - interestPaid;
        if (principalPaid > currentBalance || i === tenure) {
            principalPaid = currentBalance;
        }
        currentBalance -= principalPaid;
        if (currentBalance < 0) currentBalance = 0;
    }
    
    const pendingMonths = tenure - monthsElapsed;
    return {
        pendingMonths: pendingMonths,
        pendingPrincipal: currentBalance
    };
}

// Render user EMIs table
function renderUserEMIsTable(emis) {
    const tbody = document.getElementById('user-emi-list');
    const noEmisMsg = document.getElementById('no-emis-msg');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (emis.length === 0) {
        if (noEmisMsg) noEmisMsg.classList.remove('hidden');
        return;
    }
    if (noEmisMsg) noEmisMsg.classList.add('hidden');

    const canEdit = currentUserPrivileges.can_edit;
    const canDelete = currentUserPrivileges.can_delete;

    emis.forEach(emi => {
        const tr = document.createElement('tr');
        
        let actionsHtml = '';
        actionsHtml += `
            <button class="btn-icon btn-icon-info" onclick="openEmiCalendar(${emi.id}, false)" title="View EMI Calendar Schedule" style="color: var(--color-success);">
                <i class="fa-solid fa-circle-info"></i>
            </button>`;
        if (canEdit) {
            actionsHtml += `
                <button class="btn-icon btn-icon-edit" onclick="openEmiModal(${emi.id})" title="Edit EMI" style="color: var(--color-primary);">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>`;
        }
        if (canDelete) {
            actionsHtml += `
                <button class="btn-icon btn-icon-delete" onclick="deleteUserEmi(${emi.id}, '${escapeHTML(emi.name)}')" title="Delete EMI">
                    <i class="fa-solid fa-trash-can"></i>
                </button>`;
        }

        const gatewayBank = [emi.payment_gateway, emi.payment_bank].filter(Boolean).join(' / ') || 'None';
        const pending = calculateEmiPendingDetails(emi);

        tr.innerHTML = `
            <td><span style="font-weight: 500;">${escapeHTML(emi.name)}</span></td>
            <td class="text-right">${activeCurrencySymbol}${parseFloat(emi.principal_amount || 0).toFixed(2)}</td>
            <td class="text-right" style="font-weight: 600; color: var(--color-secondary);">${activeCurrencySymbol}${parseFloat(emi.emi_amount).toFixed(2)}</td>
            <td class="text-center">${escapeHTML(emi.start_date)}</td>
            <td class="text-center">${escapeHTML(emi.end_date)}</td>
            <td class="text-center">${emi.tenure_months} months</td>
            <td class="text-center" style="font-weight: 500; color: var(--color-accent);">${pending.pendingMonths} months</td>
            <td class="text-right" style="font-weight: 500; color: var(--color-secondary);">${activeCurrencySymbol}${pending.pendingPrincipal.toFixed(2)}</td>
            <td class="text-center">${parseFloat(emi.interest_rate || 0).toFixed(2)}%</td>
            <td class="text-center">${escapeHTML(emi.due_date)}</td>
            <td class="text-center"><span class="role-badge ${emi.payment_type === 'Auto' ? 'badge-admin' : 'badge-user'}">${escapeHTML(emi.payment_type)}</span></td>
            <td>${escapeHTML(gatewayBank)}</td>
            <td class="actions-cell">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Update EMI summary cards
function updateEmiSummaryCards(emis) {
    window.currentEmiDetails = [];

    let totalLoanAmount = 0;
    let totalPendingPrincipal = 0;
    let totalPrincipalPaid = 0;
    let totalInterest = 0;
    let totalPaidInterest = 0;
    let totalMonthlyEmi = 0;

    emis.forEach(emi => {
        const principal = parseFloat(emi.principal_amount || 0);
        const rate = parseFloat(emi.interest_rate || 0);
        const tenure = parseInt(emi.tenure_months) || 12;
        const emiAmount = parseFloat(emi.emi_amount || 0);
        const r = rate / 12 / 100;

        let startDate = new Date(emi.start_date);
        if (isNaN(startDate.getTime())) {
            startDate = new Date();
        }

        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();

        let monthsElapsed = (todayYear - startYear) * 12 + (todayMonth - startMonth);
        if (today < startDate) {
            monthsElapsed = 0;
        } else {
            const dueDay = parseInt(emi.due_date) || 1;
            if (today.getDate() < dueDay) {
                monthsElapsed = Math.max(0, monthsElapsed - 1);
            }
        }
        monthsElapsed = Math.min(Math.max(0, monthsElapsed), tenure);

        // Calculate pending balance and paid interest
        let currentBalance = principal;
        let interestPaidSoFar = 0;
        for (let i = 1; i <= monthsElapsed; i++) {
            let interestPaid = currentBalance * r;
            let principalPaid = emiAmount - interestPaid;
            if (principalPaid > currentBalance || i === tenure) {
                principalPaid = currentBalance;
            }
            interestPaidSoFar += interestPaid;
            currentBalance -= principalPaid;
            if (currentBalance < 0) currentBalance = 0;
        }

        const calculatedTotalInterest = Math.max(0, (emiAmount * tenure) - principal);
        const calculatedPaidInterest = Math.min(interestPaidSoFar, calculatedTotalInterest);

        totalLoanAmount += principal;
        totalPendingPrincipal += currentBalance;
        totalPrincipalPaid += (principal - currentBalance);
        totalInterest += calculatedTotalInterest;
        totalPaidInterest += calculatedPaidInterest;
        
        const isCurrentActive = monthsElapsed < tenure;
        if (isCurrentActive) {
            totalMonthlyEmi += emiAmount;
        }

        window.currentEmiDetails.push({
            name: emi.name,
            principal: principal,
            pendingPrincipal: currentBalance,
            principalPaid: principal - currentBalance,
            totalInterest: calculatedTotalInterest,
            paidInterest: calculatedPaidInterest,
            monthlyEmi: isCurrentActive ? emiAmount : 0,
            tenure: tenure,
            monthsElapsed: monthsElapsed,
            due_date: emi.due_date
        });
    });

    // Populate UI elements
    const totalLoanEl = document.getElementById('emi-total-loan-amount');
    const pendingPrincipalEl = document.getElementById('emi-pending-principal');
    const principalPaidEl = document.getElementById('emi-total-principal-paid');
    const totalInterestEl = document.getElementById('emi-total-interest');
    const paidInterestEl = document.getElementById('emi-paid-interest');
    const monthlyTotalEl = document.getElementById('emi-monthly-total');

    if (totalLoanEl) totalLoanEl.textContent = `${activeCurrencySymbol}${totalLoanAmount.toFixed(2)}`;
    if (pendingPrincipalEl) pendingPrincipalEl.textContent = `${activeCurrencySymbol}${totalPendingPrincipal.toFixed(2)}`;
    if (principalPaidEl) principalPaidEl.textContent = `${activeCurrencySymbol}${totalPrincipalPaid.toFixed(2)}`;
    if (totalInterestEl) totalInterestEl.textContent = `${activeCurrencySymbol}${totalInterest.toFixed(2)}`;
    if (paidInterestEl) paidInterestEl.textContent = `${activeCurrencySymbol}${totalPaidInterest.toFixed(2)}`;
    if (monthlyTotalEl) monthlyTotalEl.textContent = `${activeCurrencySymbol}${totalMonthlyEmi.toFixed(2)}`;
}

// Show specific EMI Details popup matching the clicked Overview category
function showEmiOverviewDetails(type) {
    const modal = document.getElementById('emi-overview-details-modal');
    const titleEl = document.getElementById('emi-overview-details-title');
    const headersEl = document.getElementById('emi-overview-details-headers');
    const listEl = document.getElementById('emi-overview-details-list');

    if (!modal || !titleEl || !headersEl || !listEl) return;

    if (!window.currentEmiDetails || window.currentEmiDetails.length === 0) {
        showAppAlert('No EMI data available.');
        return;
    }

    let titleText = '';
    let headerHtml = '';
    let rowsHtml = '';
    let totalSum = 0;

    switch (type) {
        case 'total-loan':
            titleText = 'EMI Details: Total Loan Amount';
            headerHtml = `
                <tr>
                    <th>EMI Name</th>
                    <th class="text-right">Loan Amount</th>
                    <th class="text-center">Tenure (Months)</th>
                    <th class="text-center">Elapsed</th>
                </tr>
            `;
            window.currentEmiDetails.forEach(item => {
                totalSum += item.principal;
                rowsHtml += `
                    <tr>
                        <td><span style="font-weight: 500;">${escapeHTML(item.name)}</span></td>
                        <td class="text-right">${activeCurrencySymbol}${item.principal.toFixed(2)}</td>
                        <td class="text-center">${item.tenure}</td>
                        <td class="text-center">${item.monthsElapsed} / ${item.tenure}</td>
                    </tr>
                `;
            });
            break;
        case 'pending-principal':
            titleText = 'EMI Details: Pending Principal';
            headerHtml = `
                <tr>
                    <th>EMI Name</th>
                    <th class="text-right">Pending Principal</th>
                    <th class="text-right">Total Principal</th>
                    <th class="text-center">Progress</th>
                </tr>
            `;
            window.currentEmiDetails.forEach(item => {
                totalSum += item.pendingPrincipal;
                const progressPct = item.tenure > 0 ? ((item.monthsElapsed / item.tenure) * 100).toFixed(0) : '0';
                rowsHtml += `
                    <tr>
                        <td><span style="font-weight: 500;">${escapeHTML(item.name)}</span></td>
                        <td class="text-right" style="color: var(--color-secondary);">${activeCurrencySymbol}${item.pendingPrincipal.toFixed(2)}</td>
                        <td class="text-right">${activeCurrencySymbol}${item.principal.toFixed(2)}</td>
                        <td class="text-center">${progressPct}%</td>
                    </tr>
                `;
            });
            break;
        case 'principal-paid':
            titleText = 'EMI Details: Total Principal Paid';
            headerHtml = `
                <tr>
                    <th>EMI Name</th>
                    <th class="text-right">Principal Paid</th>
                    <th class="text-right">Total Principal</th>
                    <th class="text-center">Progress</th>
                </tr>
            `;
            window.currentEmiDetails.forEach(item => {
                totalSum += item.principalPaid;
                const progressPct = item.tenure > 0 ? ((item.monthsElapsed / item.tenure) * 100).toFixed(0) : '0';
                rowsHtml += `
                    <tr>
                        <td><span style="font-weight: 500;">${escapeHTML(item.name)}</span></td>
                        <td class="text-right" style="color: var(--color-success);">${activeCurrencySymbol}${item.principalPaid.toFixed(2)}</td>
                        <td class="text-right">${activeCurrencySymbol}${item.principal.toFixed(2)}</td>
                        <td class="text-center">${progressPct}%</td>
                    </tr>
                `;
            });
            break;
        case 'total-interest':
            titleText = 'EMI Details: Total Interest';
            headerHtml = `
                <tr>
                    <th>EMI Name</th>
                    <th class="text-right">Total Interest</th>
                    <th class="text-right">Principal</th>
                    <th class="text-center">Tenure (Months)</th>
                </tr>
            `;
            window.currentEmiDetails.forEach(item => {
                totalSum += item.totalInterest;
                rowsHtml += `
                    <tr>
                        <td><span style="font-weight: 500;">${escapeHTML(item.name)}</span></td>
                        <td class="text-right" style="color: #f59e0b;">${activeCurrencySymbol}${item.totalInterest.toFixed(2)}</td>
                        <td class="text-right">${activeCurrencySymbol}${item.principal.toFixed(2)}</td>
                        <td class="text-center">${item.tenure}</td>
                    </tr>
                `;
            });
            break;
        case 'paid-interest':
            titleText = 'EMI Details: Paid Interest';
            headerHtml = `
                <tr>
                    <th>EMI Name</th>
                    <th class="text-right">Paid Interest</th>
                    <th class="text-right">Total Interest</th>
                    <th class="text-center">Elapsed</th>
                </tr>
            `;
            window.currentEmiDetails.forEach(item => {
                totalSum += item.paidInterest;
                rowsHtml += `
                    <tr>
                        <td><span style="font-weight: 500;">${escapeHTML(item.name)}</span></td>
                        <td class="text-right" style="color: #3b82f6;">${activeCurrencySymbol}${item.paidInterest.toFixed(2)}</td>
                        <td class="text-right">${activeCurrencySymbol}${item.totalInterest.toFixed(2)}</td>
                        <td class="text-center">${item.monthsElapsed} / ${item.tenure}</td>
                    </tr>
                `;
            });
            break;
        case 'monthly-total':
            titleText = 'EMI Details: Monthly Total EMI';
            headerHtml = `
                <tr>
                    <th>EMI Name</th>
                    <th class="text-right">Monthly EMI</th>
                    <th class="text-center">Due Day</th>
                    <th class="text-center">Status</th>
                </tr>
            `;
            window.currentEmiDetails.forEach(item => {
                totalSum += item.monthlyEmi;
                const statusHtml = item.monthsElapsed < item.tenure
                    ? `<span class="badge badge-admin">Active</span>`
                    : `<span class="badge badge-viewer">Completed</span>`;
                rowsHtml += `
                    <tr>
                        <td><span style="font-weight: 500;">${escapeHTML(item.name)}</span></td>
                        <td class="text-right" style="color: #a78bfa;">${activeCurrencySymbol}${item.monthlyEmi.toFixed(2)}</td>
                        <td class="text-center">${item.due_date || 1}</td>
                        <td class="text-center">${statusHtml}</td>
                    </tr>
                `;
            });
            break;
    }

    // Add total row at the bottom
    rowsHtml += `
        <tr style="border-top: 2px solid var(--border-color); font-weight: bold; background: rgba(255,255,255,0.02);">
            <td>Total Sum</td>
            <td class="text-right" style="font-size: 1rem;">${activeCurrencySymbol}${totalSum.toFixed(2)}</td>
            <td></td>
            <td></td>
        </tr>
    `;

    titleEl.textContent = titleText;
    headersEl.innerHTML = headerHtml;
    listEl.innerHTML = rowsHtml;

    modal.classList.remove('hidden');
}

function closeEmiOverviewDetailsModal() {
    const modal = document.getElementById('emi-overview-details-modal');
    if (modal) modal.classList.add('hidden');
}

// Open/Close User EMI Modal
function openEmiModal(emiId = null) {
    const modal = document.getElementById('emi-modal');
    if (!modal) return;
    
    // Populate dynamic banks
    populateEmiBankDropdowns();
    
    if (emiId) {
        document.getElementById('emi-modal-title').textContent = 'Edit EMI';
        const emi = userEMIs.find(e => e.id === emiId);
        if (emi) {
            document.getElementById('emi-id').value = emi.id;
            document.getElementById('emi-name').value = emi.name;
            document.getElementById('emi-principal').value = emi.principal_amount;
            document.getElementById('emi-interest-rate').value = emi.interest_rate;
            document.getElementById('emi-tenure').value = emi.tenure_months;
            document.getElementById('emi-amount').value = emi.emi_amount;
            document.getElementById('emi-start-date').value = emi.start_date;
            document.getElementById('emi-end-date').value = emi.end_date;
            document.getElementById('emi-due-date').value = emi.due_date;
            document.getElementById('emi-payment-type').value = emi.payment_type;
            document.getElementById('emi-payment-gateway').value = emi.payment_gateway || '';
            document.getElementById('emi-payment-bank').value = emi.payment_bank || '';
            
            document.querySelectorAll('#emi-custom-fields .custom-emi-field').forEach(input => {
                const key = input.getAttribute('data-key');
                input.value = emi[key] || '';
            });
        }
    } else {
        document.getElementById('emi-modal-title').textContent = 'Add EMI';
        document.getElementById('emi-form').reset();
        document.querySelectorAll('#emi-custom-fields .custom-emi-field').forEach(input => {
            input.value = '';
        });
        document.getElementById('emi-id').value = '';
        document.getElementById('emi-start-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('emi-end-date').value = calculateEndDate(new Date().toISOString().split('T')[0], 12);
    }
    
    modal.classList.remove('hidden');
}

function closeEmiModal() {
    const modal = document.getElementById('emi-modal');
    if (modal) modal.classList.add('hidden');
}

// Submit User EMI Form
async function handleEmiSubmit(e) {
    e.preventDefault();
    const emiId = document.getElementById('emi-id').value;
    const name = document.getElementById('emi-name').value;
    const principal_amount = parseFloat(document.getElementById('emi-principal').value) || 0.0;
    const interest_rate = parseFloat(document.getElementById('emi-interest-rate').value) || 0.0;
    const tenure_months = parseInt(document.getElementById('emi-tenure').value) || 12;
    const emi_amount = parseFloat(document.getElementById('emi-amount').value) || 0.0;
    const start_date = document.getElementById('emi-start-date').value;
    const end_date = document.getElementById('emi-end-date').value;
    const due_date = document.getElementById('emi-due-date').value;
    const payment_type = document.getElementById('emi-payment-type').value;
    const payment_gateway = document.getElementById('emi-payment-gateway').value;
    const payment_bank = document.getElementById('emi-payment-bank').value;

    const payload = {
        name, principal_amount, interest_rate, tenure_months, emi_amount, start_date, end_date, due_date, payment_type, payment_gateway, payment_bank
    };
    
    document.querySelectorAll('#emi-custom-fields .custom-emi-field').forEach(input => {
        payload[input.getAttribute('data-key')] = input.value;
    });

    const url = emiId ? `/api/emis/edit/${emiId}` : '/api/emis/add';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok && (result.success || result.message)) {
            showAppAlert(result.message || 'EMI saved successfully!', true);
            closeEmiModal();
            await fetchUserEMIs();
        } else {
            showAppAlert(result.error || 'Failed to save EMI.');
        }
    } catch (err) {
        showAppAlert('Network error saving EMI.');
    }
}

// Delete User EMI
async function deleteUserEmi(emiId, name) {
    if (!confirm(`Are you sure you want to delete EMI "${name}"?`)) return;
    try {
        const response = await fetch(`/api/emis/delete/${emiId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('EMI deleted successfully.', true);
            await fetchUserEMIs();
        } else {
            showAppAlert(result.error || 'Failed to delete EMI.');
        }
    } catch (err) {
        showAppAlert('Network error deleting EMI.');
    }
}

// ==========================================
// ADMIN EMI CONTROLS
// ==========================================

let adminEMIsList = [];

// Fetch EMIs for Admin panel
async function adminFetchEMIs() {
    try {
        const response = await fetch('/api/admin/emis');
        if (response.ok) {
            adminEMIsList = await response.json();
            renderAdminEMIsTable(adminEMIsList);
            populateAdminUserDropdown();
            populateEmiBankDropdowns();
        }
    } catch (err) {
        console.error('Error fetching admin EMIs:', err);
    }
}

// Populate users dropdown in Admin EMI Form
function populateAdminUserDropdown() {
    const select = document.getElementById('admin-emi-user');
    if (!select) return;
    
    fetch('/api/admin/users')
        .then(res => res.json())
        .then(users => {
            let options = '<option value="" disabled selected>Select User</option>';
            users.forEach(u => {
                options += `<option value="${u.id}">${escapeHTML(u.username)}</option>`;
            });
            select.innerHTML = options;
        })
        .catch(err => console.error('Error populating users dropdown:', err));
}

// Render Admin EMIs Table
function renderAdminEMIsTable(emis) {
    const tbody = document.getElementById('admin-emis-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    emis.forEach(emi => {
        const tr = document.createElement('tr');
        const gatewayBank = [emi.payment_gateway, emi.payment_bank].filter(Boolean).join(' / ') || 'None';
        
        let actionsHtml = '';
        actionsHtml += `
            <button class="btn-icon btn-icon-info" onclick="openEmiCalendar(${emi.id}, true)" title="View EMI Calendar Schedule" style="color: var(--color-success);">
                <i class="fa-solid fa-circle-info"></i>
            </button>`;
        actionsHtml += `
            <button class="btn-icon btn-icon-edit" onclick="adminEditEmi(${emi.id})" title="Edit EMI" style="color: var(--color-primary);">
                <i class="fa-solid fa-pen-to-square"></i>
            </button>`;
        actionsHtml += `
            <button class="btn-icon btn-icon-delete" onclick="adminDeleteEmi(${emi.id}, '${escapeHTML(emi.name)}')" title="Delete EMI">
                <i class="fa-solid fa-trash-can"></i>
            </button>`;

        tr.innerHTML = `
            <td><strong style="color: var(--color-accent);">${escapeHTML(emi.username)}</strong></td>
            <td><span style="font-weight: 500;">${escapeHTML(emi.name)}</span></td>
            <td class="text-right" style="font-weight: 600; color: var(--color-secondary);">${activeCurrencySymbol}${parseFloat(emi.emi_amount).toFixed(2)}</td>
            <td class="text-center">${escapeHTML(emi.due_date)}</td>
            <td><span class="role-badge ${emi.payment_type === 'Auto' ? 'badge-admin' : 'badge-user'}">${escapeHTML(emi.payment_type)}</span></td>
            <td>${escapeHTML(gatewayBank)}</td>
            <td class="actions-cell">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Admin Edit EMI (Populate form)
function adminEditEmi(emiId) {
    const emi = adminEMIsList.find(e => e.id === emiId);
    if (!emi) return;
    
    document.getElementById('admin-emi-id').value = emi.id;
    document.getElementById('admin-emi-user').value = emi.user_id;

    document.getElementById('admin-emi-name').value = emi.name;
    document.getElementById('admin-emi-principal').value = emi.principal_amount;
    document.getElementById('admin-emi-interest-rate').value = emi.interest_rate;
    document.getElementById('admin-emi-tenure').value = emi.tenure_months;
    document.getElementById('admin-emi-amount').value = emi.emi_amount;
    document.getElementById('admin-emi-start-date').value = emi.start_date;
    document.getElementById('admin-emi-end-date').value = emi.end_date;
    document.getElementById('admin-emi-due-date').value = emi.due_date;
    document.getElementById('admin-emi-payment-type').value = emi.payment_type;
    document.getElementById('admin-emi-payment-gateway').value = emi.payment_gateway || '';
    document.getElementById('admin-emi-payment-bank').value = emi.payment_bank || '';
    
    document.querySelectorAll('#admin-emi-custom-fields .custom-emi-field').forEach(input => {
        const key = input.getAttribute('data-key');
        input.value = emi[key] || '';
    });
    
    applyConditionalFields('admin-emi');
    const modal = document.getElementById('admin-emi-modal');
    if (modal) modal.classList.remove('hidden');
}

// Reset Admin EMI Form
function resetAdminEmiForm() {
    const form = document.getElementById('admin-emi-form');
    if (form) form.reset();
    const idInput = document.getElementById('admin-emi-id');
    if (idInput) idInput.value = '';
    document.querySelectorAll('#admin-emi-custom-fields .custom-emi-field').forEach(input => {
        input.value = '';
    });
}

function closeAdminEmiModal() {
    const modal = document.getElementById('admin-emi-modal');
    if (modal) modal.classList.add('hidden');
    resetAdminEmiForm();
}

// Submit Admin EMI Form
async function handleAdminEmiSubmit(e) {
    e.preventDefault();
    const emiId = document.getElementById('admin-emi-id').value;
    const user_id = document.getElementById('admin-emi-user').value;
    const name = document.getElementById('admin-emi-name').value;
    const principal_amount = parseFloat(document.getElementById('admin-emi-principal').value) || 0.0;
    const interest_rate = parseFloat(document.getElementById('admin-emi-interest-rate').value) || 0.0;
    const tenure_months = parseInt(document.getElementById('admin-emi-tenure').value) || 12;
    const emi_amount = parseFloat(document.getElementById('admin-emi-amount').value) || 0.0;
    const start_date = document.getElementById('admin-emi-start-date').value;
    const end_date = document.getElementById('admin-emi-end-date').value;
    const due_date = document.getElementById('admin-emi-due-date').value;
    const payment_type = document.getElementById('admin-emi-payment-type').value;
    const payment_gateway = document.getElementById('admin-emi-payment-gateway').value;
    const payment_bank = document.getElementById('admin-emi-payment-bank').value;

    const payload = {
        user_id, name, principal_amount, interest_rate, tenure_months, emi_amount, start_date, end_date, due_date, payment_type, payment_gateway, payment_bank
    };
    
    document.querySelectorAll('#admin-emi-custom-fields .custom-emi-field').forEach(input => {
        payload[input.getAttribute('data-key')] = input.value;
    });

    const url = emiId ? `/api/admin/emis/edit/${emiId}` : '/api/admin/emis/create';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok && (result.success || result.message)) {
            showAppAlert(result.message || 'EMI saved successfully!', true);
            closeAdminEmiModal();
            await adminFetchEMIs();
        } else {
            showAppAlert(result.error || 'Failed to save EMI.');
        }
    } catch (err) {
        showAppAlert('Network error saving EMI.');
    }
}

// Delete Admin EMI
async function adminDeleteEmi(emiId, name) {
    if (!confirm(`Are you sure you want to delete EMI "${name}"?`)) return;
    try {
        const response = await fetch(`/api/admin/emis/delete/${emiId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('EMI deleted successfully.', true);
            await adminFetchEMIs();
        } else {
            showAppAlert(result.error || 'Failed to delete EMI.');
        }
    } catch (err) {
        showAppAlert('Network error deleting EMI.');
    }
}

// Math Calculators
function calculateEMI(principal, annualRate, tenureMonths) {
    if (!principal || !tenureMonths) return 0;
    const r = annualRate / 12 / 100;
    if (r === 0) return principal / tenureMonths;
    const emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
    return emi;
}

function calculateEndDate(startDateStr, months) {
    if (!startDateStr || !months) return '';
    const date = new Date(startDateStr);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
}

// EMI Actions and Calendars

function toggleEmiOverview() {
    const grid = document.getElementById('emi-metrics-grid');
    if (grid) {
        grid.classList.toggle('hidden');
    }
}

function openEmiImportModal() {
    const modal = document.getElementById('emi-import-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEmiImportModal() {
    const modal = document.getElementById('emi-import-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleEmiImportSubmit(e) {
    e.preventDefault();
    const fileInput = document.getElementById('emi-import-file');
    if (!fileInput || fileInput.files.length === 0) {
        showAppAlert('Please select a file.');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch('/api/emis/import', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert(result.message, true);
            closeEmiImportModal();
            await fetchUserEMIs();
        } else {
            showAppAlert(result.error || 'Failed to import EMIs.');
        }
    } catch (err) {
        showAppAlert('Network error importing EMIs.');
    }
}

function openAdminEmiImportModal() {
    const modal = document.getElementById('admin-emi-import-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAdminEmiImportModal() {
    const modal = document.getElementById('admin-emi-import-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleAdminEmiImportSubmit(e) {
    e.preventDefault();
    const fileInput = document.getElementById('admin-emi-import-file');
    if (!fileInput || fileInput.files.length === 0) {
        showAppAlert('Please select a file.');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch('/api/admin/emis/import', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert(result.message, true);
            closeAdminEmiImportModal();
            await adminFetchEMIs();
        } else {
            showAppAlert(result.error || 'Failed to import EMIs.');
        }
    } catch (err) {
        showAppAlert('Network error importing EMIs.');
    }
}

function exportUserEMIs() {
    window.location.href = '/api/emis/export';
}

function exportAdminEMIs() {
    window.location.href = '/api/admin/emis/export';
}

function openEmiCalendar(emiId, isAdminView = false) {
    const emi = isAdminView 
        ? adminEMIsList.find(e => e.id === emiId)
        : userEMIs.find(e => e.id === emiId);
    if (!emi) return;

    document.getElementById('cal-emi-name').textContent = emi.name;
    document.getElementById('cal-emi-principal').textContent = `${activeCurrencySymbol}${parseFloat(emi.principal_amount || 0).toFixed(2)}`;
    document.getElementById('cal-emi-interest').textContent = `${parseFloat(emi.interest_rate || 0).toFixed(2)}%`;
    document.getElementById('cal-emi-amount').textContent = `${activeCurrencySymbol}${parseFloat(emi.emi_amount).toFixed(2)}`;

    const tbody = document.getElementById('emi-calendar-tbody');
    tbody.innerHTML = '';

    let principal = parseFloat(emi.principal_amount || 0);
    const rate = parseFloat(emi.interest_rate || 0);
    const tenure = parseInt(emi.tenure_months) || 12;
    const emiAmount = parseFloat(emi.emi_amount);
    const r = rate / 12 / 100;

    let currentBalance = principal;
    let startDate = new Date(emi.start_date);
    if (isNaN(startDate.getTime())) {
        startDate = new Date();
    }

    for (let i = 1; i <= tenure; i++) {
        let interestPaid = currentBalance * r;
        let principalPaid = emiAmount - interestPaid;

        if (principalPaid > currentBalance || i === tenure) {
            principalPaid = currentBalance;
            interestPaid = Math.max(0, emiAmount - principalPaid);
        }

        currentBalance -= principalPaid;
        if (currentBalance < 0) currentBalance = 0;

        const pDate = new Date(startDate);
        pDate.setMonth(pDate.getMonth() + (i - 1));
        
        const dueDay = parseInt(emi.due_date);
        if (!isNaN(dueDay) && dueDay > 0 && dueDay <= 31) {
            pDate.setDate(dueDay);
        }
        const dateStr = pDate.toISOString().split('T')[0];

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${i}</td>
            <td class="text-center">${dateStr}</td>
            <td class="text-right">${activeCurrencySymbol}${principalPaid.toFixed(2)}</td>
            <td class="text-right">${activeCurrencySymbol}${interestPaid.toFixed(2)}</td>
            <td class="text-right" style="font-weight: 500; color: var(--color-secondary);">${activeCurrencySymbol}${emiAmount.toFixed(2)}</td>
            <td class="text-right">${activeCurrencySymbol}${currentBalance.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    }

    const modal = document.getElementById('emi-calendar-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEmiCalendarModal() {
    const modal = document.getElementById('emi-calendar-modal');
    if (modal) modal.classList.add('hidden');
}

// CURRENCIES MANAGEMENT FUNCTIONS

async function fetchActiveCurrency() {
    try {
        const response = await fetch('/api/active-currency');
        if (response.ok) {
            const data = await response.json();
            activeCurrencySymbol = data.symbol || '₹';
            
            const addAmtLabel = document.querySelector('label[for="add-amount"]');
            if (addAmtLabel) addAmtLabel.innerHTML = `Amount (${activeCurrencySymbol}) <span class="required">*</span>`;
            const addIntLabel = document.querySelector('label[for="add-interest"]');
            if (addIntLabel) addIntLabel.textContent = `Interest (${activeCurrencySymbol})`;
            
            const editAmtLabel = document.querySelector('label[for="edit-amount"]');
            if (editAmtLabel) editAmtLabel.innerHTML = `Amount (${activeCurrencySymbol}) <span class="required">*</span>`;
            const editIntLabel = document.querySelector('label[for="edit-interest"]');
            if (editIntLabel) editIntLabel.textContent = `Interest (${activeCurrencySymbol})`;
        }
    } catch (err) {
        console.error('Error fetching active currency:', err);
    }
}

function getCurrencyFormatter(symbol) {
    let locale = 'en-US';
    let currency = 'USD';
    if (symbol === '₹') {
        locale = 'en-IN';
        currency = 'INR';
    } else if (symbol === '€') {
        locale = 'en-DE';
        currency = 'EUR';
    } else if (symbol === '£') {
        locale = 'en-GB';
        currency = 'GBP';
    } else if (symbol === '¥') {
        locale = 'ja-JP';
        currency = 'JPY';
    } else {
        return {
            format: (value) => `${symbol}${parseFloat(value).toFixed(2)}`
        };
    }
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency });
}

async function adminFetchCurrencies() {
    try {
        const response = await fetch('/api/admin/currencies');
        if (response.ok) {
            adminCurrenciesLocal = await response.json();
            adminRenderCurrenciesTable(adminCurrenciesLocal);
        }
    } catch (err) {
        console.error('Error fetching admin currencies:', err);
    }
}

function adminRenderCurrenciesTable(currencies) {
    const tbody = document.getElementById('admin-currencies-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    currencies.forEach(curr => {
        const tr = document.createElement('tr');
        const checked = curr.is_active ? 'checked' : '';
        
        let actionsHtml = `
            <button class="btn-icon btn-icon-edit" onclick="adminEditCurrency(${curr.id})" title="Edit Currency" style="color: var(--color-primary);">
                <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon btn-icon-delete" onclick="adminDeleteCurrency(${curr.id}, '${escapeHTML(curr.country)}')" title="Delete Currency">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        
        tr.innerHTML = `
            <td><strong>${escapeHTML(curr.country)}</strong></td>
            <td>${escapeHTML(curr.country_desc)}</td>
            <td class="text-center"><span style="font-weight: 600; color: var(--color-accent); font-size: 1.1rem;">${escapeHTML(curr.symbol)}</span></td>
            <td class="text-center">
                <input type="radio" name="active_currency_radio" ${checked} onchange="adminSetActiveCurrency(${curr.id})">
            </td>
            <td class="actions-cell">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function adminSaveCurrency(e) {
    e.preventDefault();
    const currId = document.getElementById('admin-currency-id').value;
    const country = document.getElementById('admin-currency-country').value.trim();
    const countryDesc = document.getElementById('admin-currency-desc').value.trim();
    const symbol = document.getElementById('admin-currency-symbol').value.trim();
    
    if (!country || !countryDesc || !symbol) {
        showAppAlert('Please fill out all fields.');
        return;
    }
    
    const payload = { country, country_desc: countryDesc, symbol };
    const url = currId ? `/api/admin/currencies/edit/${currId}` : '/api/admin/currencies/add';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert(result.message || 'Currency saved successfully!', true);
            resetCurrencyForm();
            await adminFetchCurrencies();
            if (currId) {
                const activeCurr = adminCurrenciesLocal.find(c => c.id == currId);
                if (activeCurr && activeCurr.is_active) {
                    await fetchActiveCurrency();
                    await fetchExpenses();
                    await updateOverviewStats();
                }
            }
        } else {
            showAppAlert(result.error || 'Failed to save currency.');
        }
    } catch (err) {
        showAppAlert('Network error saving currency.');
    }
}

function adminEditCurrency(id) {
    const curr = adminCurrenciesLocal.find(c => c.id === id);
    if (!curr) return;
    
    document.getElementById('admin-currency-id').value = curr.id;
    document.getElementById('admin-currency-country').value = curr.country;
    document.getElementById('admin-currency-desc').value = curr.country_desc;
    document.getElementById('admin-currency-symbol').value = curr.symbol;
    
    document.getElementById('admin-currency-form-title').textContent = 'Edit Currency';
    document.getElementById('admin-currency-submit-btn').textContent = 'Update Currency';
    document.getElementById('admin-currency-cancel-btn').classList.remove('hidden');
}

async function adminSetActiveCurrency(id) {
    try {
        const response = await fetch(`/api/admin/currencies/set_active/${id}`, {
            method: 'POST'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Active currency updated successfully!', true);
            await fetchActiveCurrency();
            await adminFetchCurrencies();
            await fetchExpenses();
            await updateOverviewStats();
            if (typeof fetchUserEMIs === 'function') await fetchUserEMIs();
            if (typeof adminFetchEMIs === 'function') await adminFetchEMIs();
        } else {
            showAppAlert(result.error || 'Failed to update active currency.');
        }
    } catch (err) {
        showAppAlert('Network error updating active currency.');
    }
}

async function adminDeleteCurrency(id, country) {
    if (!confirm(`Are you sure you want to delete the currency configuration for "${country}"?`)) return;
    try {
        const response = await fetch(`/api/admin/currencies/delete/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Currency configuration deleted.', true);
            resetCurrencyForm();
            await fetchActiveCurrency();
            await adminFetchCurrencies();
            await fetchExpenses();
            await updateOverviewStats();
        } else {
            showAppAlert(result.error || 'Failed to delete currency.');
        }
    } catch (err) {
        showAppAlert('Network error deleting currency.');
    }
}

function resetCurrencyForm() {
    document.getElementById('admin-currency-id').value = '';
    document.getElementById('admin-currency-form').reset();
    document.getElementById('admin-currency-form-title').textContent = 'Add Currency';
    document.getElementById('admin-currency-submit-btn').textContent = 'Add Currency';
    document.getElementById('admin-currency-cancel-btn').classList.add('hidden');
}

// OVERVIEW CALCULATION DETAILS MODAL

async function showOverviewDetails(metricType) {
    let query = '/api/expenses?';
    let title = '';
    let formula = '';
    
    const currentDate = new Date();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentYear = String(currentDate.getFullYear());
    
    if (metricType === 'month-debits') {
        query += `month=${currentMonth}&year=${currentYear}&payment_method=Debit`;
        title = 'Month Debits Calculation Details';
        formula = 'Sum of all Debit expenses in current month';
    } else if (metricType === 'month-credits') {
        query += `month=${currentMonth}&year=${currentYear}&payment_method=Credit`;
        title = 'Month Credits Calculation Details';
        formula = 'Sum of all Credit gains in current month';
    } else if (metricType === 'month-interest') {
        query += `month=${currentMonth}&year=${currentYear}`;
        title = 'Month Interest Calculation Details';
        formula = 'Sum of all interest charges in current month';
    } else if (metricType === 'total-debits') {
        query += `payment_method=Debit`;
        title = 'Total Debits Calculation Details';
        formula = 'Sum of all Debit expenses in lifetime';
    } else if (metricType === 'total-credits') {
        query += `payment_method=Credit`;
        title = 'Total Credits Calculation Details';
        formula = 'Sum of all Credit gains in lifetime';
    } else if (metricType === 'total-interest') {
        title = 'Total Interest Calculation Details';
        formula = 'Sum of all interest charges in lifetime';
    }

    try {
        const response = await fetch(query);
        if (response.ok) {
            let data = await response.json();
            
            if (metricType.includes('interest')) {
                data = data.filter(item => parseFloat(item.interest || 0) > 0);
            }
            
            let sum = 0;
            if (metricType.includes('interest')) {
                sum = data.reduce((acc, item) => acc + parseFloat(item.interest || 0), 0);
            } else {
                sum = data.reduce((acc, item) => acc + parseFloat(item.amount || 0), 0);
            }

            const tbody = document.getElementById('overview-details-tbody');
            if (tbody) {
                tbody.innerHTML = '';
                if (data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color: var(--text-secondary); padding: 20px;">No transactions found contributing to this metric.</td></tr>`;
                } else {
                    data.forEach(item => {
                        const tr = document.createElement('tr');
                        const gateway = [item.payment_type, item.bank_mode].filter(Boolean).join(' / ') || '-';
                        tr.innerHTML = `
                            <td class="text-center">${formatDate(item.date)}</td>
                            <td><span class="category-tag">${escapeHTML(item.category)}</span></td>
                            <td>${escapeHTML(item.description || '-')}</td>
                            <td class="text-center"><span class="role-badge ${item.payment_method === 'Credit' ? 'badge-user' : 'badge-admin'}">${escapeHTML(item.payment_method)}</span></td>
                            <td>${escapeHTML(gateway)}</td>
                            <td class="text-right">${activeCurrencySymbol}${parseFloat(item.amount).toFixed(2)}</td>
                            <td class="text-right">${activeCurrencySymbol}${parseFloat(item.interest || 0).toFixed(2)}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
            
            const titleEl = document.getElementById('overview-details-title');
            if (titleEl) titleEl.textContent = title;
            
            const formulaEl = document.getElementById('overview-details-formula');
            if (formulaEl) formulaEl.textContent = formula;
            
            const totalEl = document.getElementById('overview-details-total');
            if (totalEl) totalEl.textContent = `Total: ${activeCurrencySymbol}${sum.toFixed(2)}`;
            
            const modal = document.getElementById('overview-details-modal');
            if (modal) modal.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error fetching overview details:', err);
    }
}

function closeOverviewDetailsModal() {
    const modal = document.getElementById('overview-details-modal');
    if (modal) modal.classList.add('hidden');
}

// INLINE CONTROL ITEM MODAL HELPERS
function openInlineControlModal(type) {
    const modal = document.getElementById('inline-control-modal');
    const title = document.getElementById('inline-control-modal-title');
    const inputType = document.getElementById('inline-control-type');
    const inputName = document.getElementById('inline-control-name');
    const inputOrder = document.getElementById('inline-control-order');
    
    if (!modal) return;
    
    inputType.value = type;
    inputName.value = '';
    inputOrder.value = '';
    
    let displayName = 'Category';
    if (type === 'bank-mode') displayName = 'Bank Mode';
    if (type === 'payment-type') displayName = 'Payment Gateway';
    if (type === 'payment-category') displayName = 'Payment Source';
    
    title.textContent = `Add New ${displayName}`;
    modal.classList.remove('hidden');
}

function closeInlineControlModal() {
    const modal = document.getElementById('inline-control-modal');
    if (modal) modal.classList.add('hidden');
}

// DYNAMIC CUSTOM FIELDS RENDERING
async function loadDynamicCustomFields() {
    try {
        // Load Expense custom fields
        const respExpense = await fetch('/api/admin/excel-columns?target_type=expense');
        if (respExpense.ok) {
            const cols = await respExpense.json();
            const standardKeys = ['amount', 'category', 'date', 'description', 'bank_mode', 'payment_type', 'payment_category', 'interest', 'payment_method', 'status', 'gateway', 'bank', 'source', 'method'];
            const customCols = cols.filter(c => !standardKeys.includes(c.column_key));
            
            // Populate Parent dropdown for Expenses
            populateParentDropdowns('expense', cols);
            
            // Render in add form
            const addContainer = document.getElementById('add-expense-custom-fields');
            if (addContainer) {
                addContainer.innerHTML = '';
                customCols.forEach(col => {
                    addContainer.innerHTML += `
                        <div class="input-group">
                            <label for="add-custom-${col.column_key}">${escapeHTML(col.column_label)} ${col.is_required ? '<span class="required">*</span>' : ''}</label>
                            <input type="text" id="add-custom-${col.column_key}" data-key="${col.column_key}" class="custom-expense-field" ${col.is_required ? 'required' : ''} placeholder="Enter ${escapeHTML(col.column_label)}" data-parent-key="${col.parent_column_key || ''}" data-parent-val="${col.parent_trigger_value || ''}" data-required="${col.is_required}">
                        </div>
                    `;
                });
            }
            
            // Render in edit form
            const editContainer = document.getElementById('edit-expense-custom-fields');
            if (editContainer) {
                editContainer.innerHTML = '';
                customCols.forEach(col => {
                    editContainer.innerHTML += `
                        <div class="input-group">
                            <label for="edit-custom-${col.column_key}">${escapeHTML(col.column_label)} ${col.is_required ? '<span class="required">*</span>' : ''}</label>
                            <input type="text" id="edit-custom-${col.column_key}" data-key="${col.column_key}" class="custom-expense-field" ${col.is_required ? 'required' : ''} placeholder="Enter ${escapeHTML(col.column_label)}" data-parent-key="${col.parent_column_key || ''}" data-parent-val="${col.parent_trigger_value || ''}" data-required="${col.is_required}">
                        </div>
                    `;
                });
            }
        }
        
        // Load EMI custom fields
        const respEmi = await fetch('/api/admin/excel-columns?target_type=emi');
        if (respEmi.ok) {
            const cols = await respEmi.json();
            const standardKeys = ['name', 'principal_amount', 'interest_rate', 'tenure_months', 'emi_amount', 'start_date', 'end_date', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank'];
            const customCols = cols.filter(c => !standardKeys.includes(c.column_key));
            
            // Populate Parent dropdown for EMIs
            populateParentDropdowns('emi', cols);
            
            // Render in user emi form
            const userEmiContainer = document.getElementById('emi-custom-fields');
            if (userEmiContainer) {
                userEmiContainer.innerHTML = '';
                customCols.forEach(col => {
                    userEmiContainer.innerHTML += `
                        <div class="input-group">
                            <label for="emi-custom-${col.column_key}">${escapeHTML(col.column_label)} ${col.is_required ? '<span class="required">*</span>' : ''}</label>
                            <input type="text" id="emi-custom-${col.column_key}" data-key="${col.column_key}" class="custom-emi-field" ${col.is_required ? 'required' : ''} placeholder="Enter ${escapeHTML(col.column_label)}" data-parent-key="${col.parent_column_key || ''}" data-parent-val="${col.parent_trigger_value || ''}" data-required="${col.is_required}">
                        </div>
                    `;
                });
            }
            
            // Render in admin emi form
            const adminEmiContainer = document.getElementById('admin-emi-custom-fields');
            if (adminEmiContainer) {
                adminEmiContainer.innerHTML = '';
                customCols.forEach(col => {
                    adminEmiContainer.innerHTML += `
                        <div class="input-group">
                            <label for="admin-emi-custom-${col.column_key}">${escapeHTML(col.column_label)} ${col.is_required ? '<span class="required">*</span>' : ''}</label>
                            <input type="text" id="admin-emi-custom-${col.column_key}" data-key="${col.column_key}" class="custom-emi-field" ${col.is_required ? 'required' : ''} placeholder="Enter ${escapeHTML(col.column_label)}" data-parent-key="${col.parent_column_key || ''}" data-parent-val="${col.parent_trigger_value || ''}" data-required="${col.is_required}">
                        </div>
                    `;
                });
            }
        }
        
        // Apply conditional visibility rules
        applyConditionalFields('add-expense');
        applyConditionalFields('edit-expense');
        applyConditionalFields('user-emi');
        applyConditionalFields('admin-emi');
    } catch (err) {
        console.error('Error loading dynamic custom fields:', err);
    }
}

// EXPENSE COLUMNS TAB HELPERS
async function adminFetchExpenseColumnsTab() {
    try {
        const response = await fetch('/api/admin/excel-columns?target_type=expense');
        if (response.ok) {
            const cols = await response.json();
            renderAdminExpenseColumnsTabTable(cols);
        }
    } catch (err) {
        console.error('Error fetching admin expense columns:', err);
    }
}

function renderAdminExpenseColumnsTabTable(columns) {
    const tbody = document.getElementById('admin-expense-columns-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterSelect = document.getElementById('admin-expense-columns-filter');
    const filterType = filterSelect ? filterSelect.value : 'import';
    const isAdmin = currentUserPrivileges && currentUserPrivileges.is_admin;
    const isDisabled = isAdmin ? '' : 'disabled';

    const systemKeys = ['amount', 'category', 'date', 'description', 'bank_mode', 'payment_type', 'payment_category', 'interest', 'payment_method', 'status'];

    // Populate Parent dropdown choices for Expense Columns Tab
    populateParentDropdowns('expense', columns);

    columns.forEach(col => {
        const tr = document.createElement('tr');

        const isReq = col.is_required === 1;
        const requiredHtml = isReq
            ? `<span class="badge badge-admin"><i class="fa-solid fa-check"></i> Yes</span>`
            : `<span class="badge badge-viewer">No</span>`;

        const isChecked = (filterType === 'import' ? col.is_enabled_import : col.is_enabled_export) === 1 ? 'checked' : '';
        const isDeletable = !systemKeys.includes(col.column_key);
        const actionHtml = isDeletable && isAdmin
            ? `<button type="button" class="btn-icon btn-icon-delete" onclick="adminDeleteExpenseColumnTab('${col.column_key}')" title="Delete Custom Column" style="color: var(--color-danger);">
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

async function saveExpenseColumnsTabChanges() {
    const tbody = document.getElementById('admin-expense-columns-list');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    const filterSelect = document.getElementById('admin-expense-columns-filter');
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
                target_type: 'expense',
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
            showAppAlert('Expense column configurations saved successfully!', true);
            await adminFetchExpenseColumnsTab();
            await loadDynamicCustomFields();
        } else {
            showAppAlert(result.error || 'Failed to save changes.');
        }
    } catch (err) {
        showAppAlert('Network error saving changes.');
    }
}

async function adminDeleteExpenseColumnTab(columnKey) {
    if (!confirm(`Are you sure you want to delete the custom column "${columnKey}"? This will not drop the database column, but it will remove it from configuration and templates.`)) return;
    try {
        const response = await fetch('/api/admin/excel-columns/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ column_key: columnKey, target_type: 'expense' })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Expense custom column deleted successfully.', true);
            await adminFetchExpenseColumnsTab();
            await loadDynamicCustomFields();
        } else {
            showAppAlert(result.error || 'Failed to delete custom column.');
        }
    } catch (err) {
        showAppAlert('Network error deleting custom column.');
    }
}


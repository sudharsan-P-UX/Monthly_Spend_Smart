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
    
    const is_admin = currentUserPrivileges && currentUserPrivileges.is_admin;
    
    // Hide or show Add Currency card (form card)
    const currencyFormCard = document.getElementById('admin-currency-form')?.closest('.content-card');
    if (currencyFormCard) {
        if (is_admin) {
            currencyFormCard.classList.remove('hidden');
        } else {
            currencyFormCard.classList.add('hidden');
        }
    }
    
    // Hide or show Actions header in the table
    const thActions = document.querySelector('#tab-admin-currencies table th:last-child');
    if (thActions) {
        if (is_admin) {
            thActions.style.display = '';
        } else {
            thActions.style.display = 'none';
        }
    }
    
    currencies.forEach(curr => {
        const tr = document.createElement('tr');
        const checked = curr.is_active ? 'checked' : '';
        
        let actionsHtml = '';
        if (is_admin) {
            actionsHtml = `
                <button class="btn-icon btn-icon-edit" onclick="adminEditCurrency(${curr.id})" title="Edit Currency" style="color: var(--color-primary);">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-icon btn-icon-delete" onclick="adminDeleteCurrency(${curr.id}, '${escapeHTML(curr.country)}')" title="Delete Currency">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
        }
        
        tr.innerHTML = `
            <td><strong>${escapeHTML(curr.country)}</strong></td>
            <td>${escapeHTML(curr.country_desc)}</td>
            <td class="text-center"><span style="font-weight: 600; color: var(--color-accent); font-size: 1.1rem;">${escapeHTML(curr.symbol)}</span></td>
            <td class="text-center">
                <input type="radio" name="active_currency_radio" ${checked} onchange="adminSetActiveCurrency(${curr.id})">
            </td>
            ${is_admin ? `<td class="actions-cell">${actionsHtml}</td>` : ''}
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
        const respExpense = await fetch('/api/admin/excel-columns?target_type=expense');
        if (respExpense.ok) {
            const cols = await respExpense.json();
            const standardKeys = ['amount', 'category', 'date', 'description', 'bank_mode', 'payment_type', 'payment_category', 'interest', 'payment_method', 'status', 'gateway', 'bank', 'source', 'method'];
            const customCols = cols.filter(c => !standardKeys.includes(c.column_key));
            
            populateParentDropdowns('expense', cols);
            
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
        
        const respEmi = await fetch('/api/admin/excel-columns?target_type=emi');
        if (respEmi.ok) {
            const cols = await respEmi.json();
            const standardKeys = ['name', 'principal_amount', 'interest_rate', 'tenure_months', 'emi_amount', 'start_date', 'end_date', 'due_date', 'payment_type', 'payment_gateway', 'payment_bank'];
            const customCols = cols.filter(c => !standardKeys.includes(c.column_key));
            
            populateParentDropdowns('emi', cols);
            
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

// ==========================================
// BULK SELECTION AND DELETION HELPERS
// ==========================================

function updateExpenseSelection() {
    const checkboxes = document.querySelectorAll('.expense-row-checkbox');
    const selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(cb.getAttribute('data-id'));
        }
    });

    const bulkDeleteBtn = document.getElementById('btn-bulk-delete-expenses');
    if (bulkDeleteBtn) {
        if (selectedIds.length > 0) {
            bulkDeleteBtn.classList.remove('hidden');
            bulkDeleteBtn.querySelector('span').textContent = `Delete Selected (${selectedIds.length})`;
        } else {
            bulkDeleteBtn.classList.add('hidden');
        }
    }

    const selectAllCheckbox = document.getElementById('expense-select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkboxes.length > 0 && selectedIds.length === checkboxes.length;
    }
}

async function bulkDeleteExpenses() {
    const checkboxes = document.querySelectorAll('.expense-row-checkbox');
    const selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(parseInt(cb.getAttribute('data-id')));
        }
    });

    if (selectedIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected expenses?`)) return;

    try {
        const response = await fetch('/api/expenses/delete-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expense_ids: selectedIds })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Selected expenses deleted successfully!', true);
            await fetchExpenses();
            await updateOverviewStats();
        } else {
            showAppAlert(result.error || 'Failed to delete selected expenses.');
        }
    } catch (err) {
        showAppAlert('Network error during bulk deletion.');
    }
}

function updateUserEmiSelection() {
    const checkboxes = document.querySelectorAll('.user-emi-row-checkbox');
    const selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(cb.getAttribute('data-id'));
        }
    });

    const bulkDeleteBtn = document.getElementById('btn-bulk-delete-emis');
    if (bulkDeleteBtn) {
        if (selectedIds.length > 0) {
            bulkDeleteBtn.classList.remove('hidden');
            bulkDeleteBtn.querySelector('span').textContent = `Delete Selected (${selectedIds.length})`;
        } else {
            bulkDeleteBtn.classList.add('hidden');
        }
    }

    const selectAllCheckbox = document.getElementById('user-emi-select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkboxes.length > 0 && selectedIds.length === checkboxes.length;
    }
}

async function bulkDeleteUserEmis() {
    const checkboxes = document.querySelectorAll('.user-emi-row-checkbox');
    const selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(parseInt(cb.getAttribute('data-id')));
        }
    });

    if (selectedIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected EMIs?`)) return;

    try {
        const response = await fetch('/api/emis/delete-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emi_ids: selectedIds })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert('Selected EMIs deleted successfully!', true);
            await fetchUserEMIs();
        } else {
            showAppAlert(result.error || 'Failed to delete selected EMIs.');
        }
    } catch (err) {
        showAppAlert('Network error during bulk deletion.');
    }
}

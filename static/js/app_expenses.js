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

    const selectAllCheckbox = document.getElementById('expense-select-all');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    const bulkDeleteBtn = document.getElementById('btn-bulk-delete-expenses');
    if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');

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
            <td style="text-align: center;"><input type="checkbox" class="expense-row-checkbox" data-id="${exp.id}" style="cursor: pointer; width: 16px; height: 16px;"></td>
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

    tbody.querySelectorAll('.expense-row-checkbox').forEach(cb => {
        cb.addEventListener('change', updateExpenseSelection);
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

let pendingExpensesList = [];

function handleAddItemToExpenseList(e) {
    e.preventDefault();
    const amountInput = document.getElementById('add-amount');
    const amountVal = amountInput.value;
    let category = document.getElementById('add-category').value;
    const date = document.getElementById('add-date').value;
    const bank_mode = document.getElementById('add-bank-mode').value;
    const payment_type = document.getElementById('add-payment-type').value;
    const payment_category = document.getElementById('add-payment-category').value;
    const payment_method = document.getElementById('add-payment-method') ? document.getElementById('add-payment-method').value : 'Debit';
    const status = document.getElementById('add-status') && document.getElementById('add-status').checked ? 'Paid' : 'Unpaid';
    const descriptionInput = document.getElementById('add-description');
    const description = descriptionInput.value;
    const interestVal = document.getElementById('add-interest') ? document.getElementById('add-interest').value : '';
    const interest = interestVal === '' ? 0.0 : parseFloat(interestVal) || 0.0;
    const createddate = document.getElementById('add-createddate').value;

    if (!amountVal || parseFloat(amountVal) <= 0) {
        showAppAlert('Please enter a valid amount greater than zero.');
        return;
    }
    if (!category) {
        showAppAlert('Please select a category.');
        return;
    }
    if (!date) {
        showAppAlert('Please select a date.');
        return;
    }

    if (category.toLowerCase() === 'other') {
        const customCat = document.getElementById('add-category-other').value.trim();
        if (!customCat) {
            showAppAlert('Please specify the custom category name.');
            return;
        }
        category = customCat;
    }

    const payload = { amount: amountVal, category, date, description, bank_mode, payment_type, payment_category, interest, payment_method, status, createddate };
    document.querySelectorAll('#add-expense-custom-fields .custom-expense-field').forEach(input => {
        payload[input.getAttribute('data-key')] = input.value;
    });

    pendingExpensesList.push(payload);
    renderPendingExpensesTable();

    // Clear only amount and description
    amountInput.value = '';
    descriptionInput.value = '';
}

function renderPendingExpensesTable() {
    const container = document.getElementById('added-expenses-list-container');
    const tbody = document.getElementById('added-expenses-list-tbody');
    if (!container || !tbody) return;

    if (pendingExpensesList.length === 0) {
        container.classList.add('hidden');
        tbody.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');
    tbody.innerHTML = '';

    pendingExpensesList.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${parseFloat(item.amount).toFixed(2)}</strong></td>
            <td><span class="badge" style="background-color: var(--color-primary-light); color: var(--color-primary);">${escapeHTML(item.category)}</span></td>
            <td>${escapeHTML(item.date)}</td>
            <td>${escapeHTML(item.description || '-')}</td>
            <td class="text-center">
                <button type="button" class="btn-icon text-danger" onclick="removePendingExpense(${index})" title="Remove">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function removePendingExpense(index) {
    pendingExpensesList.splice(index, 1);
    renderPendingExpensesTable();
}

window.removePendingExpense = removePendingExpense;

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
    const createddate = document.getElementById('add-createddate').value;

    let payload;
    if (pendingExpensesList.length > 0) {
        payload = pendingExpensesList;
    } else {
        if (!amount || parseFloat(amount) <= 0) {
            showAppAlert('Please enter a valid amount greater than zero.');
            return;
        }
        if (!category) {
            showAppAlert('Please select a category.');
            return;
        }
        if (category.toLowerCase() === 'other') {
            const customCat = document.getElementById('add-category-other').value.trim();
            if (!customCat) {
                showAppAlert('Please specify the custom category name.');
                return;
            }
            category = customCat;
        }
        payload = { amount, category, date, description, bank_mode, payment_type, payment_category, interest, payment_method, status, createddate };
        document.querySelectorAll('#add-expense-custom-fields .custom-expense-field').forEach(input => {
            payload[input.getAttribute('data-key')] = input.value;
        });
    }

    try {
        const response = await fetch('/api/expenses/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
            showAppAlert(result.message || 'Expense added successfully!', true);
            
            pendingExpensesList = [];
            renderPendingExpensesTable();
            
            // Reset form fields but keep date as today
            document.getElementById('standalone-add-expense-form').reset();
            document.querySelectorAll('#add-expense-custom-fields .custom-expense-field').forEach(input => {
                input.value = '';
            });
            document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('add-createddate').value = new Date().toISOString().split('T')[0];
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
        const createddate = document.getElementById('edit-createddate').value;
        const payload = { amount, category, date, description, bank_mode, payment_type, payment_category, interest, payment_method, status, createddate };
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
    const editCreatedDateInput = document.getElementById('edit-createddate');
    if (editCreatedDateInput) {
        editCreatedDateInput.value = expense.createddate || new Date().toISOString().split('T')[0];
    }
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
        
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        const catCtx = document.getElementById('categoryChart').getContext('2d');
        if (catLabels.length === 0) {
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
                    onClick: (event, activeElements) => {
                        if (activeElements && activeElements.length > 0) {
                            const index = activeElements[0].index;
                            const categoryLabel = catLabels[index];
                            showCategoryDetailsPopup(categoryLabel);
                        }
                    },
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
        trendMonthsState = data.trends;
        
        if (trendChartInstance) {
            trendChartInstance.destroy();
        }
        
        const trendCtx = document.getElementById('trendChart').getContext('2d');
        
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
                onClick: (event, activeElements) => {
                    if (activeElements && activeElements.length > 0) {
                        const index = activeElements[0].index;
                        showTrendDetailsPopup(index);
                    }
                },
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

// POPUP DETAILS FOR CHARTS
async function showCategoryDetailsPopup(categoryLabel) {
    const monthVal = document.getElementById('overview-month') ? document.getElementById('overview-month').value : '';
    const yearVal = document.getElementById('overview-year') ? document.getElementById('overview-year').value : '';
    
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const currentYear = String(new Date().getFullYear());
    
    const finalMonth = monthVal || currentMonth;
    const finalYear = yearVal || currentYear;
    
    let query = `/api/expenses?category=${encodeURIComponent(categoryLabel)}&month=${finalMonth}&year=${finalYear}`;
    
    try {
        const response = await fetch(query);
        if (response.ok) {
            const list = await response.json();
            renderChartDetailsModal(`${categoryLabel} Expenses - ${getMonthName(finalMonth)} ${finalYear}`, list);
        } else {
            showAppAlert('Failed to load category details.');
        }
    } catch (err) {
        showAppAlert('Network error loading category details.');
    }
}

async function showTrendDetailsPopup(index) {
    if (!trendMonthsState || index >= trendMonthsState.length) return;
    const trendItem = trendMonthsState[index];
    const [year, month] = trendItem.month.split('-');
    
    let query = `/api/expenses?month=${month}&year=${year}`;
    
    try {
        const response = await fetch(query);
        if (response.ok) {
            const list = await response.json();
            renderChartDetailsModal(`Spending Details - ${trendItem.label}`, list);
        } else {
            showAppAlert('Failed to load spending details.');
        }
    } catch (err) {
        showAppAlert('Network error loading spending details.');
    }
}

function renderChartDetailsModal(title, list) {
    const titleEl = document.getElementById('chart-details-title');
    const tbody = document.getElementById('chart-details-body');
    const totalEl = document.getElementById('chart-details-total');
    
    if (titleEl) titleEl.textContent = title;
    if (tbody) {
        tbody.innerHTML = '';
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--text-secondary);">No transactions found.</td></tr>';
        } else {
            list.forEach(exp => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-glass)';
                tr.innerHTML = `
                    <td style="padding: 10px;">${formatDate(exp.date)}</td>
                    <td style="padding: 10px;"><span class="category-tag cat-other">${escapeHTML(exp.category)}</span></td>
                    <td style="padding: 10px;">${escapeHTML(exp.description || '-')}</td>
                    <td style="padding: 10px; text-align: center;"><span class="badge ${exp.payment_method === 'Credit' ? 'badge-credit' : 'badge-debit'}">${exp.payment_method || 'Debit'}</span></td>
                    <td style="padding: 10px; text-align: right; font-weight: 500;">${activeCurrencySymbol}${parseFloat(exp.amount).toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
    
    if (totalEl) {
        const total = list.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const formatter = getCurrencyFormatter(activeCurrencySymbol);
        totalEl.textContent = formatter.format(total);
    }
    
    openModal('chart-details-modal');
}

function getMonthName(monthStr) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const idx = parseInt(monthStr, 10) - 1;
    return months[idx] || '';
}

// UTILITIES
function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
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

// Dashboard Card Click Filtering
async function filterDashboardCard(type) {
    let query = '/api/expenses?';
    
    const currentDate = new Date();
    const currentYear = String(currentDate.getFullYear());
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');

    let title = "Details";

    if (type === 'month') {
        query += `month=${currentMonth}&year=${currentYear}`;
        title = "This Month's Expenses";
    } else if (type === 'all' || type === 'transactions') {
        title = "All Expenses";
    } else if (type === 'filtered_debit') {
        query += buildCurrentFilterQuery('Debit');
        title = "Filtered Debits";
    } else if (type === 'filtered_credit') {
        query += buildCurrentFilterQuery('Credit');
        title = "Filtered Credits";
    } else if (type === 'year_debit') {
        query += `year=${currentYear}&payment_method=Debit`;
        title = `${currentYear} Debits`;
    } else if (type === 'year_credit') {
        query += `year=${currentYear}&payment_method=Credit`;
        title = `${currentYear} Credits`;
    }

    try {
        const response = await fetch(query);
        if (response.ok) {
            const list = await response.json();
            document.getElementById('consolidated-modal-title').textContent = title;
            populateConsolidatedModal(list);
            openConsolidatedModal();
        } else {
            showAppAlert('Failed to load consolidated details.');
        }
    } catch (err) {
        showAppAlert('Network error loading consolidated details.');
    }
}

function buildCurrentFilterQuery(overrideMethod) {
    const category = document.getElementById('filter-category') ? document.getElementById('filter-category').value : '';
    const bankMode = document.getElementById('filter-bank-mode') ? document.getElementById('filter-bank-mode').value : '';
    const paymentType = document.getElementById('filter-payment-type') ? document.getElementById('filter-payment-type').value : '';
    const paymentCategory = document.getElementById('filter-payment-category') ? document.getElementById('filter-payment-category').value : '';
    const paymentMethod = overrideMethod;
    const status = document.getElementById('filter-status') ? document.getElementById('filter-status').value : '';
    const month = document.getElementById('filter-month') ? document.getElementById('filter-month').value : '';
    const year = document.getElementById('filter-year') ? document.getElementById('filter-year').value : '';
    const startDate = document.getElementById('filter-start-date') ? document.getElementById('filter-start-date').value : '';
    const endDate = document.getElementById('filter-end-date') ? document.getElementById('filter-end-date').value : '';
    const search = document.getElementById('filter-search') ? document.getElementById('filter-search').value : '';

    let q = '';
    if (category) q += `category=${encodeURIComponent(category)}&`;
    if (bankMode) q += `bank_mode=${encodeURIComponent(bankMode)}&`;
    if (paymentType) q += `payment_type=${encodeURIComponent(paymentType)}&`;
    if (paymentCategory) q += `payment_category=${encodeURIComponent(paymentCategory)}&`;
    if (paymentMethod) q += `payment_method=${encodeURIComponent(paymentMethod)}&`;
    if (status) q += `status=${encodeURIComponent(status)}&`;
    if (month) q += `month=${encodeURIComponent(month)}&`;
    if (year) q += `year=${encodeURIComponent(year)}&`;
    if (startDate) q += `start_date=${startDate}&`;
    if (endDate) q += `end_date=${endDate}&`;
    if (search) q += `search=${encodeURIComponent(search)}`;
    return q;
}

function populateConsolidatedModal(list) {
    const tbody = document.getElementById('consolidated-modal-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 20px;">No records found.</td></tr>';
        return;
    }
    
    list.forEach(exp => {
        const tr = document.createElement('tr');
        
        let formattedDate = '-';
        if (exp.date) {
            const d = new Date(exp.date);
            formattedDate = d.toLocaleDateString();
        }
        
        const badgeHtml = exp.payment_method === 'Credit' 
            ? `<span class="badge badge-credit">Credit</span>` 
            : `<span class="badge badge-debit">Debit</span>`;
            
        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>${escapeHTML(exp.category || '-')}</td>
            <td>${escapeHTML(exp.description || '-')}</td>
            <td class="text-right" style="font-weight: 500;">${activeCurrencySymbol}${parseFloat(exp.amount).toFixed(2)}</td>
            <td class="text-center">${badgeHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function openConsolidatedModal() {
    const modal = document.getElementById('consolidated-details-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeConsolidatedModal() {
    const modal = document.getElementById('consolidated-details-modal');
    if (modal) modal.classList.add('hidden');
}

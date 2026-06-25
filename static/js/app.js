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

// Initialize Page
document.addEventListener('DOMContentLoaded', async () => {
    // Set default date to today in forms
    const today = new Date().toISOString().split('T')[0];
    const addDateInput = document.getElementById('add-date');
    if (addDateInput) {
        addDateInput.value = today;
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
                    document.getElementById('add-interest').value = '0.00';
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
                    document.getElementById('edit-interest').value = '0.00';
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

    // Initial data fetch
    await fetchUserPrivileges();
    await fetchCategories();
    await fetchBankModes();
    await fetchPaymentTypes();
    await fetchPaymentCategories();
    await fetchExpenses();
    await updateOverviewStats();
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
    const filterMonth = document.getElementById('filter-month');
    if (filterMonth) filterMonth.value = "";
    const filterYear = document.getElementById('filter-year');
    if (filterYear) filterYear.value = "";
    document.getElementById('filter-start-date').value = "";
    document.getElementById('filter-end-date').value = "";
    document.getElementById('filter-search').value = "";
    fetchExpenses();
}

// FETCH EXPENSES
async function fetchExpenses() {
    const category = document.getElementById('filter-category').value;
    const bankMode = document.getElementById('filter-bank-mode').value;
    const paymentType = document.getElementById('filter-payment-type').value;
    const paymentCategory = document.getElementById('filter-payment-category').value;
    const paymentMethod = document.getElementById('filter-payment-method') ? document.getElementById('filter-payment-method').value : "";
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
            const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
            
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

    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
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

        tr.innerHTML = `
            <td>${formatDate(exp.date)}</td>
            <td><span class="category-tag ${catClass}">${exp.category}</span></td>
            <td>${escapeHTML(exp.description || '-')}</td>
            <td>${escapeHTML(gateway)}</td>
            <td>${escapeHTML(paySource)}</td>
            <td class="text-center">${badgeHtml}</td>
            <td class="text-right expense-amount">$${parseFloat(exp.amount).toFixed(2)}</td>
            <td class="text-right expense-interest">$${parseFloat(exp.interest || 0).toFixed(2)}</td>
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
            const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
            
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
    const description = document.getElementById('add-description').value;
    const interest = document.getElementById('add-interest') ? document.getElementById('add-interest').value : 0.0;

    if (category.toLowerCase() === 'other') {
        const customCat = document.getElementById('add-category-other').value.trim();
        if (!customCat) {
            showAppAlert('Please specify the custom category name.');
            return;
        }
        category = customCat;
    }

    try {
        const response = await fetch('/api/expenses/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, category, date, description, bank_mode, payment_type, payment_category, interest, payment_method })
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
            showAppAlert('Expense added successfully!', true);
            
            // Reset form fields but keep date as today
            document.getElementById('standalone-add-expense-form').reset();
            document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('add-bank-mode').value = "";
            document.getElementById('add-payment-type').value = "";
            document.getElementById('add-payment-category').value = "";
            if (document.getElementById('add-payment-method')) {
                document.getElementById('add-payment-method').value = "Debit";
            }
            document.getElementById('add-interest').value = "0.00";
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
    const description = document.getElementById('edit-description').value;
    const interest = document.getElementById('edit-interest') ? document.getElementById('edit-interest').value : 0.0;

    if (category.toLowerCase() === 'other') {
        const customCat = document.getElementById('edit-category-other').value.trim();
        if (!customCat) {
            showAppAlert('Please specify the custom category name.');
            return;
        }
        category = customCat;
    }

    try {
        const response = await fetch(`/api/expenses/edit/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, category, date, description, bank_mode, payment_type, payment_category, interest, payment_method })
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
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
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
                                    return ` ${context.label}: $${context.raw.toFixed(2)}`;
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
                                return ` Spent: $${context.raw.toFixed(2)}`;
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
                                return '$' + value;
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
    } else if (target === 'admin') {
        loadAdminPanel();
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
    // Hide or show Admin sidebar item
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) {
        if (currentUserPrivileges.is_admin) {
            navAdmin.classList.remove('hidden');
        } else {
            navAdmin.classList.add('hidden');
        }
    }

    // Hide or show Add Expense sidebar item
    const navAddExpense = document.getElementById('nav-add-expense');
    if (navAddExpense) {
        if (currentUserPrivileges.can_add) {
            navAddExpense.classList.remove('hidden');
        } else {
            navAddExpense.classList.add('hidden');
        }
    }

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
        });
    });
}

async function loadAdminPanel() {
    await Promise.all([
        adminFetchUsers(),
        adminFetchRoles(),
        adminFetchCategories(),
        adminFetchBankModes(),
        adminFetchPaymentTypes(),
        adminFetchPaymentCategories()
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


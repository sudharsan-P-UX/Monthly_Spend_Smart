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
    const selectAllCheckbox = document.getElementById('user-emi-select-all');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    const bulkDeleteBtn = document.getElementById('btn-bulk-delete-emis');
    if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
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
            <td style="text-align: center;"><input type="checkbox" class="user-emi-row-checkbox" data-id="${emi.id}" style="cursor: pointer; width: 16px; height: 16px;"></td>
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

    tbody.querySelectorAll('.user-emi-row-checkbox').forEach(cb => {
        cb.addEventListener('change', updateUserEmiSelection);
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
            const emiCreatedInput = document.getElementById('emi-createddate');
            if (emiCreatedInput) {
                emiCreatedInput.value = emi.createddate || new Date().toISOString().split('T')[0];
            }
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
        const emiCreatedInput = document.getElementById('emi-createddate');
        if (emiCreatedInput) {
            emiCreatedInput.value = new Date().toISOString().split('T')[0];
        }
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
    const createddate = document.getElementById('emi-createddate') ? document.getElementById('emi-createddate').value : '';

    const payload = {
        name, principal_amount, interest_rate, tenure_months, emi_amount, start_date, end_date, due_date, payment_type, payment_gateway, payment_bank, createddate
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
    const adminCreatedInput = document.getElementById('admin-emi-createddate');
    if (adminCreatedInput) {
        adminCreatedInput.value = emi.createddate || new Date().toISOString().split('T')[0];
    }
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
    const adminCreatedInput = document.getElementById('admin-emi-createddate');
    if (adminCreatedInput) {
        adminCreatedInput.value = new Date().toISOString().split('T')[0];
    }
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
    const createddate = document.getElementById('admin-emi-createddate') ? document.getElementById('admin-emi-createddate').value : '';

    const payload = {
        user_id, name, principal_amount, interest_rate, tenure_months, emi_amount, start_date, end_date, due_date, payment_type, payment_gateway, payment_bank, createddate
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

// closeEmiImportModal implementation
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

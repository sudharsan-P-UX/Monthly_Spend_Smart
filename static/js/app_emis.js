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
            populateEmiBankDropdowns();
            populateEmiFilterDropdowns();
            applyEmiFilters();
        }
    } catch (err) {
        console.error('Error fetching user EMIs:', err);
    }
}

// Extract numeric day from due_date string (e.g. "5th" -> 5)
function parseDueDay(dueDate, startDate) {
    if (dueDate) {
        const match = String(dueDate).match(/\d+/);
        if (match) return parseInt(match[0], 10);
    }
    if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) return d.getDate();
    }
    return 1;
}

// Calculate elapsed EMI months where Start Date is 1st EMI
function getEmiMonthsElapsed(emi) {
    const tenure = parseInt(emi.tenure_months) || 12;
    let startDate = new Date(emi.start_date);
    if (isNaN(startDate.getTime())) {
        startDate = new Date();
    }
    
    const startCopy = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const today = new Date();
    const todayCopy = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (todayCopy < startCopy) {
        return 0;
    }
    
    const todayYear = todayCopy.getFullYear();
    const todayMonth = todayCopy.getMonth();
    const startYear = startCopy.getFullYear();
    const startMonth = startCopy.getMonth();
    
    // Start date month counts as 1st EMI (Month 1)
    let monthsElapsed = (todayYear - startYear) * 12 + (todayMonth - startMonth) + 1;
    
    const dueDay = parseDueDay(emi.due_date, emi.start_date);
    if (todayCopy.getDate() < dueDay) {
        monthsElapsed = Math.max(0, monthsElapsed - 1);
    }
    
    return Math.min(Math.max(0, monthsElapsed), tenure);
}

function calculateEmiPendingDetails(emi) {
    const principal = parseFloat(emi.principal_amount || 0);
    const rate = parseFloat(emi.interest_rate || 0);
    const tenure = parseInt(emi.tenure_months) || 12;
    const emiAmount = parseFloat(emi.emi_amount || 0);
    const r = rate / 12 / 100;
    
    const monthsElapsed = getEmiMonthsElapsed(emi);
    
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
        monthsElapsed: monthsElapsed,
        pendingMonths: pendingMonths,
        pendingPrincipal: currentBalance
    };
}

// Update UI buttons based on EMI checkbox selection
function updateUserEmiSelection() {
    const checkedBoxes = document.querySelectorAll('.user-emi-row-checkbox:checked');
    const count = checkedBoxes.length;

    const overviewBtn = document.getElementById('btn-selected-emi-overview');
    if (overviewBtn) {
        if (count > 0) {
            overviewBtn.classList.remove('hidden');
            const span = overviewBtn.querySelector('span');
            if (span) span.textContent = `Overview (${count})`;
        } else {
            overviewBtn.classList.add('hidden');
        }
    }

    const bulkDeleteBtn = document.getElementById('btn-bulk-delete-emis');
    if (bulkDeleteBtn) {
        if (count > 0 && (currentUserPrivileges && currentUserPrivileges.can_delete)) {
            bulkDeleteBtn.classList.remove('hidden');
            const span = bulkDeleteBtn.querySelector('span');
            if (span) span.textContent = `Delete Selected (${count})`;
        } else {
            bulkDeleteBtn.classList.add('hidden');
        }
    }

    const selectAllCb = document.getElementById('user-emi-select-all');
    const allCbs = document.querySelectorAll('.user-emi-row-checkbox');
    if (selectAllCb && allCbs.length > 0) {
        selectAllCb.checked = (checkedBoxes.length === allCbs.length);
    }
}

// Open Selected EMI Overview Modal
function openSelectedEmiOverviewModal() {
    const checkedBoxes = document.querySelectorAll('.user-emi-row-checkbox:checked');
    if (checkedBoxes.length === 0) {
        showAppAlert('Please select at least one EMI.');
        return;
    }

    const selectedIds = Array.from(checkedBoxes).map(cb => String(cb.getAttribute('data-id')));
    const selectedEMIs = userEMIs.filter(e => selectedIds.includes(String(e.id)));

    if (selectedEMIs.length === 0) {
        showAppAlert('Selected EMI data not found.');
        return;
    }

    let totalMonthlyEmi = 0;
    let totalPrincipalAmount = 0;
    let totalRemainingPrincipal = 0;
    let totalPaidPrincipal = 0;
    let totalInterest = 0;
    let totalPaidInterest = 0;

    const tbody = document.getElementById('selected-emi-overview-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Sort selected EMIs by due day ascending
    selectedEMIs.sort((a, b) => parseDueDay(a.due_date, a.start_date) - parseDueDay(b.due_date, b.start_date));

    selectedEMIs.forEach(emi => {
        const pending = calculateEmiPendingDetails(emi);
        const emiAmt = parseFloat(emi.emi_amount || 0);
        const principalAmt = parseFloat(emi.principal_amount || 0);
        const rate = parseFloat(emi.interest_rate || 0);
        const tenure = parseInt(emi.tenure_months) || 12;
        const r = rate / 12 / 100;

        const monthsElapsed = pending.monthsElapsed || 0;
        let currentBalance = principalAmt;
        let interestPaidSoFar = 0;
        for (let i = 1; i <= monthsElapsed; i++) {
            let interestPaid = currentBalance * r;
            let principalPaid = emiAmt - interestPaid;
            if (principalPaid > currentBalance || i === tenure) {
                principalPaid = currentBalance;
            }
            interestPaidSoFar += interestPaid;
            currentBalance -= principalPaid;
            if (currentBalance < 0) currentBalance = 0;
        }

        const calculatedTotalInterest = Math.max(0, (emiAmt * tenure) - principalAmt);
        const calculatedPaidInterest = Math.min(interestPaidSoFar, calculatedTotalInterest);

        totalMonthlyEmi += emiAmt;
        totalPrincipalAmount += principalAmt;
        totalRemainingPrincipal += pending.pendingPrincipal;
        totalPaidPrincipal += (principalAmt - pending.pendingPrincipal);
        totalInterest += calculatedTotalInterest;
        totalPaidInterest += calculatedPaidInterest;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="font-weight: 500;">${escapeHTML(emi.name)}</span></td>
            <td class="text-right" style="font-weight: 600; color: var(--color-primary);">${activeCurrencySymbol}${emiAmt.toFixed(2)}</td>
            <td class="text-right">${activeCurrencySymbol}${principalAmt.toFixed(2)}</td>
            <td class="text-right" style="font-weight: 600; color: var(--color-secondary);">${activeCurrencySymbol}${pending.pendingPrincipal.toFixed(2)}</td>
            <td class="text-center" style="font-weight: 500; color: var(--color-accent);">${pending.pendingMonths} / ${emi.tenure_months} months</td>
            <td class="text-center">${escapeHTML(emi.due_date)}</td>
            <td class="text-center"><span class="role-badge ${emi.payment_type === 'Auto' ? 'badge-admin' : 'badge-user'}">${escapeHTML(emi.payment_type)}</span></td>
        `;
        tbody.appendChild(tr);
    });

    // Unselected EMIs calculation
    const unselectedEMIs = (userEMIs || []).filter(e => !selectedIds.includes(String(e.id)));
    let unselectedMonthlyEmi = 0;
    let unselectedRemainingPrincipal = 0;

    unselectedEMIs.forEach(emi => {
        const tenure = parseInt(emi.tenure_months) || 12;
        const monthsElapsed = getEmiMonthsElapsed(emi);
        const isCurrentActive = monthsElapsed < tenure;
        const emiAmt = parseFloat(emi.emi_amount || 0);

        if (isCurrentActive) {
            unselectedMonthlyEmi += emiAmt;
        }

        const pending = calculateEmiPendingDetails(emi);
        unselectedRemainingPrincipal += pending.pendingPrincipal;
    });

    const totalEmiEl = document.getElementById('selected-emi-total-amount');
    const remainingPrincipalEl = document.getElementById('selected-emi-remaining-principal');
    const unselectedEmiEl = document.getElementById('unselected-emi-total-amount');
    const unselectedRemainingPrincipalEl = document.getElementById('unselected-emi-remaining-principal');
    const totalPrincipalEl = document.getElementById('selected-emi-total-principal');
    const paidPrincipalEl = document.getElementById('selected-emi-paid-principal');
    const totalInterestEl = document.getElementById('selected-emi-total-interest');
    const paidInterestEl = document.getElementById('selected-emi-paid-interest');

    if (totalEmiEl) totalEmiEl.textContent = `${activeCurrencySymbol}${totalMonthlyEmi.toFixed(2)}`;
    if (remainingPrincipalEl) remainingPrincipalEl.textContent = `${activeCurrencySymbol}${totalRemainingPrincipal.toFixed(2)}`;
    if (unselectedEmiEl) unselectedEmiEl.textContent = `${activeCurrencySymbol}${unselectedMonthlyEmi.toFixed(2)}`;
    if (unselectedRemainingPrincipalEl) unselectedRemainingPrincipalEl.textContent = `${activeCurrencySymbol}${unselectedRemainingPrincipal.toFixed(2)}`;
    if (totalPrincipalEl) totalPrincipalEl.textContent = `${activeCurrencySymbol}${totalPrincipalAmount.toFixed(2)}`;
    if (paidPrincipalEl) paidPrincipalEl.textContent = `${activeCurrencySymbol}${totalPaidPrincipal.toFixed(2)}`;
    if (totalInterestEl) totalInterestEl.textContent = `${activeCurrencySymbol}${totalInterest.toFixed(2)}`;
    if (paidInterestEl) paidInterestEl.textContent = `${activeCurrencySymbol}${totalPaidInterest.toFixed(2)}`;

    // Add comparative summary rows at bottom of table
    const grandTotalMonthly = totalMonthlyEmi + unselectedMonthlyEmi;
    const grandTotalRemainingPr = totalRemainingPrincipal + unselectedRemainingPrincipal;

    const summaryRow1 = document.createElement('tr');
    summaryRow1.style.borderTop = '2px solid var(--border-color)';
    summaryRow1.style.fontWeight = 'bold';
    summaryRow1.style.background = 'rgba(167, 139, 250, 0.08)';
    summaryRow1.innerHTML = `
        <td>Selected Total (${selectedEMIs.length} ${selectedEMIs.length === 1 ? 'EMI' : 'EMIs'})</td>
        <td class="text-right" style="color: #a78bfa;">${activeCurrencySymbol}${totalMonthlyEmi.toFixed(2)}</td>
        <td class="text-right">${activeCurrencySymbol}${totalPrincipalAmount.toFixed(2)}</td>
        <td class="text-right" style="color: var(--color-secondary);">${activeCurrencySymbol}${totalRemainingPrincipal.toFixed(2)}</td>
        <td colspan="3"></td>
    `;
    tbody.appendChild(summaryRow1);

    if (unselectedEMIs.length > 0) {
        const summaryRow2 = document.createElement('tr');
        summaryRow2.style.fontWeight = 'bold';
        summaryRow2.style.background = 'rgba(192, 132, 252, 0.05)';
        summaryRow2.innerHTML = `
            <td style="color: var(--text-muted);">Unselected Total (${unselectedEMIs.length} ${unselectedEMIs.length === 1 ? 'EMI' : 'EMIs'})</td>
            <td class="text-right" style="color: #c084fc;">${activeCurrencySymbol}${unselectedMonthlyEmi.toFixed(2)}</td>
            <td class="text-right">-</td>
            <td class="text-right" style="color: #fb7185;">${activeCurrencySymbol}${unselectedRemainingPrincipal.toFixed(2)}</td>
            <td colspan="3"></td>
        `;
        tbody.appendChild(summaryRow2);

        const summaryRow3 = document.createElement('tr');
        summaryRow3.style.fontWeight = 'bold';
        summaryRow3.style.background = 'rgba(255, 255, 255, 0.03)';
        summaryRow3.innerHTML = `
            <td>Grand Total (All ${userEMIs.length} EMIs)</td>
            <td class="text-right" style="color: var(--color-primary); font-size: 1rem;">${activeCurrencySymbol}${grandTotalMonthly.toFixed(2)}</td>
            <td class="text-right">-</td>
            <td class="text-right" style="color: var(--color-secondary); font-size: 1rem;">${activeCurrencySymbol}${grandTotalRemainingPr.toFixed(2)}</td>
            <td colspan="3"></td>
        `;
        tbody.appendChild(summaryRow3);
    }

    renderEmiBreakdownLists(selectedEMIs, ['selected-emi-bank-breakdown-list'], ['selected-emi-dueday-breakdown-list'], false);

    const modal = document.getElementById('selected-emi-overview-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeSelectedEmiOverviewModal() {
    const modal = document.getElementById('selected-emi-overview-modal');
    if (modal) modal.classList.add('hidden');
}

async function bulkDeleteUserEmis() {
    const checkedBoxes = document.querySelectorAll('.user-emi-row-checkbox:checked');
    if (checkedBoxes.length === 0) {
        showAppAlert('No EMIs selected for deletion.');
        return;
    }

    if (!confirm(`Are you sure you want to delete ${checkedBoxes.length} selected EMI(s)?`)) return;

    const emi_ids = Array.from(checkedBoxes).map(cb => parseInt(cb.getAttribute('data-id')));

    try {
        const response = await fetch('/api/emis/delete-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emi_ids: emi_ids })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAppAlert(result.message || 'Selected EMIs deleted successfully.', true);
            await fetchUserEMIs();
        } else {
            showAppAlert(result.error || 'Failed to delete selected EMIs.');
        }
    } catch (err) {
        showAppAlert('Network error deleting EMIs.');
    }
}

function renderUserEMIHeaders() {
    const table = document.querySelector('#section-emi table.expense-table');
    if (!table) return;
    let thead = table.querySelector('thead');
    if (!thead) {
        thead = document.createElement('thead');
        table.insertBefore(thead, table.firstChild);
    }

    let cols = window.currentEmiColumns;
    if (!cols || cols.length === 0) {
        cols = [
            { column_key: 'name', column_label: 'EMI Name' },
            { column_key: 'principal_amount', column_label: 'Loan Amount' },
            { column_key: 'emi_amount', column_label: 'Monthly EMI' },
            { column_key: 'start_date', column_label: 'Start Date' },
            { column_key: 'end_date', column_label: 'End Date' },
            { column_key: 'tenure_months', column_label: 'Tenure' },
            { column_key: 'interest_rate', column_label: 'Interest' },
            { column_key: 'due_date', column_label: 'Due Day' },
            { column_key: 'payment_type', column_label: 'Type' },
            { column_key: 'payment_gateway', column_label: 'Payment Gateway' },
            { column_key: 'payment_bank', column_label: 'Payment Bank' }
        ];
    } else {
        cols = [...cols].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }

    let headerRowHtml = `<th style="width: 40px; text-align: center;"><input type="checkbox" id="user-emi-select-all" style="cursor: pointer; width: 16px; height: 16px;"></th>`;

    cols.forEach(col => {
        const key = col.column_key;
        const label = escapeHTML(col.column_label || key);

        if (key === 'principal_amount') {
            headerRowHtml += `<th class="text-right">${label}</th>`;
            headerRowHtml += `<th class="text-right">Pending Balance</th>`;
        } else if (key === 'emi_amount') {
            headerRowHtml += `<th class="text-right">${label}</th>`;
        } else if (key === 'tenure_months') {
            headerRowHtml += `<th class="text-center">${label}</th>`;
            headerRowHtml += `<th class="text-center">Pending Months</th>`;
        } else if (key === 'interest_rate' || key === 'due_date' || key === 'start_date' || key === 'end_date' || key === 'payment_type') {
            headerRowHtml += `<th class="text-center">${label}</th>`;
        } else {
            headerRowHtml += `<th>${label}</th>`;
        }
    });

    headerRowHtml += `<th class="text-center">Actions</th>`;

    thead.innerHTML = `<tr>${headerRowHtml}</tr>`;

    const selectAllCheckbox = document.getElementById('user-emi-select-all');
    const tbody = document.getElementById('user-emi-list');
    if (selectAllCheckbox && tbody) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.onclick = function() {
            const rowCbs = tbody.querySelectorAll('.user-emi-row-checkbox');
            rowCbs.forEach(cb => cb.checked = selectAllCheckbox.checked);
            updateUserEmiSelection();
        };
    }
}

// Render user EMIs table
function renderUserEMIsTable(emis) {
    renderUserEMIHeaders();

    const tbody = document.getElementById('user-emi-list');
    const noEmisMsg = document.getElementById('no-emis-msg');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    // Order ascending based on Due day
    emis.sort((a, b) => parseDueDay(a.due_date) - parseDueDay(b.due_date));

    const bulkDeleteBtn = document.getElementById('btn-bulk-delete-emis');
    if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
    const overviewBtn = document.getElementById('btn-selected-emi-overview');
    if (overviewBtn) overviewBtn.classList.add('hidden');

    if (emis.length === 0) {
        if (noEmisMsg) noEmisMsg.classList.remove('hidden');
        return;
    }
    if (noEmisMsg) noEmisMsg.classList.add('hidden');

    const canEdit = currentUserPrivileges ? currentUserPrivileges.can_edit : true;
    const canDelete = currentUserPrivileges ? currentUserPrivileges.can_delete : true;

    let cols = window.currentEmiColumns;
    if (!cols || cols.length === 0) {
        cols = [
            { column_key: 'name', column_label: 'EMI Name' },
            { column_key: 'principal_amount', column_label: 'Loan Amount' },
            { column_key: 'emi_amount', column_label: 'Monthly EMI' },
            { column_key: 'start_date', column_label: 'Start Date' },
            { column_key: 'end_date', column_label: 'End Date' },
            { column_key: 'tenure_months', column_label: 'Tenure' },
            { column_key: 'interest_rate', column_label: 'Interest' },
            { column_key: 'due_date', column_label: 'Due Day' },
            { column_key: 'payment_type', column_label: 'Type' },
            { column_key: 'payment_gateway', column_label: 'Payment Gateway' },
            { column_key: 'payment_bank', column_label: 'Payment Bank' }
        ];
    } else {
        cols = [...cols].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }

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

        const pending = calculateEmiPendingDetails(emi);

        let rowHtml = `<td style="text-align: center;"><input type="checkbox" class="user-emi-row-checkbox" data-id="${emi.id}" style="cursor: pointer; width: 16px; height: 16px;"></td>`;

        cols.forEach(col => {
            const key = col.column_key;
            if (key === 'name') {
                rowHtml += `<td><span style="font-weight: 500;">${escapeHTML(emi.name || '')}</span></td>`;
            } else if (key === 'principal_amount') {
                rowHtml += `<td class="text-right">${activeCurrencySymbol}${parseFloat(emi.principal_amount || 0).toFixed(2)}</td>`;
                rowHtml += `<td class="text-right" style="font-weight: 500; color: var(--color-secondary);">${activeCurrencySymbol}${pending.pendingPrincipal.toFixed(2)}</td>`;
            } else if (key === 'emi_amount') {
                rowHtml += `<td class="text-right" style="font-weight: 600; color: var(--color-secondary);">${activeCurrencySymbol}${parseFloat(emi.emi_amount || 0).toFixed(2)}</td>`;
            } else if (key === 'start_date') {
                rowHtml += `<td class="text-center">${escapeHTML(emi.start_date || '-')}</td>`;
            } else if (key === 'end_date') {
                rowHtml += `<td class="text-center">${escapeHTML(emi.end_date || '-')}</td>`;
            } else if (key === 'tenure_months') {
                rowHtml += `<td class="text-center">${emi.tenure_months || 0} months</td>`;
                rowHtml += `<td class="text-center" style="font-weight: 500; color: var(--color-accent);">${pending.pendingMonths} months</td>`;
            } else if (key === 'interest_rate') {
                rowHtml += `<td class="text-center">${parseFloat(emi.interest_rate || 0).toFixed(2)}%</td>`;
            } else if (key === 'due_date') {
                rowHtml += `<td class="text-center">${escapeHTML(emi.due_date || '-')}</td>`;
            } else if (key === 'payment_type') {
                rowHtml += `<td class="text-center"><span class="role-badge ${emi.payment_type === 'Auto' ? 'badge-admin' : 'badge-user'}">${escapeHTML(emi.payment_type || 'Manual')}</span></td>`;
            } else if (key === 'payment_gateway') {
                rowHtml += `<td>${escapeHTML(emi.payment_gateway || '-')}</td>`;
            } else if (key === 'payment_bank') {
                rowHtml += `<td>${escapeHTML(emi.payment_bank || '-')}</td>`;
            } else {
                const customVal = (emi.custom_fields && emi.custom_fields[key]) !== undefined ? emi.custom_fields[key] : (emi[key] || '-');
                rowHtml += `<td>${escapeHTML(String(customVal))}</td>`;
            }
        });

        rowHtml += `<td class="actions-cell">${actionsHtml}</td>`;
        tr.innerHTML = rowHtml;
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

        const monthsElapsed = getEmiMonthsElapsed(emi);

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
            due_date: emi.due_date,
            start_date: emi.start_date,
            payment_bank: emi.payment_bank
        });
    });

    function setEmiText(id1, id2, val) {
        const el1 = document.getElementById(id1);
        if (el1) el1.textContent = val;
        const el2 = document.getElementById(id2);
        if (el2) el2.textContent = val;
    }

    const fmtLoan = `${activeCurrencySymbol}${totalLoanAmount.toFixed(2)}`;
    const fmtPendingPr = `${activeCurrencySymbol}${totalPendingPrincipal.toFixed(2)}`;
    const fmtPrPaid = `${activeCurrencySymbol}${totalPrincipalPaid.toFixed(2)}`;
    const fmtTotInt = `${activeCurrencySymbol}${totalInterest.toFixed(2)}`;
    const fmtPaidInt = `${activeCurrencySymbol}${totalPaidInterest.toFixed(2)}`;
    const fmtMonthly = `${activeCurrencySymbol}${totalMonthlyEmi.toFixed(2)}`;

    setEmiText('emi-total-loan-amount', 'overview-emi-total-loan-amount', fmtLoan);
    setEmiText('emi-pending-principal', 'overview-emi-pending-principal', fmtPendingPr);
    setEmiText('emi-total-principal-paid', 'overview-emi-total-principal-paid', fmtPrPaid);
    setEmiText('emi-total-interest', 'overview-emi-total-interest', fmtTotInt);
    setEmiText('emi-paid-interest', 'overview-emi-paid-interest', fmtPaidInt);
    setEmiText('emi-monthly-total', 'overview-emi-monthly-total', fmtMonthly);

    renderEmiBreakdownLists(emis, ['emi-bank-breakdown-list', 'overview-emi-bank-breakdown-list'], ['emi-dueday-breakdown-list', 'overview-emi-dueday-breakdown-list'], true);
}

// Helper: Get ordinal suffix for day numbers (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(day) {
    const j = day % 10, k = day % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
}

// Helper: Render Bank-wise and Due Day-wise EMI breakdown lists
function renderEmiBreakdownLists(emisList, bankContainerIds, dueDayContainerIds, activeOnly = false) {
    const bankMap = {};
    const dueDayMap = {};

    (emisList || []).forEach(emi => {
        const tenure = parseInt(emi.tenure_months) || 12;
        const monthsElapsed = getEmiMonthsElapsed(emi);
        const isCurrentActive = monthsElapsed < tenure;
        
        if (activeOnly && !isCurrentActive) return;

        const emiAmt = parseFloat(emi.emi_amount || 0);
        const bank = (emi.payment_bank && emi.payment_bank.trim()) ? emi.payment_bank.trim() : 'Unassigned / N/A';
        const dueDayNum = parseDueDay(emi.due_date, emi.start_date);

        // Bank Map
        if (!bankMap[bank]) {
            bankMap[bank] = { bank: bank, count: 0, total: 0 };
        }
        bankMap[bank].count += 1;
        bankMap[bank].total += emiAmt;

        // Due Day Map
        const dueKey = dueDayNum;
        if (!dueDayMap[dueKey]) {
            dueDayMap[dueKey] = { dayNum: dueDayNum, count: 0, total: 0 };
        }
        dueDayMap[dueKey].count += 1;
        dueDayMap[dueKey].total += emiAmt;
    });

    // Sort Bank Map descending by total
    const sortedBanks = Object.values(bankMap).sort((a, b) => b.total - a.total);

    // Sort Due Day Map ascending by dayNum
    const sortedDueDays = Object.values(dueDayMap).sort((a, b) => a.dayNum - b.dayNum);

    // Build Bank HTML
    let bankHtml = '';
    if (sortedBanks.length === 0) {
        bankHtml = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px;">No bank breakdown data available</div>`;
    } else {
        sortedBanks.forEach(b => {
            const bankParam = encodeURIComponent(b.bank);
            bankHtml += `
                <div class="clickable-breakdown-row" onclick="showEmiOverviewDetails('bank', decodeURIComponent('${bankParam}'))" title="Click to view details list for ${escapeHTML(b.bank)}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255, 255, 255, 0.03); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.08)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'">
                    <div>
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.88rem;">${escapeHTML(b.bank)}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">(${b.count} ${b.count === 1 ? 'EMI' : 'EMIs'})</span>
                    </div>
                    <span style="font-weight: 700; color: var(--color-primary); font-size: 0.92rem;">${activeCurrencySymbol}${b.total.toFixed(2)}</span>
                </div>`;
        });
    }

    // Build Due Day HTML
    let dueDayHtml = '';
    if (sortedDueDays.length === 0) {
        dueDayHtml = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px;">No due day breakdown data available</div>`;
    } else {
        sortedDueDays.forEach(d => {
            dueDayHtml += `
                <div class="clickable-breakdown-row" onclick="showEmiOverviewDetails('dueday', ${d.dayNum})" title="Click to view details list for Due Date ${d.dayNum}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255, 255, 255, 0.03); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.08)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'">
                    <div>
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.88rem;">Due Date: ${d.dayNum}${getOrdinalSuffix(d.dayNum)} of Month</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">(${d.count} ${d.count === 1 ? 'EMI' : 'EMIs'})</span>
                    </div>
                    <span style="font-weight: 700; color: var(--color-accent); font-size: 0.92rem;">${activeCurrencySymbol}${d.total.toFixed(2)}</span>
                </div>`;
        });
    }

    // Render to target containers
    bankContainerIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = bankHtml;
    });

    dueDayContainerIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = dueDayHtml;
    });
}

// Render EMI Overview Charts in Overview Menu
let emiDistributionChartInstance = null;
let emiShareChartInstance = null;

function renderEmiOverviewCharts() {
    if (!userEMIs || userEMIs.length === 0) return;

    let totalPendingPr = 0;
    let totalPrPaid = 0;

    userEMIs.forEach(emi => {
        const pending = calculateEmiPendingDetails(emi);
        const principal = parseFloat(emi.principal_amount || 0);
        totalPendingPr += pending.pendingPrincipal;
        totalPrPaid += (principal - pending.pendingPrincipal);
    });

    const distCanvas = document.getElementById('emiDistributionChart');
    if (distCanvas) {
        if (emiDistributionChartInstance) {
            emiDistributionChartInstance.destroy();
        }
        const distCtx = distCanvas.getContext('2d');
        emiDistributionChartInstance = new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: ['Pending Principal', 'Principal Paid'],
                datasets: [{
                    data: [totalPendingPr, totalPrPaid],
                    backgroundColor: [
                        'rgba(244, 63, 94, 0.75)',
                        'rgba(16, 185, 129, 0.75)'
                    ],
                    borderColor: '#0f172a',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
                    }
                }
            }
        });
    }

    const loanLabels = userEMIs.map(e => e.name);
    const loanEmis = userEMIs.map(e => parseFloat(e.emi_amount || 0));

    const shareCanvas = document.getElementById('emiShareChart');
    if (shareCanvas) {
        if (emiShareChartInstance) {
            emiShareChartInstance.destroy();
        }
        const shareCtx = shareCanvas.getContext('2d');
        emiShareChartInstance = new Chart(shareCtx, {
            type: 'bar',
            data: {
                labels: loanLabels,
                datasets: [{
                    label: 'Monthly EMI Amount',
                    data: loanEmis,
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// Show specific EMI Details popup matching the clicked Overview category
function showEmiOverviewDetails(type, filterParam = null) {
    const modal = document.getElementById('emi-overview-details-modal');
    const titleEl = document.getElementById('emi-overview-details-title');
    const headersEl = document.getElementById('emi-overview-details-headers');
    const listEl = document.getElementById('emi-overview-details-list');

    if (!modal || !titleEl || !headersEl || !listEl) return;

    if (!window.currentEmiDetails || window.currentEmiDetails.length === 0) {
        if (userEMIs && userEMIs.length > 0) {
            updateEmiSummaryCards(userEMIs);
        } else {
            showAppAlert('No EMI data available.');
            return;
        }
    }

    let titleText = '';
    let headerHtml = '';
    let rowsHtml = '';
    let totalSum = 0;
    let colCount = 4;

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
            colCount = 4;
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
            colCount = 4;
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
            colCount = 4;
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
            colCount = 4;
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
            colCount = 4;
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
            colCount = 4;
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
        case 'bank':
            const bankName = filterParam || 'Unassigned / N/A';
            titleText = `EMI Details: Bank - ${bankName}`;
            headerHtml = `
                <tr>
                    <th>EMI Name</th>
                    <th class="text-right">Monthly EMI</th>
                    <th class="text-right">Loan Amount</th>
                    <th class="text-right">Pending Balance</th>
                    <th class="text-center">Due Day</th>
                    <th class="text-center">Status</th>
                </tr>
            `;
            colCount = 6;
            window.currentEmiDetails.forEach(item => {
                const itemBank = (item.payment_bank && item.payment_bank.trim()) ? item.payment_bank.trim() : 'Unassigned / N/A';
                if (itemBank === bankName || (bankName === 'Unassigned / N/A' && itemBank === 'Unassigned / N/A')) {
                    totalSum += item.monthlyEmi;
                    const statusHtml = item.monthsElapsed < item.tenure
                        ? `<span class="badge badge-admin">Active</span>`
                        : `<span class="badge badge-viewer">Completed</span>`;
                    const dueDayNum = parseDueDay(item.due_date, item.start_date);
                    rowsHtml += `
                        <tr>
                            <td><span style="font-weight: 500;">${escapeHTML(item.name)}</span></td>
                            <td class="text-right" style="color: var(--color-primary); font-weight: 600;">${activeCurrencySymbol}${item.monthlyEmi.toFixed(2)}</td>
                            <td class="text-right">${activeCurrencySymbol}${item.principal.toFixed(2)}</td>
                            <td class="text-right" style="color: var(--color-secondary);">${activeCurrencySymbol}${item.pendingPrincipal.toFixed(2)}</td>
                            <td class="text-center">${dueDayNum}${getOrdinalSuffix(dueDayNum)}</td>
                            <td class="text-center">${statusHtml}</td>
                        </tr>
                    `;
                }
            });
            break;
        case 'dueday':
            const dayNum = parseInt(filterParam, 10);
            titleText = `EMI Details: Due Date ${dayNum}${getOrdinalSuffix(dayNum)} of Month`;
            headerHtml = `
                <tr>
                    <th>EMI Name</th>
                    <th class="text-right">Monthly EMI</th>
                    <th class="text-right">Loan Amount</th>
                    <th class="text-right">Pending Balance</th>
                    <th>Payment Bank</th>
                    <th class="text-center">Status</th>
                </tr>
            `;
            colCount = 6;
            window.currentEmiDetails.forEach(item => {
                const itemDueDay = parseDueDay(item.due_date, item.start_date);
                if (itemDueDay === dayNum) {
                    totalSum += item.monthlyEmi;
                    const statusHtml = item.monthsElapsed < item.tenure
                        ? `<span class="badge badge-admin">Active</span>`
                        : `<span class="badge badge-viewer">Completed</span>`;
                    const bName = (item.payment_bank && item.payment_bank.trim()) ? item.payment_bank.trim() : 'N/A';
                    rowsHtml += `
                        <tr>
                            <td><span style="font-weight: 500;">${escapeHTML(item.name)}</span></td>
                            <td class="text-right" style="color: var(--color-accent); font-weight: 600;">${activeCurrencySymbol}${item.monthlyEmi.toFixed(2)}</td>
                            <td class="text-right">${activeCurrencySymbol}${item.principal.toFixed(2)}</td>
                            <td class="text-right" style="color: var(--color-secondary);">${activeCurrencySymbol}${item.pendingPrincipal.toFixed(2)}</td>
                            <td>${escapeHTML(bName)}</td>
                            <td class="text-center">${statusHtml}</td>
                        </tr>
                    `;
                }
            });
            break;
    }

    let emptyTds = '';
    const emptyTdCount = Math.max(0, colCount - 2);
    for (let i = 0; i < emptyTdCount; i++) {
        emptyTds += '<td></td>';
    }

    rowsHtml += `
        <tr style="border-top: 2px solid var(--border-color); font-weight: bold; background: rgba(255,255,255,0.02);">
            <td>Total Sum</td>
            <td class="text-right" style="font-size: 1rem;">${activeCurrencySymbol}${totalSum.toFixed(2)}</td>
            ${emptyTds}
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

    // Order ascending based on Due day
    emis.sort((a, b) => parseDueDay(a.due_date) - parseDueDay(b.due_date));

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
function populateEmiFilterDropdowns() {
    const filterBankSelect = document.getElementById('emi-filter-bank');
    if (filterBankSelect) {
        let bankOptions = '<option value="">All Banks</option>';
        const setOfBanks = new Set();
        (userEMIs || []).forEach(e => {
            if (e.payment_bank && e.payment_bank.trim()) {
                setOfBanks.add(e.payment_bank.trim());
            }
        });
        (typeof systemBankModes !== 'undefined' ? systemBankModes : []).forEach(bm => {
            if (bm.name && bm.name.trim()) {
                setOfBanks.add(bm.name.trim());
            }
        });
        Array.from(setOfBanks).sort().forEach(b => {
            bankOptions += `<option value="${escapeHTML(b)}">${escapeHTML(b)}</option>`;
        });
        filterBankSelect.innerHTML = bankOptions;
    }

    const filterDueDaySelect = document.getElementById('emi-filter-dueday');
    if (filterDueDaySelect && filterDueDaySelect.options.length <= 1) {
        let dayOptions = '<option value="">All Days</option>';
        for (let d = 1; d <= 31; d++) {
            dayOptions += `<option value="${d}">${d}${getOrdinalSuffix(d)} of Month</option>`;
        }
        filterDueDaySelect.innerHTML = dayOptions;
    }
}

function toggleEmiFilters() {
    const panel = document.getElementById('emi-filters-panel');
    if (panel) {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            populateEmiFilterDropdowns();
        }
    }
}

function applyEmiFilters() {
    if (!userEMIs) return;

    const statusEl = document.getElementById('emi-filter-status');
    const bankEl = document.getElementById('emi-filter-bank');
    const dueDayEl = document.getElementById('emi-filter-dueday');
    const typeEl = document.getElementById('emi-filter-type');
    const searchEl = document.getElementById('emi-filter-search');

    const statusVal = statusEl ? statusEl.value.trim() : '';
    const bankVal = bankEl ? bankEl.value.trim() : '';
    const dueDayVal = dueDayEl ? dueDayEl.value.trim() : '';
    const typeVal = typeEl ? typeEl.value.trim() : '';
    const searchVal = searchEl ? searchEl.value.trim().toLowerCase() : '';

    const filtered = userEMIs.filter(emi => {
        const tenure = parseInt(emi.tenure_months) || 12;
        const monthsElapsed = getEmiMonthsElapsed(emi);
        const isOpen = monthsElapsed < tenure;

        // 1. Active Status (Open / Closed)
        if (statusVal === 'Open' && !isOpen) return false;
        if (statusVal === 'Closed' && isOpen) return false;

        // 2. Bank Filter
        if (bankVal) {
            const emiBank = (emi.payment_bank && emi.payment_bank.trim()) ? emi.payment_bank.trim() : 'Unassigned / N/A';
            if (emiBank !== bankVal) return false;
        }

        // 3. Due Day Filter
        if (dueDayVal) {
            const dayNum = parseInt(dueDayVal, 10);
            const emiDueDay = parseDueDay(emi.due_date, emi.start_date);
            if (emiDueDay !== dayNum) return false;
        }

        // 4. Payment Type Filter
        if (typeVal) {
            const emiType = (emi.payment_type || 'Manual').trim();
            if (emiType.toLowerCase() !== typeVal.toLowerCase()) return false;
        }

        // 5. Search Filter
        if (searchVal) {
            const nameMatch = emi.name && emi.name.toLowerCase().includes(searchVal);
            if (!nameMatch) return false;
        }

        return true;
    });

    renderUserEMIsTable(filtered);
    updateEmiSummaryCards(filtered);
}

function resetEmiFilters() {
    const statusEl = document.getElementById('emi-filter-status');
    const bankEl = document.getElementById('emi-filter-bank');
    const dueDayEl = document.getElementById('emi-filter-dueday');
    const typeEl = document.getElementById('emi-filter-type');
    const searchEl = document.getElementById('emi-filter-search');

    if (statusEl) statusEl.value = 'Open';
    if (bankEl) bankEl.value = '';
    if (dueDayEl) dueDayEl.value = '';
    if (typeEl) typeEl.value = '';
    if (searchEl) searchEl.value = '';

    applyEmiFilters();
}

function toggleEmiOverview() {
    const checkedBoxes = document.querySelectorAll('.user-emi-row-checkbox:checked');
    if (checkedBoxes.length > 0) {
        openSelectedEmiOverviewModal();
    } else {
        const grid = document.getElementById('emi-metrics-grid');
        if (grid) {
            grid.classList.toggle('hidden');
        }
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

// PIN Auth
const correctPin = '1978';
let isAuthenticated = false;

// State
let currentView = 'view-dashboard';
let currentCustomer = null;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const pinInput = document.getElementById('pin-input');
const loginBtn = document.getElementById('login-btn');
const authError = document.getElementById('auth-error');

const mainHeader = document.getElementById('main-header');
const headerTitle = document.getElementById('header-title');
const mainContent = document.getElementById('main-content');
const bottomNav = document.getElementById('bottom-nav');

// Init
window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    setupModals();
    setupActionButtons();
    checkForDrafts();
    setupProfilePhoto();
    setupAppearance();
});

function setupAppearance() {
    const themeSelect = document.getElementById('theme-select');
    const fontSelect = document.getElementById('font-select');
    
    // Load saved settings
    const savedTheme = localStorage.getItem('sskg_theme') || 'light';
    const savedFont = localStorage.getItem('sskg_font') || '16px';
    
    if (themeSelect) themeSelect.value = savedTheme;
    if (fontSelect) fontSelect.value = savedFont;
    
    // Apply settings
    applyAppearance(savedTheme, savedFont);
    
    // Listeners
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            localStorage.setItem('sskg_theme', e.target.value);
            applyAppearance(e.target.value, localStorage.getItem('sskg_font') || '16px');
        });
    }
    
    if (fontSelect) {
        fontSelect.addEventListener('change', (e) => {
            localStorage.setItem('sskg_font', e.target.value);
            applyAppearance(localStorage.getItem('sskg_theme') || 'light', e.target.value);
        });
    }
}

function applyAppearance(theme, fontSize) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    document.body.style.fontSize = fontSize;
}

function checkAuth() {
    loginBtn.addEventListener('click', () => {
        const lockoutTime = parseInt(localStorage.getItem('sskg_lockout') || '0');
        const now = Date.now();
        
        if (now < lockoutTime) {
            const remaining = Math.ceil((lockoutTime - now) / 1000);
            authError.textContent = `Too many attempts. Try again in ${remaining}s`;
            authError.style.display = 'block';
            return;
        }

        if (pinInput.value === correctPin) {
            // Success - reset counters
            localStorage.removeItem('sskg_failed_attempts');
            localStorage.removeItem('sskg_lockout');
            
            isAuthenticated = true;
            authScreen.style.display = 'none';
            mainHeader.style.display = 'flex';
            mainContent.style.display = 'block';
            bottomNav.style.display = 'flex';
            loadView('view-dashboard');
            
            // Run scheduler check
            if (typeof scheduler !== 'undefined') scheduler.checkAllConfigs();
        } else {
            // Failure
            let attempts = parseInt(localStorage.getItem('sskg_failed_attempts') || '0') + 1;
            localStorage.setItem('sskg_failed_attempts', attempts);
            
            if (attempts >= 5) {
                localStorage.setItem('sskg_lockout', Date.now() + 60000); // 1 minute
                authError.textContent = `Too many attempts. Try again in 60s`;
            } else {
                authError.textContent = `Incorrect PIN. ${5 - attempts} attempts left.`;
            }
            
            authError.style.display = 'block';
            pinInput.value = '';
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        isAuthenticated = false;
        authScreen.style.display = 'flex';
        mainHeader.style.display = 'none';
        mainContent.style.display = 'none';
        bottomNav.style.display = 'none';
        pinInput.value = '';
        authError.style.display = 'none';
        if (typeof scheduler !== 'undefined') scheduler.stop();
    });
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            loadView(target.getAttribute('data-view'));
        });
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
        loadView('view-settings');
    });

    document.getElementById('back-from-settings-btn').addEventListener('click', () => {
        loadView('view-dashboard');
    });

    document.getElementById('back-to-katha-btn').addEventListener('click', () => {
        loadView('view-katha');
    });

    // Tabs inside customer profile
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            const target = e.currentTarget;
            target.classList.add('active');
            document.getElementById(target.getAttribute('data-target')).classList.add('active');
        });
    });
}

async function loadView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show target view
    document.getElementById(viewId).classList.add('active');
    currentView = viewId;

    // Update Header
    if (viewId === 'view-dashboard') {
        headerTitle.textContent = 'Dashboard';
        await renderDashboard();
    } else if (viewId === 'view-katha') {
        headerTitle.textContent = 'Katha List';
        await renderKathaList();
    } else if (viewId === 'view-history') {
        headerTitle.textContent = 'Full History';
        await renderGlobalHistory();
    } else if (viewId === 'view-customer') {
        headerTitle.textContent = currentCustomer ? currentCustomer.name : 'Customer';
        await renderCustomerProfile();
    } else if (viewId === 'view-katha-detail') {
        headerTitle.textContent = 'Entry Details';
    } else if (viewId === 'view-settings') {
        headerTitle.textContent = 'Settings';
        await updateStorageUsage();
    }
}

// FORMATTERS
const formatMoney = (amount) => '₹' + Number(amount).toLocaleString('en-IN');
const formatDate = (ts) => new Date(ts).toLocaleDateString('en-GB'); // DD/MM/YYYY
const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

// DASHBOARD
let chartInstance = null;
async function renderDashboard() {
    const stats = await dbOps.getStats();
    
    document.getElementById('kpi-kathas-today').textContent = stats.kathasToday;
    document.getElementById('kpi-paid-today').textContent = stats.paidToday;
    document.getElementById('kpi-month-total').textContent = formatMoney(stats.monthTotal);
    document.getElementById('kpi-highest-name').textContent = stats.highestKatha.name;
    document.getElementById('kpi-highest-amount').textContent = formatMoney(stats.highestKatha.balance);

    // Chart.js
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    const chartData = await dbOps.getWeeklyChartData();
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'This Week (₹)',
                data: chartData.thisWeekData,
                backgroundColor: '#FF6B00'
            }, {
                label: 'Last Week (₹)',
                data: chartData.lastWeekData,
                backgroundColor: '#e5e7eb'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// KATHA LIST
async function renderKathaList(search = '') {
    const list = document.getElementById('katha-list');
    list.innerHTML = '';
    
    let customers = await dbOps.getCustomers();
    if (search) {
        search = search.toLowerCase();
        customers = customers.filter(c => c.name.toLowerCase().includes(search) || c.phone.includes(search));
    }

    customers.forEach(cust => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        const initial = cust.name.charAt(0).toUpperCase();
        const amtClass = cust.balance > 0 ? 'amount-red' : '';
        
        item.innerHTML = `
            <div class="avatar">${initial}</div>
            <div class="item-details">
                <div class="item-name">${cust.name}</div>
                <div class="item-sub">${cust.phone}</div>
            </div>
            <div class="item-amount ${amtClass}">${formatMoney(cust.balance)}</div>
        `;
        
        item.addEventListener('click', () => {
            currentCustomer = cust;
            loadView('view-customer');
        });
        
        list.appendChild(item);
    });
}

document.getElementById('katha-search').addEventListener('input', (e) => {
    renderKathaList(e.target.value);
});

// CUSTOMER PROFILE
async function renderCustomerProfile() {
    if (!currentCustomer) return;
    
    // Refresh customer data to get latest balance
    currentCustomer = await dbOps.getCustomer(currentCustomer.id);
    
    document.getElementById('cust-name').textContent = currentCustomer.name;
    document.getElementById('cust-phone').textContent = currentCustomer.phone;
    document.getElementById('cust-balance').textContent = formatMoney(currentCustomer.balance);
    
    await renderCustomerHistory();
    await renderDailyConfig();
}

async function renderCustomerHistory() {
    const list = document.getElementById('cust-history-list');
    list.innerHTML = '';
    
    const logs = await dbOps.getHistoryLogByCustomer(currentCustomer.id);
    
    logs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        let iconClass = 'history-edit';
        let iconText = '📝';
        if (log.eventType === 'katha_added') { iconClass = 'history-katha'; iconText = '📖'; }
        if (log.eventType === 'payment_received') { iconClass = 'history-payment'; iconText = '💚'; }
        
        item.innerHTML = `
            <div class="history-icon ${iconClass}">${iconText}</div>
            <div class="item-details">
                <div class="item-name" style="font-size:16px;">${log.description}</div>
                <div class="item-sub">${formatDate(log.createdAt)} ${formatTime(log.createdAt)}</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            renderKathaDetail(log);
        });

        list.appendChild(item);
    });
}

// KATHA DETAIL VIEW
async function renderKathaDetail(log) {
    await loadView('view-katha-detail');
    
    document.getElementById('detail-date').textContent = `${formatDate(log.createdAt)} ${formatTime(log.createdAt)}`;
    document.getElementById('detail-amount').textContent = `₹${log.amount}`;
    
    const itemsList = document.getElementById('detail-items-list');
    const itemsSection = document.getElementById('detail-items-section');
    const paymentEditSection = document.getElementById('detail-payment-edit-section');
    
    itemsList.innerHTML = '';
    itemsSection.style.display = 'block';
    paymentEditSection.style.display = 'none';
    
    // We need to fetch the actual katha entry to show the items
    if (log.eventType === 'katha_added' && log.referenceId) {
        const entry = await db.katha_entries.get(log.referenceId);
        if (entry && entry.items) {
            entry.items.forEach(i => {
                itemsList.innerHTML += `
                    <div class="list-item" style="padding: 12px; margin-bottom: 8px;">
                        <div class="item-details">
                            <div class="item-name" style="font-size:16px;">${i.name}</div>
                            <div class="item-sub">${i.qty} x ₹${i.unitPrice}</div>
                        </div>
                        <div class="amount-red">₹${i.lineTotal}</div>
                    </div>
                `;
            });
        } else {
            itemsList.innerHTML = '<p class="text-muted">Item details not available.</p>';
        }
    } else if (log.eventType === 'payment_received' && log.referenceId) {
        document.getElementById('detail-items-section').style.display = 'none';
        
        const paymentEditSection = document.getElementById('detail-payment-edit-section');
        paymentEditSection.style.display = 'block';
        
        const amountInput = document.getElementById('edit-payment-amount');
        const reasonInput = document.getElementById('edit-payment-reason');
        const reasonGroup = document.getElementById('edit-payment-reason-group');
        const saveBtn = document.getElementById('save-edit-payment-btn');
        
        amountInput.value = log.amount;
        
        const isQuickEdit = (Date.now() - log.createdAt) < 30000;
        if (isQuickEdit) {
            reasonGroup.style.display = 'none';
            reasonInput.value = '';
        } else {
            reasonGroup.style.display = 'block';
        }
        
        saveBtn.onclick = async () => {
            const newAmount = Number(amountInput.value);
            if (!newAmount || newAmount <= 0) return alert("Enter valid amount");
            
            const isNowQuickEdit = (Date.now() - log.createdAt) < 30000;
            const reason = reasonInput.value.trim();
            
            if (!isNowQuickEdit && !reason) {
                return alert("Reason is required for edits after 30 seconds.");
            }
            
            try {
                await dbOps.editPayment(log.referenceId, newAmount, reason);
                alert("Payment updated successfully.");
                currentCustomer = await dbOps.getCustomer(log.customerId);
                loadView('view-customer');
            } catch(e) {
                alert(e.message);
            }
        };
        
    } else {
        itemsList.innerHTML = '<p class="text-muted">No items available.</p>';
    }
    
    document.getElementById('back-from-detail-btn').onclick = () => {
        loadView('view-customer');
    };
}

// MODALS & ACTIONS
function setupModals() {
    // Close Modals
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            clearDraft();
        });
    });

    // Add Customer
    document.getElementById('add-manual-btn').addEventListener('click', () => {
        document.getElementById('modal-add-customer').classList.add('active');
    });

    document.getElementById('save-customer-btn').addEventListener('click', async () => {
        const name = document.getElementById('new-cust-name').value;
        const phone = document.getElementById('new-cust-phone').value;
        if (name && phone) {
            await dbOps.addCustomer(name, phone);
            document.getElementById('modal-add-customer').classList.remove('active');
            document.getElementById('new-cust-name').value = '';
            document.getElementById('new-cust-phone').value = '';
            renderKathaList();
        }
    });

    // Add Contact API
    document.getElementById('add-contact-btn').addEventListener('click', async () => {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const props = ['name', 'tel'];
                const contacts = await navigator.contacts.select(props, { multiple: false });
                if (contacts.length > 0) {
                    const c = contacts[0];
                    document.getElementById('new-cust-name').value = c.name ? c.name[0] : '';
                    document.getElementById('new-cust-phone').value = c.tel ? c.tel[0].replace(/\\D/g,'') : '';
                    document.getElementById('modal-add-customer').classList.add('active');
                }
            } catch (ex) {
                alert("Contact picker failed. Ensure you are using HTTPS and a supported browser (Chrome on Android). Please use 'Add Manually'.");
            }
        } else {
            alert("Contact picker requires an HTTPS connection and is only supported on Chrome for Android. Please use 'Add Manually'.");
        }
    });
}

function setupActionButtons() {
    // WhatsApp
    document.getElementById('whatsapp-btn').addEventListener('click', () => {
        if (!currentCustomer) return;
        const msg = `Namaskaram! 🙏 Sai Saranya Kirana & General store nundi — mee katha balance ${formatMoney(currentCustomer.balance)}. Please pay via UPI or cash when visiting the store. Thank you!`;
        window.open(`https://wa.me/91${currentCustomer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    });

    // PDF Report
    document.getElementById('generate-report-btn').addEventListener('click', () => {
        if (typeof pdfGenerator !== 'undefined') pdfGenerator.generateDailyReport();
    });

    // Invoice
    document.getElementById('invoice-btn').addEventListener('click', () => {
        if (!currentCustomer) return;
        if (typeof pdfGenerator !== 'undefined') pdfGenerator.generateInvoice(currentCustomer);
    });

    // Statement
    document.getElementById('statement-btn').addEventListener('click', () => {
        if (!currentCustomer) return;
        if (typeof pdfGenerator !== 'undefined') pdfGenerator.generateStatement(currentCustomer);
    });

    // --- KATHA ENTRY FLOW ---
    const addKathaModal = document.getElementById('modal-add-katha');
    const itemsContainer = document.getElementById('katha-items-container');
    const totalEl = document.getElementById('katha-total-amount');

    document.getElementById('new-katha-btn').addEventListener('click', () => {
        itemsContainer.innerHTML = '';
        addKathaItemRow();
        updateKathaTotal();
        addKathaModal.classList.add('active');
        draftType = 'katha';
    });

    document.getElementById('add-item-row-btn').addEventListener('click', () => {
        addKathaItemRow();
    });

    function addKathaItemRow(name='', qty='', price='') {
        const row = document.createElement('div');
        row.className = 'form-row mb-2';
        row.innerHTML = `
            <input type="text" class="form-control item-name-in" placeholder="Item name" style="flex:2" value="${name}">
            <input type="number" class="form-control item-qty-in" placeholder="Qty" style="flex:1" value="${qty}">
            <input type="number" class="form-control item-price-in" placeholder="₹/unit" style="flex:1" value="${price}">
            <button class="btn btn-danger btn-small remove-row-btn">X</button>
        `;
        
        row.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                updateKathaTotal();
                saveDraft();
            });
        });
        
        row.querySelector('.remove-row-btn').addEventListener('click', (e) => {
            e.target.parentElement.remove();
            updateKathaTotal();
            saveDraft();
        });
        
        itemsContainer.appendChild(row);
    }

    function updateKathaTotal() {
        let total = 0;
        itemsContainer.querySelectorAll('.form-row').forEach(row => {
            const q = parseFloat(row.querySelector('.item-qty-in').value) || 0;
            const p = parseFloat(row.querySelector('.item-price-in').value) || 0;
            total += (q * p);
        });
        totalEl.textContent = formatMoney(total);
        return total;
    }

    document.getElementById('save-katha-btn').addEventListener('click', async () => {
        if (!currentCustomer) return;
        const total = updateKathaTotal();
        if (total <= 0) return alert("Total must be greater than 0");
        
        const items = [];
        itemsContainer.querySelectorAll('.form-row').forEach(row => {
            const name = row.querySelector('.item-name-in').value || 'Item';
            const qty = parseFloat(row.querySelector('.item-qty-in').value) || 1;
            const price = parseFloat(row.querySelector('.item-price-in').value) || 0;
            if(price > 0) {
                items.push({name, qty, unitPrice: price, lineTotal: qty*price});
            }
        });
        
        await dbOps.addKathaEntry(currentCustomer.id, items, total, 'normal', false);
        addKathaModal.classList.remove('active');
        clearDraft();
        await renderCustomerProfile();
    });

    // --- PAYMENT FLOW ---
    const paymentModal = document.getElementById('modal-payment');
    
    document.getElementById('mark-paid-btn').addEventListener('click', () => {
        document.getElementById('pay-total-due').textContent = formatMoney(currentCustomer.balance);
        document.getElementById('pay-custom-amount').value = '';
        paymentModal.classList.add('active');
        draftType = 'payment';
    });

    document.getElementById('pay-custom-amount').addEventListener('input', saveDraft);

    document.getElementById('pay-full-btn').addEventListener('click', async () => {
        if (!currentCustomer || currentCustomer.balance <= 0) return;
        await dbOps.addPayment(currentCustomer.id, currentCustomer.balance, 'full');
        paymentModal.classList.remove('active');
        clearDraft();
        await renderCustomerProfile();
    });

    document.getElementById('pay-custom-btn').addEventListener('click', async () => {
        if (!currentCustomer) return;
        const amt = parseFloat(document.getElementById('pay-custom-amount').value);
        if (amt > 0) {
            await dbOps.addPayment(currentCustomer.id, amt, 'partial');
            paymentModal.classList.remove('active');
            clearDraft();
            await renderCustomerProfile();
        }
    });
}

// DAILY CONFIG LOGIC (UI)
async function renderDailyConfig() {
    if (!currentCustomer) return;
    const config = await dbOps.getDailyConfigForCustomer(currentCustomer.id);
    const toggle = document.getElementById('daily-active-toggle');
    const list = document.getElementById('daily-items-list');
    
    if (config) {
        toggle.checked = config.isActive;
        list.innerHTML = config.items.map(i => `
            <div class="list-item" style="padding: 12px; margin-bottom: 8px;">
                <div class="item-details">
                    <div class="item-name" style="font-size:16px;">${i.name} (${i.qty} x ₹${i.unitPrice})</div>
                    <div class="item-sub">Scheduled: ${config.scheduledTime}</div>
                </div>
                <div class="amount-red">₹${i.lineTotal}</div>
            </div>
        `).join('');
    } else {
        toggle.checked = false;
        list.innerHTML = '<p class="text-muted">No daily items configured.</p>';
    }
    
    // Remove old listeners to avoid duplicates
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    
    newToggle.addEventListener('change', async (e) => {
        if (config) {
            await dbOps.setDailyConfig(currentCustomer.id, config.items, config.scheduledTime, e.target.checked);
        } else {
            e.target.checked = false;
            alert("Please configure items first.");
        }
    });

    const editBtn = document.getElementById('edit-daily-btn');
    const newEditBtn = editBtn.cloneNode(true);
    editBtn.parentNode.replaceChild(newEditBtn, editBtn);

    newEditBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-daily-config');
        const container = document.getElementById('daily-items-container');
        container.innerHTML = '';
        
        if (config && config.items.length > 0) {
            document.getElementById('daily-time').value = config.scheduledTime;
            config.items.forEach(i => addDailyItemRow(i.name, i.qty, i.unitPrice));
        } else {
            addDailyItemRow();
        }
        modal.classList.add('active');
    });
}

function addDailyItemRow(name='', qty='', price='') {
    const container = document.getElementById('daily-items-container');
    const row = document.createElement('div');
    row.className = 'form-row mb-2';
    row.innerHTML = `
        <input type="text" class="form-control item-name-in" placeholder="Milk pkt" style="flex:2" value="${name}">
        <input type="number" class="form-control item-qty-in" placeholder="Qty" style="flex:1" value="${qty}">
        <input type="number" class="form-control item-price-in" placeholder="₹" style="flex:1" value="${price}">
        <button class="btn btn-danger btn-small remove-row-btn">X</button>
    `;
    row.querySelector('.remove-row-btn').addEventListener('click', (e) => e.target.parentElement.remove());
    container.appendChild(row);
}

document.getElementById('add-daily-item-row-btn').addEventListener('click', () => addDailyItemRow());

document.getElementById('save-daily-btn').addEventListener('click', async () => {
    if (!currentCustomer) return;
    const time = document.getElementById('daily-time').value;
    const items = [];
    document.getElementById('daily-items-container').querySelectorAll('.form-row').forEach(row => {
        const name = row.querySelector('.item-name-in').value;
        const qty = parseFloat(row.querySelector('.item-qty-in').value) || 1;
        const price = parseFloat(row.querySelector('.item-price-in').value) || 0;
        if(name && price > 0) {
            items.push({name, qty, unitPrice: price, lineTotal: qty*price});
        }
    });
    
    if (items.length > 0) {
        await dbOps.setDailyConfig(currentCustomer.id, items, time, true);
        document.getElementById('modal-daily-config').classList.remove('active');
        await renderDailyConfig();
    }
});

// GLOBAL HISTORY
async function renderGlobalHistory() {
    const list = document.getElementById('global-history-list');
    const filter = document.getElementById('history-filter').value;
    list.innerHTML = '';
    
    let logs = await dbOps.getHistoryLog(200); // Last 200 items
    
    if (filter !== 'all') {
        logs = logs.filter(l => l.eventType === filter);
    }
    
    // We need customer names. Fetch all customers once.
    const customers = await dbOps.getCustomers();
    const custMap = {};
    customers.forEach(c => custMap[c.id] = c.name);

    logs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        let iconClass = 'history-edit';
        let iconText = '📝';
        if (log.eventType === 'katha_added') { iconClass = 'history-katha'; iconText = '📖'; }
        if (log.eventType === 'payment_received') { iconClass = 'history-payment'; iconText = '💚'; }
        
        const custName = custMap[log.customerId] || 'Unknown';

        item.innerHTML = `
            <div class="history-icon ${iconClass}">${iconText}</div>
            <div class="item-details">
                <div class="item-name" style="font-size:16px;">${custName}</div>
                <div class="item-sub">${log.description}</div>
                <div class="item-sub" style="font-size:11px;">${formatDate(log.createdAt)} ${formatTime(log.createdAt)}</div>
            </div>
            <div class="item-amount">₹${log.amount}</div>
        `;
        
        item.addEventListener('click', async () => {
            currentCustomer = await dbOps.getCustomer(log.customerId);
            renderKathaDetail(log);
            document.getElementById('back-from-detail-btn').onclick = () => {
                loadView('view-history');
            };
        });

        list.appendChild(item);
    });
}

document.getElementById('history-filter').addEventListener('change', renderGlobalHistory);

// DRAFT SYSTEM (BATTERY DEATH PROTECTION)
let draftTimeout = null;
let draftType = null; // 'katha' or 'payment'

function saveDraft() {
    if (!currentCustomer) return;
    clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
        let draftData = {};
        if (draftType === 'katha') {
            const items = [];
            document.getElementById('katha-items-container').querySelectorAll('.form-row').forEach(row => {
                items.push({
                    name: row.querySelector('.item-name-in').value,
                    qty: row.querySelector('.item-qty-in').value,
                    price: row.querySelector('.item-price-in').value
                });
            });
            draftData = { type: 'katha', customerId: currentCustomer.id, items };
        } else if (draftType === 'payment') {
            draftData = { 
                type: 'payment', 
                customerId: currentCustomer.id, 
                amount: document.getElementById('pay-custom-amount').value 
            };
        }
        localStorage.setItem('sskg_draft', JSON.stringify(draftData));
    }, 500);
}

function clearDraft() {
    localStorage.removeItem('sskg_draft');
    draftType = null;
    document.getElementById('draft-banner').style.display = 'none';
}

function checkForDrafts() {
    const draft = localStorage.getItem('sskg_draft');
    if (draft) {
        document.getElementById('draft-banner').style.display = 'flex';
    }
}

document.getElementById('discard-draft-btn').addEventListener('click', () => {
    clearDraft();
});

document.getElementById('resume-draft-btn').addEventListener('click', async () => {
    const draft = JSON.parse(localStorage.getItem('sskg_draft'));
    if (!draft) return;
    
    currentCustomer = await dbOps.getCustomer(draft.customerId);
    if (!currentCustomer) { clearDraft(); return; }
    
    await loadView('view-customer');
    
    if (draft.type === 'katha') {
        draftType = 'katha';
        const itemsContainer = document.getElementById('katha-items-container');
        itemsContainer.innerHTML = '';
        draft.items.forEach(i => addKathaItemRow(i.name, i.qty, i.price));
        updateKathaTotal();
        document.getElementById('modal-add-katha').classList.add('active');
    } else if (draft.type === 'payment') {
        draftType = 'payment';
        document.getElementById('pay-total-due').textContent = formatMoney(currentCustomer.balance);
        document.getElementById('pay-custom-amount').value = draft.amount;
        document.getElementById('modal-payment').classList.add('active');
    }
    
    document.getElementById('draft-banner').style.display = 'none';
});

// SETTINGS & STORAGE
async function updateStorageUsage() {
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const kb = (estimate.usage / 1024).toFixed(2);
        document.getElementById('storage-usage').textContent = `App Data Size: ${kb} KB`;
        if (kb > 50000) { // >50MB
            document.getElementById('storage-usage').innerHTML += `<br><span class="amount-red">Storage getting full! Please clear old history.</span>`;
        }
    }
}

document.getElementById('clear-history-btn').addEventListener('click', async () => {
    if (confirm("Are you sure? This will delete history logs older than 90 days. Katha balances will NOT be affected.")) {
        const deleted = await dbOps.deleteOldHistory();
        alert(`Deleted ${deleted} old history records.`);
        updateStorageUsage();
    }
});

function setupProfilePhoto() {
    const photoInput = document.getElementById('profile-photo-input');
    const photoImg = document.getElementById('profile-photo-img');
    const photoPlaceholder = document.getElementById('profile-photo-placeholder');
    
    const phoneInput = document.getElementById('shop-phone-input');
    const addressInput = document.getElementById('shop-address-input');
    const saveShopBtn = document.getElementById('save-shop-details-btn');

    // Load from local storage
    const savedPhoto = localStorage.getItem('sskg_profile_photo');
    if (savedPhoto) {
        photoImg.src = savedPhoto;
        photoImg.style.display = 'block';
        photoPlaceholder.style.display = 'none';
    }
    
    if (phoneInput) phoneInput.value = localStorage.getItem('sskg_shop_phone') || '';
    if (addressInput) addressInput.value = localStorage.getItem('sskg_shop_address') || '';

    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 200;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    
                    photoImg.src = dataUrl;
                    photoImg.style.display = 'block';
                    photoPlaceholder.style.display = 'none';
                    
                    localStorage.setItem('sskg_profile_photo', dataUrl);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    
    if (saveShopBtn) {
        saveShopBtn.addEventListener('click', () => {
            if (phoneInput) localStorage.setItem('sskg_shop_phone', phoneInput.value.trim());
            if (addressInput) localStorage.setItem('sskg_shop_address', addressInput.value.trim());
            alert('Shop details saved!');
        });
    }
}

// ACXIOMCRM FRONTEND SPA LOGIC & VALIDATION ENGINE

let currentUser = null;
let leadStatusChart = null;
let oppPipelineChart = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);

  // Check if session token exists
  checkAuth();

  // Navigation Links Click Handling
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      switchView(view);
    });
  });

  // Mobile sidebar toggle
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('d-block');
    });
  }

  // Setup Form Submit Listeners with Instant Client-side Validation
  setupAuthForm();
  setupRegisterForm();
  setupCustomerForm();
  setupLeadForm();
  setupOppForm();
  setupFollowupForm();

  // Setup Search Listeners
  document.getElementById('cust-search')?.addEventListener('input', debounce(loadCustomers, 300));
  document.getElementById('lead-search')?.addEventListener('input', debounce(loadLeads, 300));
  document.getElementById('opp-search')?.addEventListener('input', debounce(loadOpportunities, 300));
});

function updateClock() {
  const elem = document.getElementById('current-date-time');
  if (elem) {
    const now = new Date();
    elem.textContent = now.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
}

// ---------------------------------------------------------
// TOAST NOTIFICATIONS & ALERTS
// ---------------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'success' ? 'bg-success' : (type === 'danger' ? 'bg-danger' : 'bg-warning');
  
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'} me-2"></i>
          ${escapeHtml(message)}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  const toastElem = document.getElementById(toastId);
  const bsToast = new bootstrap.Toast(toastElem, { delay: 4000 });
  bsToast.show();

  toastElem.addEventListener('hidden.bs.toast', () => {
    toastElem.remove();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// ---------------------------------------------------------
// AUTH TAB SWITCHING (Login <-> Register)
// ---------------------------------------------------------
function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');
  const quickSection = document.getElementById('quick-login-section');
  const signinHint = document.getElementById('signin-hint');
  const alert = document.getElementById('auth-alert');

  // Clear alerts
  alert.classList.add('d-none');

  if (tab === 'login') {
    loginForm.classList.remove('d-none');
    registerForm.classList.add('d-none');
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    quickSection.classList.remove('d-none');
    signinHint.classList.add('d-none');
  } else {
    loginForm.classList.add('d-none');
    registerForm.classList.remove('d-none');
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
    quickSection.classList.add('d-none');
    signinHint.classList.remove('d-none');
  }
}

// ---------------------------------------------------------
// AUTHENTICATION & QUICK DEMO LOGIN
// ---------------------------------------------------------function setupRegisterForm() {
  const form = document.getElementById('register-form');
  const alertElem = document.getElementById('auth-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertElem.classList.add('d-none');
    form.classList.remove('was-validated');

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;

    // Client-side validation
    let valid = true;
    if (!name) valid = false;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) valid = false;
    if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) valid = false;

    if (!valid) {
      form.classList.add('was-validated');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await res.json();
      if (!res.ok) {
        alertElem.className = 'alert alert-danger';
        alertElem.textContent = data.error || 'Registration failed.';
        alertElem.classList.remove('d-none');
      } else {
        alertElem.className = 'alert alert-success';
        alertElem.textContent = `Account created for ${name}! Please sign in.`;
        alertElem.classList.remove('d-none');
        form.reset();
        // Auto-switch to login tab after 1.5s
        setTimeout(() => switchAuthTab('login'), 1500);
      }
    } catch (err) {
      alertElem.className = 'alert alert-danger';
      alertElem.textContent = 'Server communication error.';
      alertElem.classList.remove('d-none');
    }
  });
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      showAppShell();
    } else {
      showAuthShell();
    }
  } catch (err) {
    showAuthShell();
  }
}

function showAuthShell() {
  document.getElementById('auth-container').classList.remove('d-none');
  document.getElementById('app-container').classList.add('d-none');
}

function showAppShell() {
  document.getElementById('auth-container').classList.add('d-none');
  document.getElementById('app-container').classList.remove('d-none');

  // Update Sidebar User Profile
  document.getElementById('user-display-name').textContent = currentUser.Name;
  document.getElementById('user-display-role').textContent = currentUser.Role;
  document.getElementById('user-avatar').textContent = currentUser.Name.charAt(0).toUpperCase();

  // Enforce Role Visibility on Navigation Items
  document.querySelectorAll('.admin-only').forEach(el => {
    if (currentUser.Role === 'Admin') {
      el.classList.remove('d-none');
    } else if (currentUser.Role === 'Manager' && el.classList.contains('manager-allowed')) {
      el.classList.remove('d-none');
    } else {
      el.classList.add('d-none');
    }
  });

  // Default to Dashboard
  switchView('dashboard');
}

function quickLogin(email, password) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = password;
  document.getElementById('login-form').requestSubmit();
}

function setupAuthForm() {
  const form = document.getElementById('login-form');
  const alertElem = document.getElementById('auth-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertElem.classList.add('d-none');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      alertElem.className = 'alert alert-danger';
      alertElem.textContent = 'Please provide both email and password.';
      alertElem.classList.remove('d-none');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        alertElem.className = 'alert alert-danger';
        alertElem.textContent = data.error || 'Login failed.';
        alertElem.classList.remove('d-none');
      } else {
        currentUser = data.user;
        showAppShell();
        showToast(`Welcome back, ${currentUser.Name}!`);
      }
    } catch (err) {
      alertElem.className = 'alert alert-danger';
      alertElem.textContent = 'Server communication error.';
      alertElem.classList.remove('d-none');
    }
  });
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    // Ignore error
  }
  currentUser = null;
  showAuthShell();
  showToast('Logged out successfully.');
}

// ---------------------------------------------------------
// VIEW ROUTING & SWITCHER
// ---------------------------------------------------------
function switchView(viewName) {
  // Update sidebar active link
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Hide all views
  document.querySelectorAll('.crm-view').forEach(view => view.classList.add('d-none'));

  // Update page title & load view data
  const pageTitle = document.getElementById('page-title');

  switch (viewName) {
    case 'dashboard':
      pageTitle.textContent = 'Executive Dashboard';
      document.getElementById('view-dashboard').classList.remove('d-none');
      loadDashboard();
      break;
    case 'customers':
      pageTitle.textContent = 'Customer Management';
      document.getElementById('view-customers').classList.remove('d-none');
      loadCustomers();
      break;
    case 'leads':
      pageTitle.textContent = 'Lead Management & Qualification';
      document.getElementById('view-leads').classList.remove('d-none');
      loadLeads();
      break;
    case 'opportunities':
      pageTitle.textContent = 'Sales Opportunity Pipeline';
      document.getElementById('view-opportunities').classList.remove('d-none');
      loadOpportunities();
      break;
    case 'followups':
      pageTitle.textContent = 'Follow-Up Schedule & Tasks';
      document.getElementById('view-followups').classList.remove('d-none');
      loadFollowups();
      break;
    case 'reports':
      pageTitle.textContent = 'Analytics & Performance Reports';
      document.getElementById('view-reports').classList.remove('d-none');
      loadReports();
      break;
    case 'users':
      pageTitle.textContent = 'User Administration & Security';
      document.getElementById('view-users').classList.remove('d-none');
      loadUsers();
      break;
    case 'audit':
      pageTitle.textContent = 'Security & Activity Audit Logs';
      document.getElementById('view-audit').classList.remove('d-none');
      loadAuditLogs();
      break;
    default:
      switchView('dashboard');
  }
}

// ---------------------------------------------------------
// 1. DASHBOARD LOAD & CHARTS
// ---------------------------------------------------------
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) return;

    const data = await res.json();
    const kpis = data.kpis;

    document.getElementById('kpi-customers').textContent = kpis.totalCustomers;
    document.getElementById('kpi-leads').textContent = kpis.openLeads;
    document.getElementById('kpi-opps').textContent = kpis.openOpportunities;
    document.getElementById('kpi-pipeline').textContent = '$' + Number(kpis.totalPipelineValue).toLocaleString();

    // Render Lead Status Chart
    const ctxLead = document.getElementById('chart-lead-status')?.getContext('2d');
    if (ctxLead) {
      if (leadStatusChart) leadStatusChart.destroy();
      leadStatusChart = new Chart(ctxLead, {
        type: 'doughnut',
        data: {
          labels: data.charts.leadStatus.labels,
          datasets: [{
            data: data.charts.leadStatus.data,
            backgroundColor: ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    // Render Opportunity Pipeline Chart
    const ctxOpp = document.getElementById('chart-pipeline')?.getContext('2d');
    if (ctxOpp) {
      if (oppPipelineChart) oppPipelineChart.destroy();
      oppPipelineChart = new Chart(ctxOpp, {
        type: 'bar',
        data: {
          labels: data.charts.oppPipeline.labels,
          datasets: [{
            label: 'Pipeline Amount ($)',
            data: data.charts.oppPipeline.amounts,
            backgroundColor: '#4f46e5',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }

  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// ---------------------------------------------------------
// 2. CUSTOMER MANAGEMENT MODULE
// ---------------------------------------------------------
async function loadCustomers() {
  try {
    const q = document.getElementById('cust-search')?.value || '';
    const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}`);
    if (!res.ok) return;

    const customers = await res.json();
    const tbody = document.getElementById('cust-tbody');
    tbody.innerHTML = '';

    if (customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No customers found.</td></tr>`;
      return;
    }

    customers.forEach(c => {
      const isSalesExec = currentUser.Role === 'SalesExecutive';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-semibold text-primary">${escapeHtml(c.CustomerCode)}</td>
        <td class="fw-bold">${escapeHtml(c.CustomerName)}</td>
        <td>${escapeHtml(c.Email)}</td>
        <td>${escapeHtml(c.Phone)}</td>
        <td>${escapeHtml(c.CompanyName || '-')}</td>
        <td><span class="badge ${c.Status === 'Active' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}">${escapeHtml(c.Status)}</span></td>
        <td><span class="badge bg-light text-dark">User #${c.AssignedTo}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editCustomer(${c.CustomerId})">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          ${!isSalesExec ? `
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCustomer(${c.CustomerId})">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

let customerModalObj = null;

function openCustomerModal(cust = null) {
  if (!customerModalObj) {
    customerModalObj = new bootstrap.Modal(document.getElementById('customerModal'));
  }

  document.getElementById('customer-form').reset();
  document.getElementById('customer-form').classList.remove('was-validated');

  if (cust) {
    document.getElementById('customerModalTitle').textContent = 'Edit Customer';
    document.getElementById('cust-id').value = cust.CustomerId;
    document.getElementById('cust-name').value = cust.CustomerName;
    document.getElementById('cust-email').value = cust.Email;
    document.getElementById('cust-phone').value = cust.Phone;
    document.getElementById('cust-company').value = cust.CompanyName || '';
    document.getElementById('cust-address').value = cust.Address || '';
    document.getElementById('cust-city').value = cust.City || '';
    document.getElementById('cust-status').value = cust.Status || 'Active';
  } else {
    document.getElementById('customerModalTitle').textContent = 'Add New Customer';
    document.getElementById('cust-id').value = '';
  }

  customerModalObj.show();
}

async function editCustomer(id) {
  try {
    const res = await fetch(`/api/customers/${id}`);
    if (res.ok) {
      const cust = await res.json();
      openCustomerModal(cust);
    } else {
      showToast('Unable to fetch customer details.', 'danger');
    }
  } catch (err) {
    showToast('Network error.', 'danger');
  }
}

async function deleteCustomer(id) {
  if (!confirm('Are you sure you want to delete this customer record?')) return;
  try {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast('Customer deleted successfully.');
      loadCustomers();
    } else {
      showToast(data.error || 'Delete failed.', 'danger');
    }
  } catch (err) {
    showToast('Delete failed.', 'danger');
  }
}

function setupCustomerForm() {
  const form = document.getElementById('customer-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('cust-name').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const company = document.getElementById('cust-company').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const city = document.getElementById('cust-city').value.trim();
    const status = document.getElementById('cust-status').value;
    const custId = document.getElementById('cust-id').value;

    // Client-side Validation Checks
    let valid = true;
    if (!name || name.length > 100) valid = false;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) valid = false;
    if (!phone || !/^[0-9]{10}$/.test(phone)) valid = false;

    if (!valid) {
      form.classList.add('was-validated');
      return;
    }

    const payload = {
      CustomerName: name,
      Email: email,
      Phone: phone,
      CompanyName: company,
      Address: address,
      City: city,
      Status: status
    };

    const method = custId ? 'PUT' : 'POST';
    const url = custId ? `/api/customers/${custId}` : '/api/customers';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to save customer.', 'danger');
      } else {
        showToast(custId ? 'Customer updated.' : 'Customer created successfully.');
        customerModalObj.hide();
        loadCustomers();
      }
    } catch (err) {
      showToast('Error saving customer.', 'danger');
    }
  });
}

// ---------------------------------------------------------
// 3. LEAD MANAGEMENT MODULE
// ---------------------------------------------------------
async function loadLeads() {
  try {
    const q = document.getElementById('lead-search')?.value || '';
    const res = await fetch(`/api/leads?search=${encodeURIComponent(q)}`);
    if (!res.ok) return;

    const leads = await res.json();
    const tbody = document.getElementById('lead-tbody');
    tbody.innerHTML = '';

    if (leads.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No leads found.</td></tr>`;
      return;
    }

    leads.forEach(l => {
      const tr = document.createElement('tr');
      const badgeClass = l.Status === 'Converted' ? 'bg-success text-white' : 
                         (l.Status === 'Qualified' ? 'bg-info text-dark' : 'bg-secondary text-white');

      tr.innerHTML = `
        <td class="fw-semibold text-primary">${escapeHtml(l.LeadCode)}</td>
        <td class="fw-bold">${escapeHtml(l.LeadName)}</td>
        <td>${escapeHtml(l.CompanyName || '-')}</td>
        <td><span class="badge bg-light text-dark">${escapeHtml(l.Source)}</span></td>
        <td><span class="badge ${badgeClass}">${escapeHtml(l.Status)}</span></td>
        <td class="fw-semibold">$${Number(l.ExpectedValue).toLocaleString()}</td>
        <td><span class="badge bg-light text-dark">User #${l.AssignedTo}</span></td>
        <td class="text-end">
          ${l.Status !== 'Converted' ? `
            <button class="btn btn-sm btn-success me-1" onclick="convertLead(${l.LeadId})" title="Convert to Customer & Opportunity">
              <i class="fa-solid fa-arrows-spin me-1"></i> Convert
            </button>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editLead(${l.LeadId})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
          ` : '<span class="text-muted extra-small me-2"><i class="fa-solid fa-circle-check text-success me-1"></i>Converted</span>'}
          ${['Admin', 'Manager'].includes(currentUser.Role) ? `
            <button class="btn btn-sm btn-outline-danger" onclick="deleteLead(${l.LeadId})">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading leads:', err);
  }
}

let leadModalObj = null;

function openLeadModal(lead = null) {
  if (!leadModalObj) {
    leadModalObj = new bootstrap.Modal(document.getElementById('leadModal'));
  }

  document.getElementById('lead-form').reset();
  document.getElementById('lead-form').classList.remove('was-validated');

  if (lead) {
    document.getElementById('leadModalTitle').textContent = 'Edit Lead';
    document.getElementById('lead-id').value = lead.LeadId;
    document.getElementById('lead-name').value = lead.LeadName;
    document.getElementById('lead-email').value = lead.Email || '';
    document.getElementById('lead-phone').value = lead.Phone || '';
    document.getElementById('lead-company').value = lead.CompanyName || '';
    document.getElementById('lead-status').value = lead.Status || 'New';
    document.getElementById('lead-value').value = lead.ExpectedValue || 10000;
  } else {
    document.getElementById('leadModalTitle').textContent = 'Add New Lead';
    document.getElementById('lead-id').value = '';
  }

  leadModalObj.show();
}

async function editLead(id) {
  try {
    const res = await fetch('/api/leads');
    if (res.ok) {
      const leads = await res.json();
      const lead = leads.find(l => l.LeadId === id);
      if (lead) openLeadModal(lead);
    }
  } catch (err) {
    showToast('Error fetching lead.', 'danger');
  }
}

async function deleteLead(id) {
  if (!confirm('Are you sure you want to delete this lead?')) return;
  try {
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast('Lead deleted.');
      loadLeads();
    } else {
      showToast(data.error || 'Delete failed.', 'danger');
    }
  } catch (err) {
    showToast('Delete failed.', 'danger');
  }
}

async function convertLead(id) {
  if (!confirm('Convert this lead into an active Customer and Sales Opportunity?')) return;
  try {
    const res = await fetch(`/api/leads/${id}/convert`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
      loadLeads();
    } else {
      showToast(data.error || 'Conversion failed.', 'danger');
    }
  } catch (err) {
    showToast('Conversion failed.', 'danger');
  }
}

function setupLeadForm() {
  const form = document.getElementById('lead-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('lead-name').value.trim();
    const email = document.getElementById('lead-email').value.trim();
    const phone = document.getElementById('lead-phone').value.trim();
    const company = document.getElementById('lead-company').value.trim();
    const status = document.getElementById('lead-status').value;
    const value = document.getElementById('lead-value').value;
    const leadId = document.getElementById('lead-id').value;

    let valid = true;
    if (!name) valid = false;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) valid = false;
    if (phone && !/^[0-9]{10}$/.test(phone)) valid = false;
    if (isNaN(parseFloat(value)) || parseFloat(value) < 0) valid = false;

    if (!valid) {
      form.classList.add('was-validated');
      return;
    }

    const payload = {
      LeadName: name,
      Email: email,
      Phone: phone,
      CompanyName: company,
      Status: status,
      ExpectedValue: parseFloat(value)
    };

    const method = leadId ? 'PUT' : 'POST';
    const url = leadId ? `/api/leads/${leadId}` : '/api/leads';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Save failed.', 'danger');
      } else {
        showToast(leadId ? 'Lead updated.' : 'Lead created successfully.');
        leadModalObj.hide();
        loadLeads();
      }
    } catch (err) {
      showToast('Save failed.', 'danger');
    }
  });
}

// ---------------------------------------------------------
// 4. OPPORTUNITY MANAGEMENT & BUSINESS RULES
// ---------------------------------------------------------
async function loadOpportunities() {
  try {
    const q = document.getElementById('opp-search')?.value || '';
    const res = await fetch(`/api/opportunities?search=${encodeURIComponent(q)}`);
    if (!res.ok) return;

    const opps = await res.json();
    const tbody = document.getElementById('opp-tbody');
    tbody.innerHTML = '';

    if (opps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No opportunities found.</td></tr>`;
      return;
    }

    opps.forEach(o => {
      const tr = document.createElement('tr');
      const stageBadge = o.Stage === 'Won' ? 'bg-success text-white' :
                         (o.Stage === 'Lost' ? 'bg-danger text-white' : 'bg-primary text-white');

      tr.innerHTML = `
        <td class="fw-bold">${escapeHtml(o.OpportunityName)}</td>
        <td>${escapeHtml(o.CustomerName)}</td>
        <td><span class="badge ${stageBadge}">${escapeHtml(o.Stage)}</span></td>
        <td class="fw-semibold text-dark">$${Number(o.Amount).toLocaleString()}</td>
        <td>${o.Probability}%</td>
        <td class="fw-semibold text-success">$${Number(o.WeightedAmount).toLocaleString()}</td>
        <td>${escapeHtml(o.ExpectedCloseDate)}</td>
        <td><span class="badge bg-light text-dark">${escapeHtml(o.Status)}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editOpp(${o.OpportunityId})">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          ${['Admin', 'Manager'].includes(currentUser.Role) ? `
            <button class="btn btn-sm btn-outline-danger" onclick="deleteOpp(${o.OpportunityId})">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading opportunities:', err);
  }
}

let oppModalObj = null;

async function openOppModal(opp = null) {
  if (!oppModalObj) {
    oppModalObj = new bootstrap.Modal(document.getElementById('oppModal'));
  }

  // Populate Customer Dropdown
  const custRes = await fetch('/api/customers');
  const customers = await custRes.json();
  const select = document.getElementById('opp-customer');
  select.innerHTML = '<option value="">-- Select Customer --</option>';
  customers.forEach(c => {
    select.innerHTML += `<option value="${c.CustomerId}">${escapeHtml(c.CustomerName)} (${c.CustomerCode})</option>`;
  });

  document.getElementById('opp-form').reset();
  document.getElementById('opp-form').classList.remove('was-validated');

  // Set default minimum date to today for active close dates
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('opp-date').value = todayStr;

  if (opp) {
    document.getElementById('oppModalTitle').textContent = 'Edit Opportunity';
    document.getElementById('opp-id').value = opp.OpportunityId;
    document.getElementById('opp-name').value = opp.OpportunityName;
    document.getElementById('opp-customer').value = opp.CustomerId;
    document.getElementById('opp-amount').value = opp.Amount;
    document.getElementById('opp-prob').value = opp.Probability;
    document.getElementById('opp-stage').value = opp.Stage;
    document.getElementById('opp-date').value = opp.ExpectedCloseDate;
  } else {
    document.getElementById('oppModalTitle').textContent = 'Add Sales Opportunity';
    document.getElementById('opp-id').value = '';
  }

  oppModalObj.show();
}

async function editOpp(id) {
  try {
    const res = await fetch('/api/opportunities');
    if (res.ok) {
      const opps = await res.json();
      const opp = opps.find(o => o.OpportunityId === id);
      if (opp) openOppModal(opp);
    }
  } catch (err) {
    showToast('Error loading opportunity.', 'danger');
  }
}

async function deleteOpp(id) {
  if (!confirm('Are you sure you want to delete this opportunity?')) return;
  try {
    const res = await fetch(`/api/opportunities/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast('Opportunity deleted.');
      loadOpportunities();
    } else {
      showToast(data.error || 'Delete failed.', 'danger');
    }
  } catch (err) {
    showToast('Delete failed.', 'danger');
  }
}

function setupOppForm() {
  const form = document.getElementById('opp-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('opp-name').value.trim();
    const customerId = document.getElementById('opp-customer').value;
    const amount = parseFloat(document.getElementById('opp-amount').value);
    const prob = parseFloat(document.getElementById('opp-prob').value);
    const stage = document.getElementById('opp-stage').value;
    const closeDate = document.getElementById('opp-date').value;
    const oppId = document.getElementById('opp-id').value;

    const todayStr = new Date().toISOString().split('T')[0];

    // Client-side Validation for Mandatory Business Rules
    let valid = true;
    if (!name || !customerId) valid = false;
    if (isNaN(amount) || amount <= 0) valid = false; // Amount MUST be > 0
    if (isNaN(prob) || prob < 0 || prob > 100) valid = false; // Probability 0..100
    if (!closeDate || (closeDate < todayStr && stage !== 'Won' && stage !== 'Lost')) valid = false; // Close date not in past

    if (!valid) {
      form.classList.add('was-validated');
      return;
    }

    const payload = {
      OpportunityName: name,
      CustomerId: parseInt(customerId),
      Amount: amount,
      Probability: prob,
      Stage: stage,
      ExpectedCloseDate: closeDate
    };

    const method = oppId ? 'PUT' : 'POST';
    const url = oppId ? `/api/opportunities/${oppId}` : '/api/opportunities';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to save opportunity.', 'danger');
      } else {
        showToast(oppId ? 'Opportunity updated.' : 'Opportunity created successfully.');
        oppModalObj.hide();
        loadOpportunities();
      }
    } catch (err) {
      showToast('Save failed.', 'danger');
    }
  });
}

// ---------------------------------------------------------
// 5. FOLLOW-UP MANAGEMENT & BUSINESS RULES
// ---------------------------------------------------------
async function loadFollowups() {
  try {
    const res = await fetch('/api/followups');
    if (!res.ok) return;

    const followups = await res.json();
    const tbody = document.getElementById('followup-tbody');
    tbody.innerHTML = '';

    if (followups.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No scheduled follow-up activities.</td></tr>`;
      return;
    }

    followups.forEach(f => {
      const tr = document.createElement('tr');
      const badgeClass = f.Status === 'Completed' ? 'bg-success text-white' :
                         (f.IsOverdue ? 'bg-danger text-white' : 'bg-warning text-dark');

      tr.innerHTML = `
        <td class="fw-semibold">${escapeHtml(f.FollowUpDate)} ${f.IsOverdue ? '<span class="badge bg-danger ms-1">OVERDUE</span>' : ''}</td>
        <td><span class="badge bg-light text-dark"><i class="fa-solid fa-tasks me-1"></i>${escapeHtml(f.FollowUpType)}</span></td>
        <td class="fw-bold">${escapeHtml(f.Subject)}</td>
        <td>${escapeHtml(f.Remarks || '-')}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(f.Status)}</span></td>
        <td class="text-end">
          ${f.Status === 'Planned' ? `
            <button class="btn btn-sm btn-success" onclick="completeFollowup(${f.FollowUpId})">
              <i class="fa-solid fa-check me-1"></i> Mark Complete
            </button>
          ` : '<span class="text-muted extra-small"><i class="fa-solid fa-circle-check text-success me-1"></i>Completed</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading followups:', err);
  }
}

let followupModalObj = null;

function openFollowupModal() {
  if (!followupModalObj) {
    followupModalObj = new bootstrap.Modal(document.getElementById('followupModal'));
  }

  document.getElementById('followup-form').reset();
  document.getElementById('followup-form').classList.remove('was-validated');

  // Business Validation: Follow up date cannot be earlier than today
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('follow-date').value = todayStr;

  followupModalObj.show();
}

async function completeFollowup(id) {
  try {
    const res = await fetch(`/api/followups/${id}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Remarks: 'Completed via dashboard action' })
    });
    if (res.ok) {
      showToast('Follow-up marked as completed.');
      loadFollowups();
    } else {
      showToast('Action failed.', 'danger');
    }
  } catch (err) {
    showToast('Action failed.', 'danger');
  }
}

function setupFollowupForm() {
  const form = document.getElementById('followup-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const subject = document.getElementById('follow-subject').value.trim();
    const date = document.getElementById('follow-date').value;
    const type = document.getElementById('follow-type').value;
    const remarks = document.getElementById('follow-remarks').value.trim();

    const todayStr = new Date().toISOString().split('T')[0];

    // Mandatory Business Rule: Date cannot be earlier than today
    let valid = true;
    if (!subject) valid = false;
    if (!date || date < todayStr) valid = false;

    if (!valid) {
      form.classList.add('was-validated');
      return;
    }

    const payload = {
      Subject: subject,
      FollowUpDate: date,
      FollowUpType: type,
      Remarks: remarks,
      Status: 'Planned'
    };

    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to schedule follow-up.', 'danger');
      } else {
        showToast('Follow-up scheduled successfully.');
        followupModalObj.hide();
        loadFollowups();
      }
    } catch (err) {
      showToast('Schedule failed.', 'danger');
    }
  });
}

// ---------------------------------------------------------
// 6. REPORTS & ANALYTICS
// ---------------------------------------------------------
async function loadReports() {
  try {
    const pipelineRes = await fetch('/api/reports/pipeline');
    const summaryRes = await fetch('/api/reports/summary');

    if (pipelineRes.ok) {
      const pipelineData = await pipelineRes.json();
      const tbody = document.getElementById('report-pipeline-tbody');
      tbody.innerHTML = '';
      pipelineData.forEach(p => {
        tbody.innerHTML += `
          <tr>
            <td class="fw-bold">${escapeHtml(p.Stage)}</td>
            <td><span class="badge bg-secondary">${p.Count}</span></td>
            <td>$${Number(p.TotalAmount).toLocaleString()}</td>
            <td class="fw-semibold text-success">$${Number(p.WeightedTotal).toLocaleString()}</td>
          </tr>
        `;
      });
    }

    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      const list = document.getElementById('report-summary-list');
      list.innerHTML = `
        <li class="list-group-item d-flex justify-content-between align-items-center py-3">
          <span><i class="fa-solid fa-users me-2 text-primary"></i>Total Managed Customers</span>
          <span class="badge bg-primary rounded-pill fs-6">${summary.totalCustomers}</span>
        </li>
        <li class="list-group-item d-flex justify-content-between align-items-center py-3">
          <span><i class="fa-solid fa-filter-circle-dollar me-2 text-info"></i>Total Pipeline Leads</span>
          <span class="badge bg-info rounded-pill fs-6">${summary.totalLeads}</span>
        </li>
        <li class="list-group-item d-flex justify-content-between align-items-center py-3">
          <span><i class="fa-solid fa-circle-check me-2 text-success"></i>Converted Leads Count</span>
          <span class="badge bg-success rounded-pill fs-6">${summary.convertedLeads}</span>
        </li>
        <li class="list-group-item d-flex justify-content-between align-items-center py-3">
          <span><i class="fa-solid fa-percent me-2 text-warning"></i>Lead Conversion Rate</span>
          <span class="badge bg-warning text-dark rounded-pill fs-6">${summary.conversionRate}</span>
        </li>
        <li class="list-group-item d-flex justify-content-between align-items-center py-3">
          <span><i class="fa-solid fa-sack-dollar me-2 text-success"></i>Won Opportunities Revenue</span>
          <span class="fw-bold text-success fs-6">$${Number(summary.wonOppsAmount).toLocaleString()}</span>
        </li>
      `;
    }
  } catch (err) {
    console.error('Error loading reports:', err);
  }
}

// ---------------------------------------------------------
// 7. USER MANAGEMENT (ADMIN ONLY)
// ---------------------------------------------------------
async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) return;

    const users = await res.json();
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';

    users.forEach(u => {
      const isLocked = u.LockoutEnd && new Date(u.LockoutEnd) > new Date();
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td class="fw-bold">#${u.UserId}</td>
        <td>${escapeHtml(u.Name)}</td>
        <td>${escapeHtml(u.Email)}</td>
        <td>
          <select class="form-select form-select-sm" onchange="updateUserRole(${u.UserId}, this.value)">
            <option value="Admin" ${u.Role === 'Admin' ? 'selected' : ''}>Admin</option>
            <option value="Manager" ${u.Role === 'Manager' ? 'selected' : ''}>Manager</option>
            <option value="SalesExecutive" ${u.Role === 'SalesExecutive' ? 'selected' : ''}>SalesExecutive</option>
          </select>
        </td>
        <td>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" ${u.IsActive ? 'checked' : ''} onchange="toggleUserActive(${u.UserId}, this.checked)">
            <label class="form-check-label small">${u.IsActive ? 'Active' : 'Inactive'}</label>
          </div>
        </td>
        <td>
          ${isLocked ? `<span class="badge bg-danger">Locked</span>` : `<span class="badge bg-success">OK</span>`}
        </td>
        <td class="text-end">
          ${isLocked ? `
            <button class="btn btn-sm btn-outline-warning text-dark" onclick="unlockUser(${u.UserId})">
              <i class="fa-solid fa-lock-open me-1"></i> Unlock
            </button>
          ` : '<span class="text-muted extra-small">No Lock</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

async function updateUserRole(userId, newRole) {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Role: newRole })
    });
    if (res.ok) {
      showToast('User role updated successfully.');
      loadUsers();
    } else {
      showToast('Failed to update user role.', 'danger');
    }
  } catch (err) {
    showToast('Failed to update role.', 'danger');
  }
}

async function toggleUserActive(userId, isActive) {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IsActive: isActive })
    });
    if (res.ok) {
      showToast(`User account ${isActive ? 'activated' : 'deactivated'}.`);
      loadUsers();
    } else {
      showToast('Status update failed.', 'danger');
    }
  } catch (err) {
    showToast('Status update failed.', 'danger');
  }
}

async function unlockUser(userId) {
  try {
    const res = await fetch(`/api/users/${userId}/unlock`, { method: 'POST' });
    if (res.ok) {
      showToast('User account unlocked successfully.');
      loadUsers();
    } else {
      showToast('Unlock failed.', 'danger');
    }
  } catch (err) {
    showToast('Unlock failed.', 'danger');
  }
}

// ---------------------------------------------------------
// 8. AUDIT LOGS VIEW
// ---------------------------------------------------------
async function loadAuditLogs() {
  try {
    const res = await fetch('/api/audit');
    if (!res.ok) return;

    const logs = await res.json();
    const tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No audit records found.</td></tr>`;
      return;
    }

    logs.forEach(l => {
      const tr = document.createElement('tr');
      const actionBadge = l.Action.includes('Failed') || l.Action.includes('Lockout') ? 'bg-danger text-white' :
                          (l.Action.includes('Create') ? 'bg-success text-white' : 'bg-primary text-white');

      tr.innerHTML = `
        <td class="fw-bold">#${l.AuditLogId}</td>
        <td>${new Date(l.CreatedDate).toLocaleString()}</td>
        <td>User #${l.UserId || 'System'}</td>
        <td><span class="badge ${actionBadge}">${escapeHtml(l.Action)}</span></td>
        <td><span class="badge bg-light text-dark">${escapeHtml(l.EntityName)}</span></td>
        <td>#${escapeHtml(l.RecordId)}</td>
        <td class="text-truncate" style="max-width: 250px;" title="${escapeHtml(l.NewValue)}">${escapeHtml(l.NewValue || '-')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading audit logs:', err);
  }
}

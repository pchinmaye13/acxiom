const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'AcxiomCRM_Secure_JWT_Secret_2026_Key!';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------
// HELPER VALIDATORS & UTILS
// ---------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/; // 10-digit mobile pattern

function validatePasswordPolicy(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit.';
  }
  return null;
}

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format DTO for User (strips password hash)
function toUserDto(user) {
  if (!user) return null;
  const { PasswordHash, ...dto } = user;
  return dto;
}

// ---------------------------------------------------------
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ---------------------------------------------------------
function authenticateToken(req, res, next) {
  let token = req.cookies.token;
  if (!token && req.headers['authorization']) {
    const authHeader = req.headers['authorization'];
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const data = db.read();
    const user = data.users.find(u => u.UserId === decoded.UserId);

    if (!user || !user.IsActive) {
      return res.status(401).json({ error: 'Unauthorized: Account inactive or invalid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.Role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions.' });
    }
    next();
  };
}

// Data Scoping Helper for Sales Executive vs Manager/Admin
function applyRoleDataScope(list, reqUser, assignedField = 'AssignedTo') {
  if (reqUser.Role === 'SalesExecutive') {
    return list.filter(item => item[assignedField] === reqUser.UserId);
  }
  return list; // Admin and Manager see all team records
}

// ---------------------------------------------------------
// 1. AUTHENTICATION & SECURITY ENDPOINTS (REAL)
// ---------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const data = db.read();
  const user = data.users.find(u => u.Email.toLowerCase() === email.toLowerCase());

  if (!user) {
    db.logAudit(null, 'Login Failed', 'User', email, null, 'User not found', clientIp);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Check Account Lockout
  if (user.LockoutEnd && new Date(user.LockoutEnd) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.LockoutEnd) - new Date()) / 60000);
    db.logAudit(user.UserId, 'Login Blocked (Locked)', 'User', user.UserId, null, `Lockout active for ${minutesLeft} mins`, clientIp);
    return res.status(403).json({ error: `Account locked due to multiple failed attempts. Try again in ${minutesLeft} minutes or contact Admin.` });
  }

  // Check Account Active Status
  if (!user.IsActive) {
    db.logAudit(user.UserId, 'Login Blocked (Inactive)', 'User', user.UserId, null, 'Account deactivated', clientIp);
    return res.status(403).json({ error: 'Account is deactivated. Please contact administrator.' });
  }

  // Verify Password
  const isMatch = bcrypt.compareSync(password, user.PasswordHash);
  if (!isMatch) {
    user.FailedLoginCount = (user.FailedLoginCount || 0) + 1;
    let lockoutMsg = '';
    
    if (user.FailedLoginCount >= 5) {
      const lockoutEnd = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      user.LockoutEnd = lockoutEnd;
      lockoutMsg = ' Account locked for 15 minutes.';
      db.logAudit(user.UserId, 'Account Lockout Triggered', 'User', user.UserId, null, 'Exceeded 5 failed attempts', clientIp);
    } else {
      db.logAudit(user.UserId, 'Login Failed', 'User', user.UserId, null, `Failed attempt ${user.FailedLoginCount}/5`, clientIp);
    }
    db.write(data);

    return res.status(401).json({ error: `Invalid email or password.${lockoutMsg}` });
  }

  // Reset Lockout & Failed Counter on successful login
  user.FailedLoginCount = 0;
  user.LockoutEnd = null;
  db.write(data);

  // Generate JWT Token
  const token = jwt.sign(
    { UserId: user.UserId, Email: user.Email, Role: user.Role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 8 * 3600 * 1000
  });

  db.logAudit(user.UserId, 'Login Success', 'User', user.UserId, null, `Logged in as ${user.Role}`, clientIp);

  return res.json({
    message: 'Login successful',
    token: token,
    user: toUserDto(user)
  });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  db.logAudit(req.user.UserId, 'Logout', 'User', req.user.UserId, null, 'User logged out', req.ip || '127.0.0.1');
  res.clearCookie('token');
  return res.json({ message: 'Logout successful' });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  return res.json({ user: toUserDto(req.user) });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const passErr = validatePasswordPolicy(password);
  if (passErr) {
    return res.status(400).json({ error: passErr });
  }

  const data = db.read();
  if (data.users.some(u => u.Email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'User with this email already exists.' });
  }

  const validRoles = ['Admin', 'Manager', 'SalesExecutive'];
  const userRole = validRoles.includes(role) ? role : 'SalesExecutive';

  const newUserId = data.users.length > 0 ? Math.max(...data.users.map(u => u.UserId)) + 1 : 1;
  const passwordHash = bcrypt.hashSync(password, 10);

  const newUser = {
    UserId: newUserId,
    Name: name.trim(),
    Email: email.toLowerCase().trim(),
    PasswordHash: passwordHash,
    Role: userRole,
    IsActive: true,
    FailedLoginCount: 0,
    LockoutEnd: null,
    CreatedDate: new Date().toISOString()
  };

  data.users.push(newUser);
  db.write(data);

  db.logAudit(null, 'User Registration', 'User', newUserId, null, `Registered new user ${email} with role ${userRole}`, req.ip || '127.0.0.1');

  return res.status(201).json({
    message: 'User registered successfully',
    user: toUserDto(newUser)
  });
});

// ---------------------------------------------------------
// 2. DASHBOARD API (REAL)
// ---------------------------------------------------------
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const data = db.read();
  const scopedCustomers = applyRoleDataScope(data.customers, req.user, 'AssignedTo');
  const scopedLeads = applyRoleDataScope(data.leads, req.user, 'AssignedTo');
  const scopedOpps = applyRoleDataScope(data.opportunities, req.user, 'AssignedTo');
  const scopedFollowups = applyRoleDataScope(data.followups, req.user, 'AssignedTo');

  // KPI Metrics
  const totalCustomers = scopedCustomers.length;
  const totalLeads = scopedLeads.length;
  const openLeads = scopedLeads.filter(l => !['Converted', 'Lost', 'Unqualified'].includes(l.Status)).length;
  const totalOpportunities = scopedOpps.length;
  const openOpportunities = scopedOpps.filter(o => o.Status === 'Open').length;
  const wonOpportunities = scopedOpps.filter(o => o.Stage === 'Won' || o.Status === 'Won').length;
  const lostOpportunities = scopedOpps.filter(o => o.Stage === 'Lost' || o.Status === 'Lost').length;
  const totalPipelineValue = scopedOpps
    .filter(o => o.Status === 'Open')
    .reduce((sum, o) => sum + (parseFloat(o.Amount) || 0), 0);

  // Chart Data
  const leadStatuses = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
  const leadStatusCounts = leadStatuses.map(status => scopedLeads.filter(l => l.Status === status).length);

  const oppStages = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  const oppStageCounts = oppStages.map(stage => scopedOpps.filter(o => o.Stage === stage).length);
  const oppStageAmounts = oppStages.map(stage => 
    scopedOpps.filter(o => o.Stage === stage).reduce((s, o) => s + (parseFloat(o.Amount) || 0), 0)
  );

  return res.json({
    kpis: {
      totalCustomers,
      totalLeads,
      openLeads,
      totalOpportunities,
      openOpportunities,
      wonOpportunities,
      lostOpportunities,
      totalPipelineValue,
      pendingFollowUps: scopedFollowups.filter(f => f.Status === 'Planned').length
    },
    charts: {
      leadStatus: { labels: leadStatuses, data: leadStatusCounts },
      oppPipeline: { labels: oppStages, counts: oppStageCounts, amounts: oppStageAmounts }
    }
  });
});

// ---------------------------------------------------------
// 3. CUSTOMER MANAGEMENT APIs (REAL)
// ---------------------------------------------------------
app.get('/api/customers', authenticateToken, (req, res) => {
  const data = db.read();
  let customers = applyRoleDataScope(data.customers, req.user, 'AssignedTo');

  const { search, status } = req.query;
  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter(c => 
      c.CustomerName.toLowerCase().includes(q) ||
      c.Email.toLowerCase().includes(q) ||
      c.Phone.includes(q) ||
      (c.CompanyName && c.CompanyName.toLowerCase().includes(q))
    );
  }
  if (status) {
    customers = customers.filter(c => c.Status === status);
  }

  return res.json(customers);
});

app.get('/api/customers/:id', authenticateToken, (req, res) => {
  const data = db.read();
  const cust = data.customers.find(c => c.CustomerId === parseInt(req.params.id));
  if (!cust) return res.status(404).json({ error: 'Customer not found.' });

  if (req.user.Role === 'SalesExecutive' && cust.AssignedTo !== req.user.UserId) {
    return res.status(403).json({ error: 'Access denied: Customer assigned to another user.' });
  }

  return res.json(cust);
});

app.post('/api/customers', authenticateToken, (req, res) => {
  const { CustomerName, Email, Phone, CompanyName, Address, City, State, Status, AssignedTo } = req.body;

  if (!CustomerName || !CustomerName.trim()) {
    return res.status(400).json({ error: 'Customer Name is required.' });
  }
  if (CustomerName.length > 100) {
    return res.status(400).json({ error: 'Customer Name must not exceed 100 characters.' });
  }
  if (!Email || !Email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  if (!EMAIL_REGEX.test(Email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!Phone || !Phone.trim()) {
    return res.status(400).json({ error: 'Phone is required.' });
  }
  if (!PHONE_REGEX.test(Phone)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  }

  const data = db.read();
  if (data.customers.some(c => c.Email.toLowerCase() === Email.toLowerCase().trim())) {
    return res.status(409).json({ error: 'Customer with this email address already exists.' });
  }
  if (data.customers.some(c => c.Phone.trim() === Phone.trim())) {
    return res.status(409).json({ error: 'Customer with this phone number already exists.' });
  }

  const newId = data.customers.length > 0 ? Math.max(...data.customers.map(c => c.CustomerId)) + 1 : 101;
  const newCode = `CUST-${1000 + (newId - 100)}`;
  const assigned = AssignedTo ? parseInt(AssignedTo) : req.user.UserId;

  const newCustomer = {
    CustomerId: newId,
    CustomerCode: newCode,
    CustomerName: CustomerName.trim(),
    Email: Email.toLowerCase().trim(),
    Phone: Phone.trim(),
    CompanyName: CompanyName ? CompanyName.trim() : '',
    Address: Address ? Address.trim() : '',
    City: City ? City.trim() : '',
    State: State ? State.trim() : '',
    Status: Status || 'Active',
    AssignedTo: assigned,
    CreatedBy: req.user.UserId,
    CreatedDate: new Date().toISOString()
  };

  data.customers.push(newCustomer);
  db.write(data);

  db.logAudit(req.user.UserId, 'Create', 'Customer', newId, null, newCustomer, req.ip || '127.0.0.1');

  return res.status(201).json(newCustomer);
});

app.put('/api/customers/:id', authenticateToken, (req, res) => {
  const custId = parseInt(req.params.id);
  const data = db.read();
  const index = data.customers.findIndex(c => c.CustomerId === custId);
  if (index === -1) return res.status(404).json({ error: 'Customer not found.' });

  const existing = data.customers[index];
  if (req.user.Role === 'SalesExecutive' && existing.AssignedTo !== req.user.UserId) {
    return res.status(403).json({ error: 'Access denied: Cannot edit customers assigned to other sales executives.' });
  }

  const { CustomerName, Email, Phone, CompanyName, Address, City, State, Status, AssignedTo } = req.body;

  if (!CustomerName || !CustomerName.trim()) return res.status(400).json({ error: 'Customer Name is required.' });
  if (!Email || !EMAIL_REGEX.test(Email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!Phone || !PHONE_REGEX.test(Phone)) return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });

  if (data.customers.some(c => c.CustomerId !== custId && c.Email.toLowerCase() === Email.toLowerCase().trim())) {
    return res.status(409).json({ error: 'Another customer with this email address already exists.' });
  }
  if (data.customers.some(c => c.CustomerId !== custId && c.Phone.trim() === Phone.trim())) {
    return res.status(409).json({ error: 'Another customer with this phone number already exists.' });
  }

  const updatedCustomer = {
    ...existing,
    CustomerName: CustomerName.trim(),
    Email: Email.toLowerCase().trim(),
    Phone: Phone.trim(),
    CompanyName: CompanyName ? CompanyName.trim() : '',
    Address: Address ? Address.trim() : '',
    City: City ? City.trim() : '',
    State: State ? State.trim() : '',
    Status: Status || existing.Status,
    AssignedTo: AssignedTo ? parseInt(AssignedTo) : existing.AssignedTo,
    ModifiedDate: new Date().toISOString()
  };

  data.customers[index] = updatedCustomer;
  db.write(data);

  db.logAudit(req.user.UserId, 'Update', 'Customer', custId, existing, updatedCustomer, req.ip || '127.0.0.1');

  return res.json(updatedCustomer);
});

app.delete('/api/customers/:id', authenticateToken, authorizeRoles('Admin', 'Manager'), (req, res) => {
  const custId = parseInt(req.params.id);
  const data = db.read();
  const index = data.customers.findIndex(c => c.CustomerId === custId);
  if (index === -1) return res.status(404).json({ error: 'Customer not found.' });

  const deleted = data.customers.splice(index, 1)[0];
  db.write(data);

  db.logAudit(req.user.UserId, 'Delete', 'Customer', custId, deleted, null, req.ip || '127.0.0.1');

  return res.json({ message: 'Customer deleted successfully.', customer: deleted });
});

// ---------------------------------------------------------
// 4. LEAD MANAGEMENT APIs (REAL)
// ---------------------------------------------------------
app.get('/api/leads', authenticateToken, (req, res) => {
  const data = db.read();
  let leads = applyRoleDataScope(data.leads, req.user, 'AssignedTo');

  const { search, status } = req.query;
  if (search) {
    const q = search.toLowerCase();
    leads = leads.filter(l => 
      l.LeadName.toLowerCase().includes(q) ||
      (l.Email && l.Email.toLowerCase().includes(q)) ||
      (l.CompanyName && l.CompanyName.toLowerCase().includes(q))
    );
  }
  if (status) {
    leads = leads.filter(l => l.Status === status);
  }

  return res.json(leads);
});

app.get('/api/leads/:id', authenticateToken, (req, res) => {
  const data = db.read();
  const lead = data.leads.find(l => l.LeadId === parseInt(req.params.id));
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  if (req.user.Role === 'SalesExecutive' && lead.AssignedTo !== req.user.UserId) {
    return res.status(403).json({ error: 'Access denied: Lead assigned to another user.' });
  }

  return res.json(lead);
});

app.post('/api/leads', authenticateToken, (req, res) => {
  const { LeadName, Email, Phone, CompanyName, Source, Status, ExpectedValue, AssignedTo } = req.body;

  if (!LeadName || !LeadName.trim()) {
    return res.status(400).json({ error: 'Lead Name is required.' });
  }

  if (Email && !EMAIL_REGEX.test(Email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (Phone && !PHONE_REGEX.test(Phone)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  }

  const validStatuses = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
  const leadStatus = validStatuses.includes(Status) ? Status : 'New';

  const expVal = parseFloat(ExpectedValue);
  if (isNaN(expVal) || expVal < 0) {
    return res.status(400).json({ error: 'Expected Value cannot be negative.' });
  }

  const data = db.read();
  const newId = data.leads.length > 0 ? Math.max(...data.leads.map(l => l.LeadId)) + 1 : 201;
  const newCode = `LEAD-${2000 + (newId - 200)}`;

  const newLead = {
    LeadId: newId,
    LeadCode: newCode,
    LeadName: LeadName.trim(),
    Email: Email ? Email.toLowerCase().trim() : '',
    Phone: Phone ? Phone.trim() : '',
    CompanyName: CompanyName ? CompanyName.trim() : '',
    Source: Source || 'Direct',
    Status: leadStatus,
    ExpectedValue: expVal,
    AssignedTo: AssignedTo ? parseInt(AssignedTo) : req.user.UserId,
    CreatedDate: new Date().toISOString()
  };

  data.leads.push(newLead);
  db.write(data);

  db.logAudit(req.user.UserId, 'Create', 'Lead', newId, null, newLead, req.ip || '127.0.0.1');

  return res.status(201).json(newLead);
});

app.put('/api/leads/:id', authenticateToken, (req, res) => {
  const leadId = parseInt(req.params.id);
  const data = db.read();
  const index = data.leads.findIndex(l => l.LeadId === leadId);
  if (index === -1) return res.status(404).json({ error: 'Lead not found.' });

  const existing = data.leads[index];
  if (req.user.Role === 'SalesExecutive' && existing.AssignedTo !== req.user.UserId) {
    return res.status(403).json({ error: 'Access denied: Cannot edit lead assigned to another user.' });
  }

  const { LeadName, Email, Phone, CompanyName, Source, Status, ExpectedValue, AssignedTo } = req.body;

  if (!LeadName || !LeadName.trim()) return res.status(400).json({ error: 'Lead Name is required.' });
  if (Email && !EMAIL_REGEX.test(Email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (Phone && !PHONE_REGEX.test(Phone)) return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });

  const expVal = parseFloat(ExpectedValue);
  if (isNaN(expVal) || expVal < 0) return res.status(400).json({ error: 'Expected Value cannot be negative.' });

  const updatedLead = {
    ...existing,
    LeadName: LeadName.trim(),
    Email: Email ? Email.toLowerCase().trim() : '',
    Phone: Phone ? Phone.trim() : '',
    CompanyName: CompanyName ? CompanyName.trim() : '',
    Source: Source || existing.Source,
    Status: Status || existing.Status,
    ExpectedValue: expVal,
    AssignedTo: AssignedTo ? parseInt(AssignedTo) : existing.AssignedTo
  };

  data.leads[index] = updatedLead;
  db.write(data);

  db.logAudit(req.user.UserId, 'Update', 'Lead', leadId, existing, updatedLead, req.ip || '127.0.0.1');

  return res.json(updatedLead);
});

app.delete('/api/leads/:id', authenticateToken, authorizeRoles('Admin', 'Manager'), (req, res) => {
  const leadId = parseInt(req.params.id);
  const data = db.read();
  const index = data.leads.findIndex(l => l.LeadId === leadId);
  if (index === -1) return res.status(404).json({ error: 'Lead not found.' });

  const deleted = data.leads.splice(index, 1)[0];
  db.write(data);

  db.logAudit(req.user.UserId, 'Delete', 'Lead', leadId, deleted, null, req.ip || '127.0.0.1');

  return res.json({ message: 'Lead deleted successfully.', lead: deleted });
});

// Real Lead Conversion Endpoint
app.post('/api/leads/:id/convert', authenticateToken, (req, res) => {
  const leadId = parseInt(req.params.id);
  const data = db.read();
  const lead = data.leads.find(l => l.LeadId === leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  if (lead.Status === 'Converted') {
    return res.status(400).json({ error: 'This lead has already been converted.' });
  }

  // Create Customer
  const custId = data.customers.length > 0 ? Math.max(...data.customers.map(c => c.CustomerId)) + 1 : 101;
  const newCustomer = {
    CustomerId: custId,
    CustomerCode: `CUST-${1000 + (custId - 100)}`,
    CustomerName: lead.LeadName,
    Email: lead.Email || `lead_${lead.LeadId}@converted.com`,
    Phone: lead.Phone || '9000000000',
    CompanyName: lead.CompanyName || lead.LeadName,
    Address: 'Converted from Lead',
    City: 'N/A',
    State: 'N/A',
    Status: 'Active',
    AssignedTo: lead.AssignedTo,
    CreatedBy: req.user.UserId,
    CreatedDate: new Date().toISOString()
  };
  data.customers.push(newCustomer);

  // Create Opportunity
  const oppId = data.opportunities.length > 0 ? Math.max(...data.opportunities.map(o => o.OpportunityId)) + 1 : 301;
  const newOpp = {
    OpportunityId: oppId,
    OpportunityName: `${lead.CompanyName || lead.LeadName} - Sales Opportunity`,
    CustomerId: custId,
    LeadId: lead.LeadId,
    Amount: lead.ExpectedValue || 10000,
    Stage: 'Qualification',
    Probability: 50,
    ExpectedCloseDate: '2026-12-31',
    Status: 'Open',
    AssignedTo: lead.AssignedTo,
    CreatedDate: new Date().toISOString()
  };
  data.opportunities.push(newOpp);

  // Mark Lead Converted
  lead.Status = 'Converted';
  db.write(data);

  db.logAudit(req.user.UserId, 'Lead Conversion', 'Lead', leadId, 'Status: Qualified', `Converted to Customer ${custId} & Opp ${oppId}`, req.ip || '127.0.0.1');

  return res.json({
    message: 'Lead converted successfully!',
    customer: newCustomer,
    opportunity: newOpp
  });
});

// ---------------------------------------------------------
// 5. OPPORTUNITY MANAGEMENT APIs (REAL)
// ---------------------------------------------------------
app.get('/api/opportunities', authenticateToken, (req, res) => {
  const data = db.read();
  let opps = applyRoleDataScope(data.opportunities, req.user, 'AssignedTo');

  const { search, stage } = req.query;
  if (search) {
    const q = search.toLowerCase();
    opps = opps.filter(o => o.OpportunityName.toLowerCase().includes(q));
  }
  if (stage) {
    opps = opps.filter(o => o.Stage === stage);
  }

  const enhanced = opps.map(o => {
    const cust = data.customers.find(c => c.CustomerId === o.CustomerId);
    return {
      ...o,
      CustomerName: cust ? cust.CustomerName : 'N/A',
      WeightedAmount: Math.round(((parseFloat(o.Amount) || 0) * (parseFloat(o.Probability) || 0)) / 100)
    };
  });

  return res.json(enhanced);
});

app.get('/api/opportunities/:id', authenticateToken, (req, res) => {
  const data = db.read();
  const opp = data.opportunities.find(o => o.OpportunityId === parseInt(req.params.id));
  if (!opp) return res.status(404).json({ error: 'Opportunity not found.' });

  if (req.user.Role === 'SalesExecutive' && opp.AssignedTo !== req.user.UserId) {
    return res.status(403).json({ error: 'Access denied: Opportunity assigned to another user.' });
  }

  return res.json(opp);
});

app.post('/api/opportunities', authenticateToken, (req, res) => {
  const { OpportunityName, CustomerId, Amount, Stage, Probability, ExpectedCloseDate, Status, AssignedTo } = req.body;

  if (!OpportunityName || !OpportunityName.trim()) {
    return res.status(400).json({ error: 'Opportunity Name is required.' });
  }

  const amt = parseFloat(Amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Opportunity Amount must be greater than 0.' });
  }

  const prob = parseFloat(Probability);
  if (isNaN(prob) || prob < 0 || prob > 100) {
    return res.status(400).json({ error: 'Probability must be between 0 and 100.' });
  }

  const todayStr = getTodayString();
  if (ExpectedCloseDate && ExpectedCloseDate < todayStr && (Status !== 'Won' && Status !== 'Lost')) {
    return res.status(400).json({ error: 'Expected Close Date cannot be in the past for active opportunities.' });
  }

  const validStages = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  if (!validStages.includes(Stage)) {
    return res.status(400).json({ error: `Invalid Stage. Select from ${validStages.join(', ')}.` });
  }

  const data = db.read();
  const custId = parseInt(CustomerId);
  if (!data.customers.some(c => c.CustomerId === custId)) {
    return res.status(400).json({ error: 'Select a valid Customer for this opportunity.' });
  }

  const newId = data.opportunities.length > 0 ? Math.max(...data.opportunities.map(o => o.OpportunityId)) + 1 : 301;
  const oppStatus = (Stage === 'Won') ? 'Won' : (Stage === 'Lost' ? 'Lost' : 'Open');

  const newOpp = {
    OpportunityId: newId,
    OpportunityName: OpportunityName.trim(),
    CustomerId: custId,
    LeadId: null,
    Amount: amt,
    Stage: Stage,
    Probability: prob,
    ExpectedCloseDate: ExpectedCloseDate || '2026-12-31',
    Status: Status || oppStatus,
    AssignedTo: AssignedTo ? parseInt(AssignedTo) : req.user.UserId,
    CreatedDate: new Date().toISOString()
  };

  data.opportunities.push(newOpp);
  db.write(data);

  db.logAudit(req.user.UserId, 'Create', 'Opportunity', newId, null, newOpp, req.ip || '127.0.0.1');

  return res.status(201).json(newOpp);
});

app.put('/api/opportunities/:id', authenticateToken, (req, res) => {
  const oppId = parseInt(req.params.id);
  const data = db.read();
  const index = data.opportunities.findIndex(o => o.OpportunityId === oppId);
  if (index === -1) return res.status(404).json({ error: 'Opportunity not found.' });

  const existing = data.opportunities[index];
  if (req.user.Role === 'SalesExecutive' && existing.AssignedTo !== req.user.UserId) {
    return res.status(403).json({ error: 'Access denied: Opportunity assigned to another user.' });
  }

  const { OpportunityName, CustomerId, Amount, Stage, Probability, ExpectedCloseDate, Status, AssignedTo } = req.body;

  if (!OpportunityName || !OpportunityName.trim()) return res.status(400).json({ error: 'Opportunity Name is required.' });

  const amt = parseFloat(Amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Opportunity Amount must be greater than 0.' });

  const prob = parseFloat(Probability);
  if (isNaN(prob) || prob < 0 || prob > 100) return res.status(400).json({ error: 'Probability must be between 0 and 100.' });

  const todayStr = getTodayString();
  const newStage = Stage || existing.Stage;
  const newStatus = (newStage === 'Won') ? 'Won' : (newStage === 'Lost' ? 'Lost' : 'Open');

  if (ExpectedCloseDate && ExpectedCloseDate < todayStr && newStatus === 'Open') {
    return res.status(400).json({ error: 'Expected Close Date cannot be in the past for active opportunities.' });
  }

  const updatedOpp = {
    ...existing,
    OpportunityName: OpportunityName.trim(),
    CustomerId: CustomerId ? parseInt(CustomerId) : existing.CustomerId,
    Amount: amt,
    Stage: newStage,
    Probability: prob,
    ExpectedCloseDate: ExpectedCloseDate || existing.ExpectedCloseDate,
    Status: newStatus,
    AssignedTo: AssignedTo ? parseInt(AssignedTo) : existing.AssignedTo
  };

  data.opportunities[index] = updatedOpp;
  db.write(data);

  db.logAudit(req.user.UserId, 'Update', 'Opportunity', oppId, existing, updatedOpp, req.ip || '127.0.0.1');

  return res.json(updatedOpp);
});

app.delete('/api/opportunities/:id', authenticateToken, authorizeRoles('Admin', 'Manager'), (req, res) => {
  const oppId = parseInt(req.params.id);
  const data = db.read();
  const index = data.opportunities.findIndex(o => o.OpportunityId === oppId);
  if (index === -1) return res.status(404).json({ error: 'Opportunity not found.' });

  const deleted = data.opportunities.splice(index, 1)[0];
  db.write(data);

  db.logAudit(req.user.UserId, 'Delete', 'Opportunity', oppId, deleted, null, req.ip || '127.0.0.1');

  return res.json({ message: 'Opportunity deleted.', opportunity: deleted });
});

// ---------------------------------------------------------
// 6. FOLLOW-UP & ACTIVITY MANAGEMENT APIs (REAL)
// ---------------------------------------------------------
app.get('/api/followups', authenticateToken, (req, res) => {
  const data = db.read();
  let followups = applyRoleDataScope(data.followups, req.user, 'AssignedTo');

  const { status, date } = req.query;
  if (status) {
    followups = followups.filter(f => f.Status === status);
  }
  if (date) {
    followups = followups.filter(f => f.FollowUpDate === date);
  }

  const todayStr = getTodayString();
  const enhanced = followups.map(f => ({
    ...f,
    IsOverdue: f.Status === 'Planned' && f.FollowUpDate < todayStr
  }));

  return res.json(enhanced);
});

app.get('/api/followups/:id', authenticateToken, (req, res) => {
  const data = db.read();
  const f = data.followups.find(item => item.FollowUpId === parseInt(req.params.id));
  if (!f) return res.status(404).json({ error: 'Follow-up not found.' });
  return res.json(f);
});

app.post('/api/followups', authenticateToken, (req, res) => {
  const { CustomerId, LeadId, OpportunityId, FollowUpDate, FollowUpType, Subject, Remarks, Status, AssignedTo } = req.body;

  if (!Subject || !Subject.trim()) {
    return res.status(400).json({ error: 'Follow-Up Subject is required.' });
  }

  if (!FollowUpDate) {
    return res.status(400).json({ error: 'Follow-Up Date is required.' });
  }

  const todayStr = getTodayString();
  const followStatus = Status || 'Planned';

  if (followStatus === 'Planned' && FollowUpDate < todayStr) {
    return res.status(400).json({ error: 'Follow-up date cannot be earlier than today for a new/planned activity.' });
  }

  const data = db.read();
  const newId = data.followups.length > 0 ? Math.max(...data.followups.map(f => f.FollowUpId)) + 1 : 401;

  const newFollowup = {
    FollowUpId: newId,
    CustomerId: CustomerId ? parseInt(CustomerId) : null,
    LeadId: LeadId ? parseInt(LeadId) : null,
    OpportunityId: OpportunityId ? parseInt(OpportunityId) : null,
    FollowUpDate: FollowUpDate,
    FollowUpType: FollowUpType || 'Call',
    Subject: Subject.trim(),
    Remarks: Remarks ? Remarks.trim() : '',
    Status: followStatus,
    AssignedTo: AssignedTo ? parseInt(AssignedTo) : req.user.UserId,
    CreatedDate: new Date().toISOString()
  };

  data.followups.push(newFollowup);
  db.write(data);

  db.logAudit(req.user.UserId, 'Create', 'FollowUp', newId, null, newFollowup, req.ip || '127.0.0.1');

  return res.status(201).json(newFollowup);
});

app.put('/api/followups/:id/complete', authenticateToken, (req, res) => {
  const fId = parseInt(req.params.id);
  const data = db.read();
  const index = data.followups.findIndex(f => f.FollowUpId === fId);
  if (index === -1) return res.status(404).json({ error: 'Follow-up not found.' });

  const existing = data.followups[index];
  const updated = {
    ...existing,
    Status: 'Completed',
    Remarks: req.body.Remarks ? req.body.Remarks : existing.Remarks,
    CompletedDate: new Date().toISOString()
  };

  data.followups[index] = updated;
  db.write(data);

  db.logAudit(req.user.UserId, 'Complete', 'FollowUp', fId, existing, updated, req.ip || '127.0.0.1');

  return res.json(updated);
});

app.delete('/api/followups/:id', authenticateToken, authorizeRoles('Admin', 'Manager'), (req, res) => {
  const fId = parseInt(req.params.id);
  const data = db.read();
  const index = data.followups.findIndex(f => f.FollowUpId === fId);
  if (index === -1) return res.status(404).json({ error: 'Follow-up not found.' });

  const deleted = data.followups.splice(index, 1)[0];
  db.write(data);

  db.logAudit(req.user.UserId, 'Delete', 'FollowUp', fId, deleted, null, req.ip || '127.0.0.1');
  return res.json({ message: 'Follow-up deleted.', followup: deleted });
});

// Real Activity Log APIs (Call, Meeting, Email, Task)
app.get('/api/activities', authenticateToken, (req, res) => {
  const data = db.read();
  const scopedActivities = applyRoleDataScope(data.activities, req.user, 'AssignedTo');
  return res.json(scopedActivities);
});

app.post('/api/activities', authenticateToken, (req, res) => {
  const { ActivityType, Subject, Description, ActivityDate, CustomerId, LeadId, AssignedTo, Status } = req.body;

  if (!Subject || !Subject.trim()) {
    return res.status(400).json({ error: 'Activity Subject is required.' });
  }

  const data = db.read();
  const newId = data.activities.length > 0 ? Math.max(...data.activities.map(a => a.ActivityId)) + 1 : 501;

  const newAct = {
    ActivityId: newId,
    ActivityType: ActivityType || 'Call',
    Subject: Subject.trim(),
    Description: Description ? Description.trim() : '',
    ActivityDate: ActivityDate || getTodayString(),
    CustomerId: CustomerId ? parseInt(CustomerId) : null,
    LeadId: LeadId ? parseInt(LeadId) : null,
    AssignedTo: AssignedTo ? parseInt(AssignedTo) : req.user.UserId,
    Status: Status || 'Completed',
    CreatedDate: new Date().toISOString()
  };

  data.activities.push(newAct);
  db.write(data);

  db.logAudit(req.user.UserId, 'Create', 'Activity', newId, null, newAct, req.ip || '127.0.0.1');

  return res.status(201).json(newAct);
});

// ---------------------------------------------------------
// 7. USER & ROLE MANAGEMENT APIs (REAL - ADMIN)
// ---------------------------------------------------------
app.get('/api/users', authenticateToken, authorizeRoles('Admin', 'Manager'), (req, res) => {
  const data = db.read();
  const userDtos = data.users.map(u => toUserDto(u));
  return res.json(userDtos);
});

app.put('/api/users/:id', authenticateToken, authorizeRoles('Admin'), (req, res) => {
  const userId = parseInt(req.params.id);
  const data = db.read();
  const user = data.users.find(u => u.UserId === userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { Role, IsActive } = req.body;
  const oldRole = user.Role;
  const oldStatus = user.IsActive;

  if (Role && ['Admin', 'Manager', 'SalesExecutive'].includes(Role)) {
    user.Role = Role;
  }
  if (typeof IsActive === 'boolean') {
    user.IsActive = IsActive;
  }

  db.write(data);

  db.logAudit(req.user.UserId, 'Role/Status Update', 'User', userId, `Role:${oldRole}, Active:${oldStatus}`, `Role:${user.Role}, Active:${user.IsActive}`, req.ip || '127.0.0.1');

  return res.json(toUserDto(user));
});

app.post('/api/users/:id/unlock', authenticateToken, authorizeRoles('Admin'), (req, res) => {
  const userId = parseInt(req.params.id);
  const data = db.read();
  const user = data.users.find(u => u.UserId === userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.FailedLoginCount = 0;
  user.LockoutEnd = null;
  db.write(data);

  db.logAudit(req.user.UserId, 'Account Unlock', 'User', userId, 'Locked', 'Unlocked by Admin', req.ip || '127.0.0.1');

  return res.json({ message: 'User account unlocked successfully.', user: toUserDto(user) });
});

// ---------------------------------------------------------
// 8. AUDIT LOG API (REAL - ADMIN & MANAGER)
// ---------------------------------------------------------
app.get('/api/audit', authenticateToken, authorizeRoles('Admin', 'Manager'), (req, res) => {
  const data = db.read();
  let logs = data.auditLogs;

  const { entity, action, userId } = req.query;
  if (entity) {
    logs = logs.filter(l => l.EntityName.toLowerCase() === entity.toLowerCase());
  }
  if (action) {
    logs = logs.filter(l => l.Action.toLowerCase().includes(action.toLowerCase()));
  }
  if (userId) {
    logs = logs.filter(l => l.UserId === parseInt(userId));
  }

  return res.json(logs);
});

// ---------------------------------------------------------
// 9. REPORTS APIs (REAL DATA ENDPOINTS)
// ---------------------------------------------------------
app.get('/api/reports/pipeline', authenticateToken, (req, res) => {
  const data = db.read();
  const opps = applyRoleDataScope(data.opportunities, req.user, 'AssignedTo');

  const stages = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  const report = stages.map(stage => {
    const stageOpps = opps.filter(o => o.Stage === stage);
    const count = stageOpps.length;
    const totalAmount = stageOpps.reduce((sum, o) => sum + (parseFloat(o.Amount) || 0), 0);
    const weightedTotal = stageOpps.reduce((sum, o) => sum + ((parseFloat(o.Amount) || 0) * (parseFloat(o.Probability) || 0) / 100), 0);
    return {
      Stage: stage,
      Count: count,
      TotalAmount: totalAmount,
      WeightedTotal: Math.round(weightedTotal)
    };
  });

  return res.json(report);
});

app.get('/api/reports/summary', authenticateToken, (req, res) => {
  const data = db.read();
  const customers = applyRoleDataScope(data.customers, req.user, 'AssignedTo');
  const leads = applyRoleDataScope(data.leads, req.user, 'AssignedTo');
  const opps = applyRoleDataScope(data.opportunities, req.user, 'AssignedTo');

  return res.json({
    totalCustomers: customers.length,
    totalLeads: leads.length,
    convertedLeads: leads.filter(l => l.Status === 'Converted').length,
    conversionRate: leads.length > 0 ? ((leads.filter(l => l.Status === 'Converted').length / leads.length) * 100).toFixed(1) + '%' : '0%',
    openOppsAmount: opps.filter(o => o.Status === 'Open').reduce((s, o) => s + parseFloat(o.Amount), 0),
    wonOppsAmount: opps.filter(o => o.Status === 'Won' || o.Stage === 'Won').reduce((s, o) => s + parseFloat(o.Amount), 0)
  });
});

app.get('/api/reports/customers', authenticateToken, (req, res) => {
  const data = db.read();
  const scoped = applyRoleDataScope(data.customers, req.user, 'AssignedTo');
  return res.json(scoped.map(c => ({ CustomerCode: c.CustomerCode, Name: c.CustomerName, Email: c.Email, Status: c.Status, CreatedDate: c.CreatedDate })));
});

app.get('/api/reports/leads', authenticateToken, (req, res) => {
  const data = db.read();
  const scoped = applyRoleDataScope(data.leads, req.user, 'AssignedTo');
  return res.json(scoped.map(l => ({ LeadCode: l.LeadCode, Name: l.LeadName, Source: l.Source, Status: l.Status, Value: l.ExpectedValue })));
});

app.get('/api/reports/followups', authenticateToken, (req, res) => {
  const data = db.read();
  const scoped = applyRoleDataScope(data.followups, req.user, 'AssignedTo');
  return res.json(scoped);
});

app.get('/api/reports/opportunities', authenticateToken, (req, res) => {
  const data = db.read();
  const scoped = applyRoleDataScope(data.opportunities, req.user, 'AssignedTo');
  return res.json(scoped);
});

// SPA Fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error.' });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` AcxiomCRM Server running at: http://localhost:${PORT}`);
  console.log(` Default Accounts:`);
  console.log(` - Admin:     admin@acxiom.com / Admin@123`);
  console.log(` - Manager:   manager@acxiom.com / Manager@123`);
  console.log(` - SalesExec: sales@acxiom.com / Sales@123`);
  console.log(`====================================================`);
});

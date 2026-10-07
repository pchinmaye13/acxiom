const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data.json');

// Initial database state containing ONLY necessary system seed data (default role users)
function getInitialData() {
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('Admin@123', salt);
  const managerHash = bcrypt.hashSync('Manager@123', salt);
  const salesHash = bcrypt.hashSync('Sales@123', salt);

  return {
    users: [
      {
        UserId: 1,
        Name: 'System Administrator',
        Email: 'admin@acxiom.com',
        PasswordHash: adminHash,
        Role: 'Admin',
        IsActive: true,
        FailedLoginCount: 0,
        LockoutEnd: null,
        CreatedDate: new Date('2026-01-01T09:00:00Z').toISOString()
      },
      {
        UserId: 2,
        Name: 'Sarah Jenkins (Manager)',
        Email: 'manager@acxiom.com',
        PasswordHash: managerHash,
        Role: 'Manager',
        IsActive: true,
        FailedLoginCount: 0,
        LockoutEnd: null,
        CreatedDate: new Date('2026-01-02T09:00:00Z').toISOString()
      },
      {
        UserId: 3,
        Name: 'Alex Rivera (Sales Exec)',
        Email: 'sales@acxiom.com',
        PasswordHash: salesHash,
        Role: 'SalesExecutive',
        IsActive: true,
        FailedLoginCount: 0,
        LockoutEnd: null,
        CreatedDate: new Date('2026-01-03T09:00:00Z').toISOString()
      }
    ],
    customers: [],
    leads: [],
    opportunities: [],
    followups: [],
    activities: [],
    auditLogs: [
      {
        AuditLogId: 601,
        UserId: 1,
        Action: 'System Init',
        EntityName: 'System',
        RecordId: '0',
        OldValue: null,
        NewValue: 'AcxiomCRM initialized with clean database, ASP.NET Identity baseline security, and seed role accounts.',
        CreatedDate: new Date('2026-01-01T09:00:00Z').toISOString(),
        IpAddress: '127.0.0.1'
      }
    ]
  };
}

class Database {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    }
  }

  resetClean() {
    const initial = getInitialData();
    this.write(initial);
    return initial;
  }

  read() {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error reading database, resetting to clean initial state:', err);
      const initial = getInitialData();
      this.write(initial);
      return initial;
    }
  }

  write(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }

  // Audit Logging helper
  logAudit(userId, action, entityName, recordId, oldValue, newValue, ipAddress = '127.0.0.1') {
    const db = this.read();
    const newId = db.auditLogs.length > 0 ? Math.max(...db.auditLogs.map(a => a.AuditLogId || 0)) + 1 : 601;
    const logEntry = {
      AuditLogId: newId,
      UserId: userId ? parseInt(userId) : null,
      Action: action,
      EntityName: entityName,
      RecordId: String(recordId || 'N/A'),
      OldValue: oldValue ? (typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue)) : null,
      NewValue: newValue ? (typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue)) : null,
      CreatedDate: new Date().toISOString(),
      IpAddress: ipAddress
    };
    db.auditLogs.unshift(logEntry);
    this.write(db);
    return logEntry;
  }
}

module.exports = new Database();

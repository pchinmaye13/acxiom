# AcxiomCRM - Enterprise Role-Based CRM Solution

> **Functional & Technical Project Documentation & Implementation Baseline**  
> **Target Roles:** Admin, Manager, Sales Executive  
> **Core Architecture:** Node.js / Express Layered Architecture + Bootstrap 5 SPA + Custom Audit & Identity Engine  
> **Live Web Link:** [https://a2d9a2aaa96083.lhr.life](https://a2d9a2aaa96083.lhr.life)  
> **Local Web Link:** [http://localhost:3000](http://localhost:3000)  

---

## 1. Document & System Purpose

**AcxiomCRM** defines a complete enterprise Customer Relationship Management system covering the full sales lifecycle from lead capture, contact management, sales pipeline progression, follow-up scheduling, activity tracking, role-based access control (RBAC), security audit logging, and RESTful API integration.

This solution provides maximum simplicity with a lightweight, multi-layer architecture (**4 core files**), complete with client-side and mandatory server-side business rules enforcement.

---

## 2. Complete Module Structure

| S.No | Module | Purpose |
| :--- | :--- | :--- |
| **1** | **AcxiomCRM** | Core application shell, responsive navigation, role-scoped menus, and shared services. |
| **2** | **Authentication & Security** | ASP.NET Identity-style authentication, password hashing (`bcrypt`), password policy, account lockout, JWT session management. |
| **3** | **Dashboard** | Role-scoped KPIs (Customers, Leads, Opportunities, Pipeline Value) and Chart.js analytics. |
| **4** | **Customer Management** | Master customer data (CRUD), duplicate email/phone prevention, status tracking, sales assignment. |
| **5** | **Lead Management** | Lead capture, status workflow (`New`, `Contacted`, `Qualified`, `Unqualified`, `Converted`, `Lost`), and 1-click lead conversion to Customer & Opportunity. |
| **6** | **Opportunity Management** | Pipeline tracking, stage progression (`Qualification`, `Proposal`, `Negotiation`, `Won`, `Lost`), weighted pipeline calculation (`Amount × Probability / 100`). |
| **7** | **Follow-Up Management** | Activity scheduling (`Call`, `Meeting`, `Email`, `Task`), overdue tracking, and date rule validation. |
| **8** | **User & Role Administration** | User administration (Admin only), primary role assignment, activation/deactivation, account unlocking. |
| **9** | **Audit Log** | Immutable security and business activity tracking with user ID, timestamp, entity, record ID, and change details. |
| **10** | **REST API** | Secured endpoints for all CRM resources with DTO projections, input validation, and standard HTTP status codes. |
| **11** | **Reports & Analytics** | Stage-wise pipeline report, conversion metrics, performance summaries, and audit trail viewing. |

---

## 3. Simplified Project Architecture & File Tree

The implementation achieves full spec compliance using an ultra-simple, low-file-count structure:

```
acxiom/
├── server.js            # Express application, REST APIs, Identity auth & server validation
├── db.js                # Persistent JSON/Database engine, auto-seeding & audit logger
├── package.json         # Dependencies (express, bcryptjs, jsonwebtoken, cookie-parser, cors)
├── public/
│   ├── index.html       # Responsive Bootstrap 5 SPA layout & modal dialogs
│   ├── app.js           # Client-side validation engine, AJAX REST client & Chart.js renderers
│   └── styles.css       # Custom modern CSS styling & glassmorphism accents
└── README.md            # Comprehensive project & functional documentation
```

### Layer Breakdown:
```
Users (Admin / Manager / Sales Executive)
   │
   ▼
[ Presentation Layer ] ──> SPA UI (Bootstrap 5, Chart.js, Client Validation in app.js)
   │
   ▼
[ Application Layer ]  ──> REST Controllers, DTO Projections & Middleware in server.js
   │
   ▼
[ Domain / Business ]  ──> Business Rules (Date checks, Amount > 0, Prob 0-100, Lockout)
   │
   ▼
[ Data Access Layer ]  ──> Database Access & Audit Logger in db.js
   │
   ▼
[ Database Layer ]     ──> Data Persistence (data.json)
```

---

## 4. Business & Validation Rules Specification

AcxiomCRM strictly enforces validation at both the **Client-Side** (for immediate user feedback) and **Server-Side** (mandatory security boundary):

| Field / Area | Validation Rule | Category | Example / Server Message |
| :--- | :--- | :--- | :--- |
| **Required Fields** | Name, Email, Phone, Subject, Amount, Date must not be empty. | Required | *"Customer Name is required."* |
| **Email Format** | Standard regex match (`user@domain.com`). | Format | *"Enter a valid email address."* |
| **Phone Format** | 10-digit mobile phone pattern. | Format | *"Enter a valid 10-digit phone number."* |
| **Email / Phone Uniqueness** | Prevent duplicate customer email/phone creation. | Duplicate Check | *"Customer with this email address already exists."* |
| **Opportunity Amount** | Must be strictly greater than 0 (`Amount > 0`). | Numeric / Business | *"Opportunity Amount must be greater than 0."* |
| **Probability** | Range must be from `0` through `100` inclusive. | Range / Business | *"Probability must be between 0 and 100."* |
| **Expected Close Date** | Cannot be set in the past for active opportunities. | Date / Business | *"Expected Close Date cannot be in the past for active opportunities."* |
| **Follow-Up Date** | Cannot be earlier than today for planned follow-ups. | Date / Business | *"Follow-up date cannot be earlier than today for a new/planned activity."* |

---

## 5. Security Specification & Role Permission Matrix

### 5.1 Authentication Features
- **Password Security:** Passwords hashed with `bcrypt` (10 rounds). Plain-text passwords are **never** stored or logged.
- **Password Policy:** Minimum 8 characters, requiring uppercase, lowercase, and numeric characters.
- **Account Lockout:** Automatically locks an account after **5 consecutive failed attempts** for 15 minutes. Admin can manually unlock accounts.
- **Session Protection:** Secure HTTP-only cookies and JWT tokens.

### 5.2 Role Permission Matrix

| Module / Action | Admin | Manager | Sales Executive |
| :--- | :---: | :---: | :---: |
| **Dashboard KPIs** | Global View | Team Scope | Assigned Scope |
| **Customer Management** | Full (CRUD) | Full (CRUD) | Assigned Only (Create/Edit) |
| **Lead Management** | Full (CRUD + Convert) | Full (CRUD + Convert) | Assigned Only (Create/Edit/Convert) |
| **Opportunity Management** | Full (CRUD) | Full (CRUD) | Assigned Only (Create/Edit) |
| **Follow-Up Scheduling** | Full (CRUD) | Full (CRUD) | Assigned Only |
| **User Administration** | Full (Edit Role / Unlock) | Read-only List | No Access |
| **Audit Logs** | Full System View | Full System View | No Access |
| **REST APIs** | All Endpoints | Authorized Endpoints | Scoped Endpoints |

---

## 6. REST API Specification

All endpoints require JWT Bearer Token or Cookie Authentication (except `/api/auth/login`).

| Method | Endpoint | Description | Minimum Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | Public |
| `POST` | `/api/auth/logout` | Terminate session | Authenticated |
| `GET` | `/api/auth/me` | Fetch authenticated user DTO | Authenticated |
| `GET` | `/api/dashboard` | Fetch role-scoped KPIs & Chart datasets | Authenticated |
| `GET` | `/api/customers` | List & search customers | Authenticated |
| `POST` | `/api/customers` | Create new customer (Uniqueness check) | Authenticated |
| `PUT` | `/api/customers/:id` | Update customer details | Authenticated |
| `DELETE`| `/api/customers/:id` | Delete customer record | Admin / Manager |
| `GET` | `/api/leads` | List & search leads | Authenticated |
| `POST` | `/api/leads` | Create new lead | Authenticated |
| `POST` | `/api/leads/:id/convert` | Convert Lead to Customer & Opportunity | Authenticated |
| `GET` | `/api/opportunities` | List sales opportunities | Authenticated |
| `POST` | `/api/opportunities` | Create opportunity (Business rules check) | Authenticated |
| `PUT` | `/api/opportunities/:id` | Update opportunity | Authenticated |
| `GET` | `/api/followups` | List follow-up activities | Authenticated |
| `POST` | `/api/followups` | Schedule follow-up (`Date >= today`) | Authenticated |
| `PUT` | `/api/followups/:id/complete`| Mark follow-up as completed | Authenticated |
| `GET` | `/api/users` | List users & account status | Admin / Manager |
| `PUT` | `/api/users/:id` | Update user role or active status | Admin |
| `POST` | `/api/users/:id/unlock` | Unlock locked user account | Admin |
| `GET` | `/api/audit` | Fetch security & activity audit logs | Admin / Manager |
| `GET` | `/api/reports/pipeline` | Stage-wise weighted pipeline data | Authenticated |

---

## 7. Active Live & Local Access Links

- **Public Live HTTPS Deployment Link:** [https://a2d9a2aaa96083.lhr.life](https://a2d9a2aaa96083.lhr.life)
- **Local Desktop Link:** [http://localhost:3000](http://localhost:3000)
- **Local Network Link:** [http://172.19.115.77:3000](http://172.19.115.77:3000)

### Starting the Server Manually
```bash
npm start
```

---

## 8. Test Credentials Matrix

You can test all 3 role perspectives using the built-in quick presets on the login screen or manually:

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@acxiom.com` | `Admin@123` | Full administration, Users, Roles, Audit Logs, All CRM records. |
| **Manager** | `manager@acxiom.com` | `Manager@123` | Team pipeline, Lead/Opp management, Performance reports. |
| **Sales Executive** | `sales@acxiom.com` | `Sales@123` | Assigned Customers, Leads, Opportunities, and Follow-ups. |

---

## 9. Verification & Evaluation Results

All required functional criteria have been verified via automated API test suites:
- ✅ **Identity Login & Logout** working cleanly with secure cookies/JWT.
- ✅ **Account Lockout** triggers after 5 invalid login attempts.
- ✅ **Client & Server Validation** blocks invalid inputs (Amount <= 0, Prob > 100, Past dates).
- ✅ **Lead Conversion** automatically generates Customer and Opportunity records.
- ✅ **Audit Log** automatically captures all system and business state changes.

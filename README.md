# AcxiomCRM — Enterprise Role-Based CRM

AcxiomCRM is a full-stack Customer Relationship Management system designed to manage customers, leads, sales opportunities, follow-ups, users, and business activities through a secure role-based architecture.

## 🚀 Features

* 🔐 **Authentication & Security** — JWT authentication, bcrypt password hashing, account lockout, and secure sessions.
* 👥 **Customer Management** — Create, update, search, and manage customer records with duplicate prevention.
* 🎯 **Lead Management** — Track leads through different stages and convert qualified leads into customers and opportunities.
* 💼 **Opportunity Management** — Manage sales pipelines, stages, probabilities, and weighted pipeline values.
* 📅 **Follow-Up Management** — Schedule and track calls, meetings, emails, and tasks.
* 📊 **Dashboard & Analytics** — Role-based KPIs, pipeline insights, and Chart.js visualizations.
* 👤 **Role-Based Access Control** — Separate permissions for Admin, Manager, and Sales Executive.
* 📝 **Audit Logging** — Track important security and business activities.
* 🌐 **REST API** — Secure APIs for CRM resources with validation and authorization.

## 🛠️ Technology Stack

**Frontend**

* HTML5
* CSS3
* JavaScript
* Bootstrap 5
* Chart.js

**Backend**

* Node.js
* Express.js
* REST APIs
* JWT
* bcrypt

**Data**

* Persistent JSON-based storage
* Audit logging

## 🏗️ Architecture

```text
User
  ↓
Bootstrap 5 + JavaScript
  ↓
Express.js REST API
  ↓
Authentication & RBAC
  ↓
Business Logic & Validation
  ↓
Data Persistence + Audit Logging
```

## 📂 Project Structure

```text
acxiom/
├── server.js
├── db.js
├── package.json
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── README.md
```

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/pchinmaye13/acxiom.git
cd acxiom
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the application

```bash
npm start
```

### 4. Open the application

```text
http://localhost:3000
```

## 👤 User Roles

| Role                | Access                                                   |
| ------------------- | -------------------------------------------------------- |
| **Admin**           | Full system access, user management, and audit logs      |
| **Manager**         | Team CRM operations, pipeline, and reports               |
| **Sales Executive** | Assigned customers, leads, opportunities, and follow-ups |

## 🔄 CRM Workflow

```text
Lead
 ↓
Qualification
 ↓
Customer + Opportunity
 ↓
Qualification → Proposal → Negotiation
 ↓
Won / Lost
 ↓
Follow-Up & Reporting
```

## 🎯 Key Highlights

* Client-side and server-side validation
* Role-scoped data access
* Secure authentication
* Lead-to-customer conversion
* Weighted sales pipeline calculation
* Audit trail for system activities
* RESTful API architecture

## 👨‍💻 Project

**AcxiomCRM — Enterprise Role-Based CRM Solution**

A full-stack project demonstrating **CRM development, REST APIs, authentication, RBAC, business logic, data management, and security**.

## 📄 License

Developed for academic/project submission and demonstration purposes.

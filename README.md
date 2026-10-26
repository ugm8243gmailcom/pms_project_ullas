# WAYMARK — Team-Centric Project Management System (PMS)

<div align="center">
  <img src="pms_frontend/public/favicon.png" alt="WAYMARK Logo" width="80" height="80" />
  <h3>High-Velocity, Role-Segregated Project Execution Platform</h3>
  <p>Engineered with FastAPI, MongoDB (Motor), React 19, Vite, and Neo-Brutalist / Liquid Glassmorphism Aesthetics.</p>
</div>

---

## 🚀 Overview

**WAYMARK** is a modern, enterprise-ready Project Management System designed to eliminate workflow bottlenecks and deliver complete transparency across engineering and product teams. It features a strict three-tier role hierarchy, native drag-and-drop Kanban pipelines, smart workload balancing, developer deliverable review stations, and dynamic Indian Standard Time (IST) milestone status calculations.

---

## ✨ Key Features & Role Architecture

### 🛡️ 1. Administrator (Workspace Owner)
- **Workspace Creation**: Sign up organizations with 6-digit email OTP verification.
- **Basic Settings**: Create Project Managers and Employees with auto-generated `EMP-xxxx` identifiers.
- **Bulk Staff Onboarding**: Upload `.xlsx` or `.csv` spreadsheets to automatically generate secure login credentials and dispatch onboarding emails.
- **Advanced Settings**: Full CRUD operations across all database collections, strictly scoped to their organization.
- **Live Terminal Audit Logs**: Real-time terminal log viewer with exact timestamps and HTTP methods, auto-purged after 24 hours via MongoDB TTL indexes.
- **Strict Invisibility**: Administrator accounts are completely invisible to employees across project rosters and teammate listings.

### 📋 2. Project Manager (Project Head)
- **Project Head by Default**: Authorized to create projects, assign priorities, and supervise delivery (not treated as standard staff).
- **Dynamic Workflow Pipelines**: Create custom workflow stages with category tags and colors; drag-and-drop projects across pipeline columns.
- **Smart Staffing Capacity Engine**: Proactively detects and flags overloaded engineers ($\ge 3$ active tasks or $\ge 2$ concurrent projects) to prevent burnout.
- **Task Management & Reviews**: Assign tasks linked to workflows and evaluate submitted code deliverables (GitHub repositories, PR summaries, Dockerfiles).
- **Profile Customization**: Drag-and-drop square crop tool for circular avatars and secure password updates.

### 💻 3. Staff Employee
- **Focused Task Queue**: Priority-ordered task workstation sorted by deadline urgency.
- **Deliverables Submission Station**: Submit progress reports, GitHub commit/PR URLs, and Dockerfile links directly for PM approval.
- **Integrated Collaboration**: Built-in Google Meet scheduler and peer availability tracker (without visibility into Admin accounts).
- **Profile Management**: Profile picture cropping and password management.

### ⏱️ 4. Dynamic IST Progress & Deadline Engine
- Project completion percentages and statuses (`planned`, `on_track`, `at_risk`, `overdue`, `completed`) are dynamically calculated by evaluating workflow stage progression (50%), completed task deliverables (50%), and live deadline comparison against Indian Standard Time (`UTC+5:30`).

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) |
| **Database** | [MongoDB](https://www.mongodb.com/) via [Motor](https://motor.readthedocs.io/) (Asynchronous Coroutine Driver) |
| **Authentication** | JWT (JSON Web Tokens) with Bcrypt Password Hashing |
| **Email Delivery** | Asynchronous SMTP with TLS/SSL for OTPs and Credential Dispatch |
| **Frontend Framework** | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) |
| **Routing** | [React Router v7](https://reactrouter.com/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Custom Liquid Glassmorphism Design System |
| **Typography** | Space Grotesk (Neo-Brutalist Landing Page) & Plus Jakarta Sans (Dashboards) |

---

## 📦 Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Python**: Version `3.10` or higher ([Download Python](https://www.python.org/downloads/))
- **Node.js**: Version `18.0.0` or higher and `npm` ([Download Node.js](https://nodejs.org/))
- **MongoDB**: A running local MongoDB instance (`mongodb://localhost:27017`) or a [MongoDB Atlas](https://www.mongodb.com/atlas) cloud cluster connection URI.
- **Git**: Installed and configured on your system ([Download Git](https://git-scm.com/))

---

## ⚙️ Step-by-Step Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Arushi-Ojha/project_management_system.git
cd project_management_system
```

---

### 2. Backend Setup (`pms_backend`)

1. Open a terminal in the root directory and navigate to the backend folder:
   ```bash
   cd pms_backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure Environment Variables:
   Create a `.env` file inside `pms_backend/`:
   ```ini
   # Database Configuration
   MONGO_URI=mongodb://localhost:27017
   DB_NAME=pms_db

   # Security
   JWT_SECRET=your_super_secret_jwt_key_change_in_production

   # SMTP Email Settings (For OTP verification and credential dispatch)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=your_gmail_app_password
   ```

5. Start the FastAPI Development Server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend API will be running live at **`http://127.0.0.1:8000`**.
   - **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

### 3. Frontend Setup (`pms_frontend`)

1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd pms_frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the Vite Development Server:
   ```bash
   npm run dev
   ```
   The frontend web application will be available at **`http://localhost:5173`**.

4. (Optional) Build for Production:
   ```bash
   npm run build
   ```

---

## 🧭 Application Routes & Workflow

| URL Path | Access Level | Description |
|---|---|---|
| `/` | Public | High-conversion Neo-Brutalist Landing Page with PMS Capabilities, Case Studies, and Earth visualization. |
| `/login` | Public | Unified Auth Portal: Workspace Creation (Admin Sign Up with OTP) and Member Sign In. |
| `/dashboard` | Authenticated | Role-Adaptive Dashboard: Admin (Stats & Terminal Logs), Project Manager (Progress & Health), Employee (Task Queue & Visualizations). |
| `/workflows` | Admin / PM | Workflow Stage Builder and Drag-and-Drop Project Pipeline. |
| `/tasks-management` | Admin / PM | Task Creation with Workflow mapping, Employee assignment (with circular avatars), and Deliverables Review Station. |
| `/projects` | Admin / PM | Project creation with priority assignment and Smart Staffing availability engine. |
| `/tasks` | Employee | Assigned tasks queue, Google Meet scheduler, and GitHub/Dockerfile deliverable submission workstation. |
| `/basic-settings` | Admin | Staff user management, position assignments, and bulk Excel (`.xlsx`/`.csv`) onboarding. |
| `/advanced-settings` | Admin | Complete organization-scoped database collections inspector and CRUD console. |

---

## 📂 Project Structure

```text
pmsauth/
├── pms_backend/
│   ├── api/
│   │   └── routers/
│   │       ├── v1_auth.py          # OTP signup, login, password management
│   │       ├── v1_iam.py           # User management, bulk upload, availability
│   │       ├── v1_projects.py      # Project CRUD, IST progress & status calculations
│   │       ├── v1_workflows.py     # Custom workflow stage transitions
│   │       ├── v1_issues.py        # Task assignment, deliverable submission & reviews
│   │       ├── v1_audit.py         # 24h auto-purged terminal system logs
│   │       ├── v1_departments.py   # Department management
│   │       ├── v1_notifications.py # In-app notification center
│   │       └── v1_rbac.py          # Role-based access control
│   ├── core/
│   │   ├── database.py             # Motor async connection & TTL index initializers
│   │   └── security.py             # Bcrypt hashing and JWT generation
│   ├── models/                     # Pydantic schemas (IAM, Execution, Issue, Logs)
│   ├── services/                   # Business logic (Issue, Notification, Staffing)
│   ├── requirements.txt            # Python dependencies
│   └── main.py                     # FastAPI application entrypoint & middleware
│
├── pms_frontend/
│   ├── public/                     # Static media (Landspace.mp4, earth.jpg, favicon.png)
│   ├── src/
│   │   ├── components/             # Reusable UI (PublicNavbar, Navbar, Modals)
│   │   ├── context/                # AuthContext (JWT management & current user state)
│   │   ├── pages/                  # Views (Homepage, Dashboards, Hubs, Onboarding)
│   │   ├── services/               # Centralized API fetch layer
│   │   ├── App.jsx                 # Route definitions & background video stream
│   │   └── index.css               # Liquid glassmorphism design system & typography
│   ├── index.html                  # HTML entrypoint with Plus Jakarta Sans & Space Grotesk
│   ├── vite.config.js              # Vite + React + Tailwind v4 build configuration
│   └── package.json                # Frontend dependencies
│
└── README.md                       # Comprehensive setup and system documentation
```

---

## 🔒 Security & Privacy Highlights

1. **Role Invisibility**: Non-admin users cannot query or view administrative account profiles or contact data.
2. **Auto-Purging TTL Logs**: MongoDB automatically deletes terminal logs after 24 hours (`expireAfterSeconds=86400`) and notifications after 7 days.
3. **Password Security**: Passwords are encrypted using salted Bcrypt before storage; plain passwords are never logged or stored.
4. **JWT Expiry**: Sessions are secured via signed JWT tokens with automated expiration validation.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](pms_frontend/public/license.txt) for details.

---

<div align="center">
  <sub>Developed for high-velocity software engineering and product operations.</sub>
</div>

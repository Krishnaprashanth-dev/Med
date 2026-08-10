# MedPass

### Enterprise Hospital Visit Pass Management System

MedPass is a full-stack hospital visit pass management platform designed to digitize and streamline the process of allocating, approving, managing, and verifying hospital visits for Medical Representatives (MRs).

The platform replaces manual pass allocation workflows with a centralized system featuring priority-based scheduling, role-based access control, QR-based entry verification, notifications, audit trails, and automated scoring.

---

## Overview

Hospital visits by Medical Representatives often involve multiple stakeholders, limited visiting capacity, manual approvals, and complex scheduling requirements.

MedPass provides a centralized platform that connects:

* Medical Representatives
* Hospitals
* Pharmaceutical Companies
* Administrators
* Security personnel

The system manages the complete workflow from application and allocation to hospital entry and post-visit tracking.

---

## Key Features

### Medical Representative Portal

* Secure MR authentication
* Hospital and company directory
* Hospital visit applications
* Visit pass management
* Pass status tracking
* Notifications
* Cancellation requests
* Priority and score tracking
* QR-based pass verification workflow

### Administration Portal

* Application management
* Priority-based lottery allocation
* MR management
* Hospital management
* Pharmaceutical company management
* Pass management
* User and role management
* Scoring and priority management
* Audit log monitoring
* Administrative notifications

### Security Portal

* QR-based gate-entry workflow
* Pass verification
* Entry logging
* Visit validation
* Security-focused dashboard

### Company Administration

* Manage company-related MR information
* Monitor applications and visits
* Access relevant operational information

---

## Core Workflow

```text
Medical Representative
        │
        ▼
Submit Hospital Visit Application
        │
        ▼
Priority / Eligibility Evaluation
        │
        ▼
Lottery / Allocation Process
        │
        ▼
Visit Pass Generated
        │
        ▼
MR Receives Notification
        │
        ▼
Hospital Visit
        │
        ▼
QR / Pass Verification
        │
        ▼
Entry Logged
        │
        ▼
Audit & Visit Records
```

---

## System Architecture

```text
                         MEDPASS
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   MR Application      Admin Portal       Security Portal
   React + TypeScript  React + TypeScript React + TypeScript
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                    Node.js + Express
                       REST API Layer
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
         Supabase        Business       Resend
             │             Logic         Email API
             ▼
        PostgreSQL
```

The system follows a modular service-oriented structure, separating UI components, business logic, API handling, and data access.

---

## Technology Stack

### Frontend

* **React 19**
* **TypeScript**
* **Vite**
* **Tailwind CSS**
* **Lucide React**

### Backend

* **Node.js**
* **Express.js**
* **TypeScript**
* RESTful APIs

### Database & Backend Services

* **Supabase**
* **PostgreSQL**
* Supabase JavaScript SDK

### Security & Authentication

* Role-Based Access Control (RBAC)
* Password hashing with `bcryptjs`
* Environment-based configuration
* Audit logging

### Integrations

* **Resend** — transactional email notifications
* **JSQR / QR workflow** — pass and gate verification

### DevOps & Deployment

* **Vercel**
* Docker-compatible development infrastructure
* Environment variables
* Git / GitHub

---

## User Roles

MedPass supports multiple operational roles:

| Role                   | Responsibilities                                               |
| ---------------------- | -------------------------------------------------------------- |
| Medical Representative | Apply for visits, manage passes, receive notifications         |
| Administrator          | Manage applications, allocation, users, hospitals, and scoring |
| Security               | Verify passes and record hospital entry                        |
| Company Administrator  | Manage company-level operations                                |
| Super Administrator    | System-wide administration and management                      |

---

## Project Structure

```text
MedPass/
│
├── api/
│   ├── server.ts
│   ├── emailService.ts
│   └── ...
│
├── components/
│   ├── AdminDashboard.tsx
│   ├── MRDashboard.tsx
│   ├── SecurityView.tsx
│   ├── CompanyAdminDashboard.tsx
│   └── ...
│
├── services/
│   ├── ApprovalService.ts
│   ├── AuditService.ts
│   ├── CancellationService.ts
│   ├── CompanyService.ts
│   ├── HospitalService.ts
│   ├── MRService.ts
│   ├── NotificationService.ts
│   ├── PassService.ts
│   ├── ScoringService.ts
│   ├── SessionService.ts
│   └── ...
│
├── types.ts
├── supabaseClient.ts
├── App.tsx
├── index.tsx
├── index.css
├── package.json
├── vite.config.ts
└── vercel.json
```

---

## Service-Layer Architecture

Business logic is separated into dedicated services rather than being tightly coupled to the React components.

```text
React Component
       │
       ▼
Service Layer
       │
       ▼
API / Supabase
       │
       ▼
PostgreSQL
```

Examples include:

* `PassService` — pass-related operations
* `ScoringService` — priority and scoring logic
* `HospitalService` — hospital-related operations
* `MRService` — Medical Representative operations
* `CancellationService` — cancellation workflows
* `NotificationService` — notification handling
* `AuditService` — audit trail management
* `SessionService` — session and authentication workflows

This separation improves maintainability and allows business logic to be reused across different application interfaces.

---

## Database

The application uses **PostgreSQL through Supabase**.

Core data entities include:

```text
Profiles
Medical Representatives
Hospitals
Pharmaceutical Companies
Applications
Passes
Entry Logs
Notifications
Cancellation Requests
Approvals
Audit Logs
Scoring Records
```

The database acts as the central source of truth shared across the different MedPass portals.

---

## API

The backend exposes RESTful endpoints through Express.

Examples include:

```text
GET  /api/health
POST /api/auth/login
POST /api/notify-selection
POST /api/notify-replacement
GET  /api/admin/audit-users
```

The API layer handles server-side operations that should not be performed directly in the client.

---

## Notifications

MedPass integrates **Resend** for transactional email notifications.

Notifications can be triggered for events such as:

* Lottery selection
* Replacement selection
* Application-related updates
* Operational events

```text
MedPass Event
      │
      ▼
Express API
      │
      ▼
Notification Service
      │
      ▼
Resend
      │
      ▼
Recipient Email
```

---

## QR-Based Access Control

The platform incorporates QR-based workflows for hospital access verification.

```text
Generated Visit Pass
        │
        ▼
       QR
        │
        ▼
Security Portal
        │
        ▼
Pass Verification
        │
        ▼
Entry Log
```

The current implementation contains a QR verification workflow prototype, with further native/mobile scanner integration planned as the mobile application evolves.

---

## Intelligent Decision Support

MedPass uses automated scoring and configurable business rules to support operational decision-making.

The system can evaluate factors such as:

* Priority
* Eligibility
* Previous allocation
* Application state
* Operational constraints

These rules contribute to automated allocation and prioritization workflows.

> **Note:** The current version does not rely on the Google Gemini API for these workflows.

---

## Running Locally

### Prerequisites

Make sure you have installed:

* Node.js 20+
* npm
* Git
* A Supabase project

### Clone the repository

```bash
git clone <repository-url>
cd MedPass
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

RESEND_API_KEY=your_resend_api_key
```

Do not commit environment files containing secrets.

### Start the frontend

```bash
npm run dev
```

### Start the API server

```bash
npx tsx api/server.ts
```

The frontend and API can be run separately during local development.

---

## Build

Create a production build with:

```bash
npm run build
```

The build process runs TypeScript compilation followed by the Vite production build.

---

## Deployment

The application is designed for deployment using **Vercel**.

The project includes:

```text
vercel.json
```

for API routing and deployment configuration.

A production deployment can be structured as:

```text
MR Portal
    │
    ├── Vercel
    │
    └── Supabase

Admin Portal
    │
    ├── Vercel
    │
    └── Supabase

Security Portal
    │
    ├── Vercel
    │
    └── Supabase

API
    │
    └── Express / Vercel
```

---

## Development Roadmap

Planned improvements include:

* [ ] Separate role-based subdomains
* [ ] Centralized authentication using Supabase Auth
* [ ] Fine-grained RBAC and permission management
* [ ] PostgreSQL Row Level Security (RLS)
* [ ] API versioning
* [ ] API request validation
* [ ] Improved QR/camera integration
* [ ] Native mobile application support
* [ ] Automated testing
* [ ] CI/CD pipeline
* [ ] Improved monitoring and observability
* [ ] Production-grade database migration workflow

---

## Engineering Principles

The project is being developed around the following principles:

* **Separation of concerns**
* **Modular service architecture**
* **Role-based authorization**
* **Secure API design**
* **Data consistency**
* **Auditability**
* **Scalable deployment**
* **Reusable business logic**

---

## Project Status

**Status: Active Development**

The core hospital pass management workflow, role-based interfaces, scoring/allocation logic, notifications, and database integration are implemented. The system is continuing to evolve toward a production-oriented architecture with stronger authorization, mobile capabilities, and deployment infrastructure.

---

## License

This project is currently developed as an academic/software engineering project.

All rights reserved unless otherwise specified.

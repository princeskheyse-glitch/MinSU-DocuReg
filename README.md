# MinSU DocuReg

**Mindoro State University — Document Request Management System**

A multi-campus, role-based document management system for the MinSU Registrar's Office. Students can request official documents online, track their status in real time, and receive notifications when their documents are ready for pickup.

---

## Features

- **Multi-campus support** — Victoria Main Campus, Calapan Campus, Bongabong Campus
- **Role-based access control** — Super Admin, Campus Admin, Registrar, Student
- **Google Sign-In** — Students can register and log in with their Google account
- **Document requests** — Submit, track, and manage document requests online
- **Appointment scheduling** — Auto-scheduled pickup appointments when documents are ready
- **Real-time notifications** — In-app push notifications via Server-Sent Events with sound
- **Email notifications** — Appointment details sent via Nodemailer
- **PWA support** — Installable as a mobile app with offline caching
- **Firebase Firestore** — Cloud-hosted NoSQL database, no local MySQL required

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ESM) |
| Framework | Express.js |
| Template Engine | Handlebars (`.xian` extension via XianFire) |
| Database | Firebase Firestore (Admin SDK) |
| Authentication | Session-based + Google OAuth (Firebase Auth) |
| Styling | Tailwind CSS (CDN) |
| Icons | Font Awesome 6 |
| Email | Nodemailer |
| Real-time | Server-Sent Events (SSE) |
| PWA | Web App Manifest + Service Worker |

---

## Project Structure

```
MinSU-DocuReg/
├── controllers/          # Route handlers
│   ├── authController.js         # Login, register, Google Sign-In
│   ├── studentController.js      # Student dashboard & requests
│   ├── registrarController.js    # Registrar request processing
│   ├── adminController.js        # Campus admin management
│   ├── superAdminController.js   # Global super admin
│   └── notificationController.js # SSE stream & notification API
├── middleware/
│   └── rbacMiddleware.js         # Role-based access control
├── models/               # Firestore data access layer
│   ├── db.js                     # Firebase Admin SDK init
│   ├── userModel.js
│   ├── campusModel.js
│   ├── documentModel.js
│   ├── appointmentModel.js
│   └── notificationModel.js
├── routes/
│   └── index.js                  # All application routes
├── utils/
│   ├── emailService.js           # Nodemailer email sending
│   ├── helpers.js                # Date/scheduling utilities
│   └── notificationService.js   # SSE push + DB notifications
├── views/                # Handlebars templates (.xian)
│   ├── partials/                 # Shared navbar, footer, head
│   ├── student/
│   ├── registrar/
│   ├── admin/
│   └── superadmin/
├── public/
│   ├── images/logo/              # MinSU logo
│   ├── manifest.json             # PWA manifest
│   └── sw.js                     # Service worker
├── firebase-service-account.json # Firebase Admin credentials (not committed)
├── index.js              # App entry point
├── seed.js               # Database seeder
└── .env                  # Environment variables (not committed)
```

---

## Setup

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled (Native mode)
- A Firebase service account key

### 1. Clone and install

```bash
git clone <repo-url>
cd MinSU-DocuReg
npm install
```

### 2. Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project or use **minsu-docureg**
3. Enable **Firestore Database** → Native mode
4. Enable **Authentication** → Google sign-in method
5. Go to **Project Settings** → **Service accounts** → **Generate new private key**
6. Save the downloaded file as `firebase-service-account.json` in the project root

### 3. Environment variables

Copy `.env.example` to `.env` and fill in:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
PORT=3000
SESSION_SECRET=your-random-secret-here
```

> For Gmail, generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

### 4. Seed the database

```bash
npm run seed
```

To reseed (clears all existing data):

```bash
npm run seed -- --force
```

### 5. Start the server

```bash
# Development (auto-reload)
npm run xian

# Production
npm run xian-start
```

Open [http://localhost:3000](http://localhost:3000)

---

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@minsu.edu.ph` | `superadmin123` |
| Victoria Admin | `admin.victoria@minsu.edu.ph` | `admin123` |
| Victoria Registrar | `registrar.victoria@minsu.edu.ph` | `registrar123` |
| Victoria Student | `student.victoria@student.minsu.edu.ph` | `student123` |
| Calapan Admin | `admin.calapan@minsu.edu.ph` | `admin123` |
| Calapan Registrar | `registrar.calapan@minsu.edu.ph` | `registrar123` |
| Calapan Student | `student.calapan@student.minsu.edu.ph` | `student123` |
| Bongabong Admin | `admin.bongabong@minsu.edu.ph` | `admin123` |
| Bongabong Registrar | `registrar.bongabong@minsu.edu.ph` | `registrar123` |
| Bongabong Student | `student.bongabong@student.minsu.edu.ph` | `student123` |

---

## Role Permissions

| Feature | Student | Registrar | Campus Admin | Super Admin |
|---------|---------|-----------|--------------|-------------|
| Submit document requests | ✅ | — | — | — |
| View own requests | ✅ | — | — | — |
| Process requests | — | ✅ | ✅ | — |
| Manage appointments | — | ✅ | ✅ | — |
| Manage campus users | — | — | ✅ | — |
| View campus analytics | — | — | ✅ | — |
| View all campuses | — | — | — | ✅ |
| Global analytics | — | — | — | ✅ |
| Assign users to campuses | — | — | — | ✅ |

---

## Available Documents

Students can request the following documents:

1. Transcript of Records
2. Certificate of Transfer Credentials
3. Second Copy of Diploma
4. Certificate of Graduation
5. Verification / Authentication Letter
6. Certificate of Enrollment
7. Good Moral Certificate

---

## Document Request Workflow

```
Student submits request
        ↓
  Status: Pending
        ↓ (Registrar reviews)
  Status: Processing
        ↓ (Registrar marks ready)
  Status: Ready for Pickup
        ↓ (Auto-schedules appointment + notifies student)
  Status: Completed
```

At each status change, the student receives an in-app notification and the registrar/admin receives a notification when a new request is submitted.

---

## PWA Installation

The app is installable as a Progressive Web App:

- **Chrome/Edge**: Click the install icon in the address bar
- **Android**: "Add to Home Screen" from the browser menu
- **iOS Safari**: Share → "Add to Home Screen"

---

## Security Notes

- `firebase-service-account.json` is listed in `.gitignore` — **never commit it**
- `.env` is also gitignored — keep secrets out of version control
- Session secret should be a long random string in production
- Passwords are hashed with bcrypt (10 rounds)
- Google Sign-In tokens are verified server-side with Firebase Admin SDK

---

## License

MIT License — Copyright © 2025 Christian I. Cabrera / XianFire Framework  
Mindoro State University — Philippines

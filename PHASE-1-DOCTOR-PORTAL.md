# MediCall AI – Phase 1 Doctor Portal

This update adds a separate doctor sign-in, a doctor dashboard, doctor-specific appointment listing, doctor weekly availability submission, and clinic-admin approval/rejection of submitted availability.

## What changed
- `server/server.js`: doctor credentials on Doctor records, doctor JWT authentication, doctor appointment and availability APIs, and admin availability review APIs.
- `client/src/DoctorPortal.jsx`: new doctor login and dashboard UI.
- `client/src/App.jsx`: doctor portal navigation, optional doctor login credentials in the admin Add Doctor form, and availability review controls.
- `server/package.json`: adds `npm run dev` and `npm start` scripts.

## Run
Backend terminal:
```powershell
cd server
npm install
npm run dev
```

Frontend terminal:
```powershell
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Create a doctor login
1. Sign in as the clinic administrator.
2. In the Add a doctor form, enter doctor name, specialization and fee.
3. Under Doctor portal account, enter a unique email and a temporary password of at least 8 characters. Both fields must be provided together.
4. Add the doctor.
5. Click Doctor portal in the top navigation and sign in using those credentials.

Existing/demo doctor records created before this update do not automatically have login credentials. Add a new doctor account with an email/password to test doctor login.

## Doctor portal
- Doctors can view appointments assigned to their own doctor record.
- Doctors can submit weekly day/time ranges and slot duration.
- Submitted availability starts as Pending.
- Clinic administrators can approve or reject requests in the Doctor availability approvals section of the clinic dashboard.

## Important scope note
This is Phase 1. Approval records are stored, but approved schedules are not yet connected to the public patient booking calendar. Email notifications, advanced appointment rescheduling/payment fields, analytics charts/call logs and patient directory enhancements are planned for subsequent phases. The current appointment booking behavior is retained.

Do not share doctor temporary passwords or JWT tokens. Before production use, add a password-reset/change flow, rate limiting, audit logging and stronger account provisioning controls.
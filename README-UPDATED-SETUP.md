# MediCall AI — Updated Full Project

This folder contains the original MediCall AI project with the updated backend and frontend files merged in.

## Before running

1. Install Node.js (LTS) and MongoDB, or prepare a MongoDB Atlas connection string.
2. Extract this folder and open `medicall-ai-main` (the extracted project root) in VS Code.
3. In `server`, copy `.env.example` to `.env` and fill in your existing MongoDB / AI provider settings plus SMTP and Razorpay test credentials. Do not commit `.env` to GitHub.
4. Keep your existing API keys private. The archive intentionally does not include any `.env` secrets or `node_modules` folders.

## Start backend (Terminal 1)

```powershell
cd server
npm install
npm run dev
```

Backend default: http://localhost:5000

## Start frontend (Terminal 2)

```powershell
cd client
npm install
npm run dev
```

Frontend default: http://localhost:5173

## Important configuration

- Preserve and merge your previous working values for `MONGODB_URI`, AI provider keys, JWT settings, and any other variables required by your existing project.
- Add SMTP variables for email and Razorpay test keys for payments, following `server/.env.example`.
- Razorpay payments require test keys and a configured checkout flow. Switch to live keys only after testing and account activation.
- Phone numbers are captured as basic contact information; OTP/SMS verification is not included.
- Rescheduling is a request workflow; clinic approval is required.
- Alternative dates in doctor-unavailable emails are suggestions and should be checked by clinic staff before confirming.

## Existing project files

The original CSS, Vite configuration, DoctorPortal component, assets, and documentation are retained. The updated `App.jsx` and `server.js` are overlaid on the original project.

## Validation note

This archive is assembled from the supplied project source and the updated files. Configure your own services and run the app locally; external integrations cannot be fully verified without your MongoDB, SMTP, AI provider, and Razorpay credentials.
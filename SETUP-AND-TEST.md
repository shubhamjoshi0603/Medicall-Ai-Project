# MediCall AI updated files — installation and testing

## Files to replace
Copy these files into the matching locations in your existing project:

- `server/server.js` → `<your-project>/server/server.js`
- `server/package.json` → `<your-project>/server/package.json`
- `client/src/App.jsx` → `<your-project>/client/src/App.jsx`

Keep your existing `client/package.json`, `client/src/DoctorPortal.jsx`, styles, Vite configuration, and all other files. Do not replace your real `server/.env` with `.env.example`.

## 1. Install backend dependencies
Open a terminal in the project's `server` folder:

```powershell
npm install
```

The updated backend uses `nodemailer` for email. Razorpay is called through its HTTPS API, so no extra Razorpay SDK is required.

## 2. Add environment variables
Add these to your existing `server/.env`, retaining your current MongoDB, JWT, Groq, Sarvam, and SMTP settings:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourclinicgmail@gmail.com
SMTP_PASS=your_google_app_password
MAIL_FROM=MediCall AI <yourclinicgmail@gmail.com>

RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_test_secret
```

Get test credentials from the Razorpay Dashboard. Never put the Razorpay secret in React/Vite environment variables, and never commit `.env` to GitHub. Keep using Razorpay test mode until the complete payment flow has been tested.

## 3. Start the app
Backend terminal:

```powershell
npm run dev
```

Frontend terminal, from `client`:

```powershell
npm install
npm run dev
```

## 4. Test in this order
1. Confirm `/api/health` responds.
2. Book a new appointment with patient name, email and phone. Check the patient inbox and Spam folder for the confirmation email.
3. Create/sign into a patient account using the same email used for the appointment. Open **My account** and refresh appointments.
4. Submit a reschedule request. Sign in as clinic admin and approve/reject it from the appointment row. Check the patient email.
5. Cancel an appointment from the patient portal and check the cancellation email.
6. For payment, sign into the patient portal, choose **Pay online**, and use Razorpay test credentials/test payment method. Payment is marked Paid only after the backend verifies Razorpay's HMAC signature.
7. Start an AI chat and a voice conversation, then book from one of them. The clinic dashboard's analytics cards count unique conversations and conversions.
8. In Clinic team, choose **Mark unavailable & notify** for a doctor. Existing appointments remain unchanged; patients receive a notice and suggested weekdays. Reactivate the doctor from the same card when appropriate.

## Important behavior and limitations
- Basic phone capture is retained in booking and patient registration; there is no OTP/SMS verification.
- Reschedule requests do not move appointments until clinic admin approval.
- Emergency alternative dates are suggested weekdays, not guaranteed free appointment slots. Patients are asked to contact the clinic/request a new slot; the system does not silently move their booking.
- Patient cancellation, rescheduling and online payment require a patient account whose email matches the booking email. Guest bookings can be accessed by creating an account with that same email.
- Email delivery requires valid SMTP settings. An appointment is not discarded if email delivery fails.
- Razorpay order creation and signature verification are implemented. Refund initiation, automatic refund policy, Razorpay webhook reconciliation, SMS, OTP, and live-mode compliance/configuration are not included.
- Analytics count AI chat/voice conversations sent by this website and mark conversion when the AI chat endpoint creates an appointment. Manual bookings made through the booking form are not counted as AI conversions.
- The backend stores conversation-level counts and appointment conversion metadata in MongoDB. Existing historic conversations cannot be reconstructed retroactively.
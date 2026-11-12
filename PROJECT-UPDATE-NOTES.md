# MediCall AI – UI and clinic discovery update

## What changed
- Added a project introduction explaining what MediCall AI is, why it was developed, and its key benefits.
- Added Get Started calls to action that open the existing role-based sign-in / registration experience.
- Added a Doctor option on the role selector that opens the existing Doctor Portal login. Doctor accounts remain created by clinic administrators from the clinic dashboard; doctors sign in with clinic-provided credentials.
- Added a public registered-clinic directory backed by the Clinic collection. Patients can select a clinic and the app loads only active doctors belonging to that selected clinic.
- Appointment creation validates the selected clinic and doctor relationship on the server.
- Added patient dashboard navigation anchors for My Profile, Appointments, and Clinic Location.
- Replaced the minimal global stylesheet with consistent base styles, focus states, form-control styling, and reduced-motion support.
- Updated the visual palette toward deep blue, teal and soft cyan for a modern healthcare product feel.
- Prevented the old patient login notice from appearing over the Doctor Portal.

## Run locally
1. Start MongoDB and configure `server/.env` using `server/.env.example`.
2. In `server`: `npm install` then `npm start` (or `node server.js`).
3. In `client`: `npm install` then `npm run dev`.
4. Open the Vite URL, normally `http://localhost:5173`.

## Important notes
- Only clinics successfully registered in the MediCall AI database appear in the patient clinic selector.
- A doctor account is provisioned by a clinic administrator; the Doctor tab is a login entry, not public doctor self-registration. This preserves the project's existing role/security model.
- The existing schema currently stores clinic name but not a clinic street address/map coordinates. The Patient Clinic Location section therefore displays clinic context and explains that directions require clinic-provided address data. Add address/map fields to the Clinic model before showing map directions.
- Email delivery, AI chat, payments and database features still depend on the server environment variables and third-party credentials documented in the setup files.


## Clinic team and dashboard update (10 Nov 2026)
- Disabled automatic demo-doctor seeding. Clinics now begin with an empty team and add their own doctors from the clinic dashboard.
- Added a clinic-scoped doctor removal API and a Remove doctor action in each team card. Upcoming confirmed appointments trigger an extra confirmation; appointment history is retained.
- Added a one-time cleanup for the six legacy sample doctor names shown in the earlier demo. This cleanup runs for the currently logged-in clinic when its doctor list is loaded.
- Restyled doctor cards, add-doctor panel, global navigation and clinic dashboard section navigation with a modern teal/indigo visual system.
- Existing doctor availability notification and reactivation actions remain available.
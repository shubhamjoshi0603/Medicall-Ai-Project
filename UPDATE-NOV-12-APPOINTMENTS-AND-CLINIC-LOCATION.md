# Patient booking list and clinic location update (12 Nov 2026)

## Patient portal
- The patient appointment endpoint continues returning the complete history, newest booking first.
- The UI shows the newest three bookings initially, including cancelled bookings.
- "View all bookings (N)" expands the full history; "Show latest 3 bookings" collapses it.
- Appointment cards and the Clinic locations section show saved clinic address and Google Maps directions.

## Clinic admin portal
- A new Clinic location section is available in the clinic dashboard navigation.
- Admin can save a full address and optionally latitude/longitude.
- To choose any point: open Google Maps, right-click (desktop) or long-press (mobile) the desired point, copy the coordinates shown, and paste latitude and longitude into the form.
- Patients see the saved location after refreshing/reloading their appointment list.

## Backend
- `PATCH /api/clinic/location` is protected by clinic-admin authentication.
- Clinic schema stores `location.address`, `location.latitude`, `location.longitude`, and `location.mapsUrl`.
- `/api/auth/me`, public clinic info, and patient appointment population now include clinic location.

## Run
1. Replace your existing project folder with this updated project (keep a backup first).
2. Keep your existing `server/.env` and `client/.env` files; do not overwrite them with example files.
3. In `server`: `npm install` then `npm run dev`.
4. In `client`: `npm install` then `npm run dev`.
5. Log in to the clinic admin portal, open Location, save address/coordinates, then log in as a patient and refresh appointments.

## Validation
- `node --check server/server.js` passed.
- Frontend build could not be run in this environment because client dependencies were not installed (`vite: not found`). Run `npm install` locally before testing.
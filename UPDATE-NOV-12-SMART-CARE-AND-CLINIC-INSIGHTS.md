# MediCall AI – November 12 update

## Included in this update

### Patient smart care finder
- Patient dashboard includes a symptom-to-specialty guidance panel.
- Keyword guidance suggests a relevant specialty (skin concerns → Dermatology, joint pain → Orthopaedics, fever/cough → General Physician).
- Matching doctors from the currently loaded registered clinic are shown with consultation fees.
- The panel states that this is navigation guidance, not a diagnosis, and directs emergency symptoms to emergency care.

### Clinic intelligence panel
- Displays paid revenue calculated from appointments marked `Paid`.
- Shows completed appointment count and pending payment count.
- Adds a visual AI conversion indicator based on the existing `/api/dashboard/analytics` response.
- Clearly indicates when no AI conversation data has been recorded.

### UI polish
- Added consistent focus states, section scroll offsets and responsive dashboard styling.
- Existing authentication, appointment workflows and server routes were retained.

## Important scope and limitations
- Specialty suggestions are keyword-based routing, not a clinical diagnosis or trained medical model.
- Doctor matching is limited to doctors loaded for the currently selected registered clinic. Cross-clinic distance sorting requires clinic coordinates and a location-permission flow.
- AI analytics use the existing persisted conversation analytics endpoint; no statistics are fabricated.
- Revenue is a simple sum of consultation fees for appointments marked `Paid`; it is not an accounting ledger and excludes refunds, taxes and gateway settlement fees.
- This package has not been production-built or live-tested against your MongoDB database here. Run `npm install` and `npm run build` in `client`, then test with your configured `.env`.
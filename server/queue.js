const mongoose = require("mongoose");

const roster = mongoose.model("DailyQueue", new mongoose.Schema({
  _id: String, appointments: [mongoose.Schema.Types.ObjectId],
}));
const localDate = () => new Date().toLocaleDateString("en-CA");

async function snapshot(Appointment, scope) {
  const visits = await Appointment.find(scope).sort({ time: 1, _id: 1 }).select("patientName time status queueState queueReason queueStartedAt queueEndedAt").lean();
  if (!visits.length) return [];
  const key = [scope.clinicId, scope.doctorId, scope.date].join("/");
  const update = { $addToSet: { appointments: { $each: visits.map(v => v._id) } } };
  let day;
  try { day = await roster.findByIdAndUpdate(key, update, { upsert: true, new: true }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    day = await roster.findByIdAndUpdate(key, update, { new: true });
  }
  const numbers = new Map(day.appointments.map((id, i) => [String(id), i + 1]));
  return visits.filter(v => v.status !== "Cancelled").map(v => ({
    id: String(v._id), token: numbers.get(String(v._id)), name: v.patientName, time: v.time,
    state: v.status === "Completed" ? "Completed" : v.queueState || "Waiting", reason: v.queueReason || "",
    minutes: v.queueEndedAt && v.queueStartedAt ? (v.queueEndedAt - v.queueStartedAt) / 60000 : null,
  }));
}

function registerQueue(app, { Appointment, Patient, protectDoctor, protectPatient }) {
  const doctorScope = req => ({ doctorId: req.doctorId, clinicId: req.clinicId, date: localDate() });
  app.get("/api/doctor/queue", protectDoctor, async (req, res) => {
    res.json(await snapshot(Appointment, doctorScope(req)));
  });
  app.post("/api/doctor/queue", protectDoctor, async (req, res) => {
    const { action, id, reason } = req.body || {};
    const scope = doctorScope(req);
    const visits = await snapshot(Appointment, scope);
    const current = visits.find(v => ["Called", "Consulting"].includes(v.state));
    const next = visits.find(v => v.state === "Waiting");
    const visit = action === "call" ? next : current;
    if (!visit || visit.id !== id || (action === "call" && current)) return res.status(409).json({ message: "The queue changed. Refresh and try again." });
    const query = { ...scope, _id: visit.id, status: "Confirmed" };
    let changes;
    if (action === "call") {
      query.queueState = { $in: [null, "Waiting"] };
      changes = { queueState: "Called", queueLane: [scope.clinicId, scope.doctorId, scope.date].join("/") };
    } else if (action === "skip" && visit.state === "Called" && typeof reason === "string" && reason.trim() && reason.length <= 200) {
      query.queueState = "Called"; changes = { queueState: "Skipped", queueReason: reason.trim(), queueLane: null };
    } else if (action === "start" && visit.state === "Called") {
      query.queueState = "Called"; changes = { queueState: "Consulting", queueStartedAt: new Date() };
    } else if (action === "complete" && visit.state === "Consulting") {
      query.queueState = "Consulting"; changes = { status: "Completed", queueState: "Completed", queueEndedAt: new Date(), queueLane: null };
    } else return res.status(400).json({ message: "Invalid queue action or skip reason." });
    try {
      const result = await Appointment.updateOne(query, { $set: changes });
      if (result.modifiedCount) return res.sendStatus(204);
    } catch (error) { if (error.code !== 11000) throw error; }
    res.status(409).json({ message: "Another queue action was processed. Refresh to continue." });
  });
  app.get("/api/patient/queue", protectPatient, async (req, res) => {
    const patient = await Patient.findById(req.patientId).select("email");
    if (!patient) return res.sendStatus(404);
    const own = await Appointment.find({ patientEmail: patient.email, date: localDate(), status: "Confirmed" }).select("clinicId doctorId date bookingReference");
    const results = await Promise.all(own.map(async v => {
      const rows = await snapshot(Appointment, { doctorId: v.doctorId, clinicId: v.clinicId, date: v.date });
      const index = rows.findIndex(row => row.id === String(v._id));
      if (index < 0) return null;
      const row = rows[index];
      const active = rows.find(r => ["Called", "Consulting"].includes(r.state));
      const ahead = row.state === "Waiting" ? rows.slice(0, index).filter(r => r.state === "Waiting").length + Number(Boolean(active)) : 0;
      const durations = rows.map(r => r.minutes).filter(n => n > 0);
      return { booking: v.bookingReference, time: row.time, token: row.token, serving: active?.token, ahead,
        state: row.state, reason: row.reason, estimate: durations.length && row.state === "Waiting" ? Math.ceil(ahead * durations.reduce((a,b) => a + b, 0) / durations.length) : null };
    }));
    res.json(results.filter(Boolean));
  });
}
module.exports = registerQueue;

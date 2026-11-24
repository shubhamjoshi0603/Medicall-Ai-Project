const mongoose = require("mongoose");

const Leave = mongoose.model("DoctorLeave", new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
  from: String, through: String, reason: { type: String, maxlength: 200 },
  status: { type: String, enum: ["Pending", "Approved", "Declined"], default: "Pending" },
}, { timestamps: true }));

function validDay(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T12:00:00Z");
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0,10) === date;
}
function minutes(time) { const [h,m] = time.split(":").map(Number); return h * 60 + m; }
function slotTimes(hours, shifts, booked, date, now = new Date()) {
  if (!hours?.isOpen) return [];
  const start = minutes(hours.openTime), end = minutes(hours.closeTime);
  const weekday = new Date(date + "T12:00:00").getDay();
  const windows = shifts.length ? shifts.filter(s => s.dayOfWeek === weekday) : [{ startTime: hours.openTime, endTime: hours.closeTime, slotMinutes: 30 }];
  const slots = new Set();
  for (const window of windows) {
    if (!(window.slotMinutes > 0)) continue;
    for (let t = minutes(window.startTime); t + window.slotMinutes <= Math.min(end, minutes(window.endTime)); t += window.slotMinutes) {
      const time = [Math.floor(t/60), t%60].map(n => String(n).padStart(2,"0")).join(":");
      if (t >= start && !booked.includes(time) && new Date(date + "T" + time) > now) slots.add(time);
    }
  }
  return [...slots].sort();
}
async function availableSlots({ Doctor, Clinic, Appointment, Availability }, clinicId, doctorId, date, exceptId) {
  if (!validDay(date) || !mongoose.isValidObjectId(clinicId) || !mongoose.isValidObjectId(doctorId)) return [];
  const scope = { clinicId, doctorId };
  const [doctor, clinic, leave, shifts, booked] = await Promise.all([
    Doctor.exists({ _id: doctorId, clinicId, isActive: true }), Clinic.findById(clinicId).select("businessHours"),
    Leave.exists({ ...scope, status: "Approved", from: { $lte: date }, through: { $gte: date } }),
    Availability.find({ ...scope, approved: true }).lean(),
    Appointment.find({ ...scope, date, status: "Confirmed", ...(exceptId && { _id: { $ne: exceptId } }) }).distinct("time"),
  ]);
  if (!doctor || !clinic || leave) return [];
  const hours = clinic.businessHours.find(h => h.dayOfWeek === new Date(date + "T12:00:00").getDay());
  return slotTimes(hours, shifts, booked, date);
}
function register(app, models, { protect, protectDoctor }) {
  app.get("/api/public/slots", async (req, res) => {
    const { clinicId, doctorId, date } = req.query;
    res.set("Cache-Control","no-store").json(await availableSlots(models, clinicId, doctorId, date));
  });
  app.get("/api/doctor/leave", protectDoctor, async (req, res) => res.json(await Leave.find({ clinicId: req.clinicId, doctorId: req.doctorId }).sort({ from: -1 })));
  app.post("/api/doctor/leave", protectDoctor, async (req, res) => {
    const { from, through, reason } = req.body;
    if (!validDay(from) || !validDay(through) || from < new Date().toLocaleDateString("en-CA") || through < from || typeof reason !== "string" || !reason.trim() || reason.length > 200)
      return res.status(400).json({ message: "Enter a valid future date range and a short reason." });
    res.status(201).json(await Leave.create({ clinicId: req.clinicId, doctorId: req.doctorId, from, through, reason }));
  });
  app.get("/api/clinic/leave", protect, async (req,res) => res.json(await Leave.find({ clinicId:req.clinicId }).populate("doctorId","name").sort({ createdAt:-1 })));
  app.patch("/api/clinic/leave/:id", protect, async (req,res) => {
    const { status } = req.body;
    if (!["Approved","Declined"].includes(status)) return res.status(400).json({ message:"Choose a valid decision." });
    const item = await Leave.findOneAndUpdate({ _id:req.params.id, clinicId:req.clinicId,status:"Pending" },{ status },{ new:true });
    if (!item) return res.status(409).json({ message:"Request already reviewed or unavailable." });
    res.json(item);
  });
}
module.exports = { slotTimes, validDay, availableSlots, register };

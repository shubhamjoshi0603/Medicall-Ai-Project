const mongoose = require("mongoose");
const { validDay } = require("./scheduling");

const tests = ["Complete blood count (CBC)", "Blood glucose", "Lipid profile", "Thyroid profile", "Liver function panel"];
const slots = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
function futureSlot(date, time) {
  return typeof date === "string" && validDay(date) && slots.includes(time) &&
    Date.parse(date + "T" + time + ":00+05:30") > Date.now();
}
const schema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  test: { type: String, trim: true, maxlength: 100, required: true }, date: String, time: String,
  location: { latitude: Number, longitude: Number }, phone: String, address: String, staff: String, staffKey: String, reason: String,
  status: { type: String, enum: ["Requested", "Approved", "Declined"], default: "Requested" }
}, { timestamps: true });
schema.index({ clinicId: 1, date: 1, time: 1, staffKey: 1 }, { unique: true, partialFilterExpression: {status: "Approved"} });
schema.index({ clinicId: 1, patientId: 1, date: 1, time: 1, test: 1 }, {unique:true});
const LabRequest = mongoose.model("HomeLabRequest", schema);
const clean = value => typeof value === "string" ? value.trim() : "";

function registerLabRequests(app, {Clinic, listedClinics, protect, protectPatient}) {
  for (const [role, auth, scope] of [["clinic", protect, "clinicId"], ["patient", protectPatient, "patientId"]]) {
    app.get("/api/" + role + "/home-labs", auth, async (req,res) => {
      const rows = await LabRequest.find({ [scope]: req[scope] }).sort({ createdAt: -1 })
        .populate(role === "clinic" ? "patientId" : "clinicId", role === "clinic" ? "fullName" : "clinicName");
      res.set("Cache-Control","no-store").json({ rows, tests, slots });
    });
  }
  app.post("/api/patient/home-labs", protectPatient, async (req,res) => {
    const {clinicId, date, time, location} = req.body || {};
    const test = clean(req.body?.test);
    if (!test || test.length > 100) return res.status(400).json({message:"Enter a test name of up to 100 characters."});
    if (location != null && (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 ||
        !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180))
      return res.status(400).json({message:"Choose your current location again."});
    const phone = clean(req.body?.phone), address = clean(req.body?.address);
    if (!mongoose.isObjectIdOrHexString(clinicId) || !futureSlot(date,time) ||
        !/^\+?[\d\s()-]{7,20}$/.test(phone) || phone.replace(/\D/g,"").length < 7 || address.length < 5 || address.length > 400)
      return res.status(400).json({message:"Choose a future slot and enter a valid contact number and collection address."});
    if (!await Clinic.exists({_id:clinicId,...listedClinics})) return res.status(404).json({message:"Clinic unavailable."});
    try {
      await LabRequest.create({clinicId,patientId:req.patientId,test,date,time,phone,address,location:location && {latitude:location.latitude,longitude:location.longitude}});
      res.status(201).json({message:"Request sent. The clinic will review staff availability."});
    } catch (err) {
      if (err.code !== 11000) throw err;
      res.status(409).json({message:"This test and slot have already been requested. Check your requests or choose another slot."});
    }
  });
  app.patch("/api/clinic/home-labs/:id", protect, async (req,res) => {
    const {status} = req.body || {};
    const staff = clean(req.body?.staff).replace(/\s+/g," "), reason = clean(req.body?.reason);
    if (!mongoose.isObjectIdOrHexString(req.params.id) || !["Approved","Declined"].includes(status) ||
        (status === "Approved" ? !staff || staff.length > 80 : !reason || reason.length > 200))
      return res.status(400).json({message:"Provide the assigned collector to approve, or a reason to decline."});
    const filter = {_id:req.params.id,clinicId:req.clinicId,status:"Requested"};
    const visit = await LabRequest.findOne(filter);
    if (!visit) return res.status(404).json({message:"Pending request not found. Refresh your list."});
    if (status === "Approved" && !futureSlot(visit.date, visit.time)) return res.status(409).json({message:"This slot has passed. Decline it so the patient can request another."});
    try {
      const update = status === "Approved" ? {status,staff,staffKey:staff.toLowerCase()} : {status,reason};
      const saved = await LabRequest.updateOne(filter, {$set:update});
      if (!saved.modifiedCount) return res.status(409).json({message:"Request already reviewed."});
      res.json({message:"Request " + status.toLowerCase() + "."});
    } catch (err) {
      if (err.code !== 11000) throw err;
      res.status(409).json({message:"This collector is already assigned for this slot."});
    }
  });
}
module.exports = {registerLabRequests, futureSlot};

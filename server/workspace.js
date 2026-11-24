const mongoose = require("mongoose");

const { Schema } = mongoose;
const shortText = { type: String, required: true, trim: true, maxlength: 120 };
const owner = { type: Schema.Types.ObjectId, required: true, index: true };
const staff = mongoose.model("ClinicStaff", new Schema({
  clinicId: owner, name: shortText, role: shortText, contact: { type: String, maxlength: 120 },
}, { timestamps: true }));
const inventory = mongoose.model("PharmacyBatch", new Schema({
  clinicId: owner, medicine: shortText, batch: shortText,
  quantity: { type: Number, required: true, min: 0, max: 10000000, validate: Number.isInteger },
  expiry: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
}, { timestamps: true }));
const history = mongoose.model("PatientHistoryEntry", new Schema({
  patientId: owner, category: { type: String, enum: ["Allergy", "Medication", "Vaccination", "Medical history"], required: true },
  name: shortText, date: { type: String, match: /^$|^\d{4}-\d{2}-\d{2}$/ }, note: { type: String, maxlength: 1000 },
}, { timestamps: true }));

function registerList(app, path, guard, model, ownerField, fields) {
  const scope = (req) => ({ [ownerField]: req[ownerField] });
  const payload = (req) => Object.fromEntries(fields.map((field) => [field, req.body?.[field]]));
  const handle = (action) => async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      if (error.name === "ValidationError" || error.name === "CastError") return res.status(400).json({ message: "Check the values you entered." });
      return res.status(500).json({ message: "The records could not be updated or retrieved." });
    }
  };
  app.get(path, guard, handle(async (req, res) => res.json(await model.find(scope(req)).sort({ updatedAt: -1 }).lean())));
  app.post(path, guard, handle(async (req, res) => res.status(201).json(await model.create({ ...payload(req), ...scope(req) }))));
  app.put(path + "/:id", guard, handle(async (req, res) => {
    const record = await model.findOneAndUpdate({ ...scope(req), _id: req.params.id, __v: req.body.version },
      { $set: payload(req), $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (!record) return res.status(409).json({ message: "This record has changed. Refresh before editing." });
    res.json(record);
  }));
  app.delete(path + "/:id", guard, handle(async (req, res) => {
    const result = await model.deleteOne({ ...scope(req), _id: req.params.id, __v: Number(req.query.version) });
    if (!result.deletedCount) return res.status(409).json({ message: "Refresh to see the latest record." });
    res.sendStatus(204);
  }));
}

module.exports = function registerWorkspace(app, { protect, protectPatient }) {
  registerList(app, "/api/clinic/staff", protect, staff, "clinicId", ["name", "role", "contact"]);
  registerList(app, "/api/clinic/pharmacy", protect, inventory, "clinicId", ["medicine", "batch", "quantity", "expiry"]);
  registerList(app, "/api/patient/history", protectPatient, history, "patientId", ["category", "name", "date", "note"]);
};

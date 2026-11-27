const bcrypt = require("bcryptjs");
const { isObjectIdOrHexString: validId } = require("mongoose");
function profileFields(body) {
  const name = String(body.name || "").trim();
  const specialization = String(body.specialization || "").trim();
  const fee = Number(body.fee);
  if (!name || !specialization || body.fee == null || String(body.fee).trim() === "" || !Number.isFinite(fee) || fee < 0) return null;
  return {name, specialization, fee};
}
module.exports = function({app, Doctor, Clinic, doctorIdentity, protect, validateAccountCredentials, verifySignup}) {
  app.post("/api/doctor-auth/register", validateAccountCredentials, verifySignup("doctor"), async (req,res) => {
    const fields = profileFields(req.body);
    if (!fields) return res.status(400).json({message:"Enter your name, specialty and a valid visit fee."});
    try {
      await Doctor.create({...fields,email:req.body.email.trim().toLowerCase(),password:await bcrypt.hash(req.body.password,12),selfRegistered:true});
      res.status(201).json({message:"Account created. Sign in to request clinic membership."});
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({message:"A doctor already uses this email."});
      throw err;
    }
  });
  app.patch("/api/doctor/profile", doctorIdentity, updateProfile);
  app.patch("/api/doctors/:id/profile", protect, updateProfile);
  async function updateProfile(req,res) {
    const fields = profileFields(req.body);
    if (!fields) return res.status(400).json({message:"Enter a name, specialty and a valid visit fee."});
    const filter = req.doctorId ? {_id:req.doctorId} : {_id:req.params.id, clinicId:req.clinicId};
    if (!validId(filter._id)) return res.sendStatus(400);
    if (req.body.newEmail) {
      const email=String(req.body.newEmail).trim().toLowerCase();
      const current=await Doctor.findOne(filter).select("email");
      if (!current) return res.sendStatus(404);
      if (!req.doctorId && !await require("./signupVerification").consumeCode("doctor",current.email,req.body.currentEmailCode)) return res.status(400).json({message:"The current doctor mailbox must approve this change."});
      filter.email=current.email;
      if (!await require("./signupVerification").consumeCode("doctor",email,req.body.emailCode)) return res.status(400).json({message:"Verify the new email address first."});
      fields.email=email;
    }
    let doctor;
    try { doctor=await Doctor.findOneAndUpdate(filter,{$set:fields,...(fields.email?{$inc:{sessionVersion:1}}:{})},{new:true,runValidators:true}); }
    catch(err){if(err.code===11000)return res.status(409).json({message:"This email already belongs to a doctor."});throw err;}
    if (!doctor) return res.sendStatus(404);
    res.json({message:"Doctor profile updated."});
  }
  app.post("/api/doctor/clinic-request", doctorIdentity, async (req,res) => {
    const id = req.body.clinicId;
    if (!validId(id) || !await Clinic.exists({_id:id})) return res.status(400).json({message:"Choose a registered clinic."});
    const result = await Doctor.updateOne({_id:req.doctorId, clinicId:null,requestedClinic:null},{$set:{requestedClinic:id}});
    if (!result.modifiedCount) return res.status(409).json({message:"You already have a clinic or a pending request."});
    res.json({message:"Request sent to the clinic."});
  });
  app.get("/api/team/requests", protect, async (req,res) => {
    res.json(await Doctor.find({requestedClinic:req.clinicId,clinicId:null}).select("name specialization fee email"));
  });
  app.post("/api/team/requests/:id", protect, async (req,res) => {
    if (!validId(req.params.id) || !["approve","decline"].includes(req.body.decision)) return res.sendStatus(400);
    const update = {requestedClinic:null};
    if (req.body.decision==="approve") update.clinicId=req.clinicId;
    const result = await Doctor.updateOne({_id:req.params.id,clinicId:null,requestedClinic:req.clinicId},{$set:update});
    if (!result.modifiedCount) return res.status(409).json({message:"This request is no longer pending."});
    res.json({message:update.clinicId ? "Doctor added to your team." : "Request declined."});
  });
};

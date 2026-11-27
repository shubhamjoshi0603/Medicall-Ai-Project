const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Challenge = mongoose.model("SignupChallenge", new mongoose.Schema({
  _id: String, digest: String, attempts: Number, sentAt: Date, expiresAt: { type: Date, expires: 0 }
}));
function digest(key, code) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(key + ":" + code).digest("hex");
}
function setupVerification(app, send) {
  app.post("/api/signup/email-code", async (req, res) => {
    const { role } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!["patient","clinic","doctor"].includes(role) || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) return res.status(400).json({message:"Enter a valid email address."});
    const key = role + ":" + email;
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
    const hash = digest(key, code);
    try {
      await Challenge.findOneAndUpdate({_id:key, sentAt:{$lt:new Date(Date.now()-60000)}},
        {$set:{digest:hash,attempts:0,sentAt:new Date(),expiresAt:new Date(Date.now()+600000)}},{upsert:true});
    } catch (err) {
      if (err.code === 11000) return res.status(429).json({message:"Wait one minute before requesting another code."});
      throw err;
    }
    try {
      if (!await send({to:email, subject:"Verify your MediCall email",text:"Your registration code is " + code + ". It expires in 10 minutes.", html:"<p>Your registration code is <strong>"+code+"</strong>. It expires in 10 minutes.</p>"})) throw Error("Mail unavailable");
      res.json({message:"Check your inbox for the verification code."});
    } catch {
      await Challenge.deleteOne({_id:key,digest:hash});
      res.status(503).json({message:"Could not send the verification code. Check the address and retry."});
    }
  });
}
async function consumeCode(role,email,rawCode) {
  const key=role+":"+String(email || "").trim().toLowerCase();
  const code=String(rawCode || "").trim().toLowerCase();
  if (!/^\d{6}$/.test(code)) return false;
  const hash = digest(key, code);
  const active = { _id: key, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } };
  if (await Challenge.findOneAndDelete({ ...active, digest: hash })) return true;
  await Challenge.updateOne({ ...active, digest: { $ne: hash } }, { $inc: { attempts: 1 } });
  return false;
}
const verifySignup = role => async (req,res,next) => {
  if (role === "doctor" && req.path === "/api/doctors" && !req.body.email) return next();
  if (!await consumeCode(role,req.body.email,req.body.emailCode)) {
    return res.status(400).json({message:"Enter the latest 6-digit code sent to this email. If it expired or you tried five times, request a new code."});
  }
  next();
};
module.exports = {setupVerification, verifySignup, consumeCode};

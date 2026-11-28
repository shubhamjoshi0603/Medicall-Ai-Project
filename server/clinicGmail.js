const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Mailbox = mongoose.model("ClinicMailbox", new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId, email: String, encrypted: String,
  state: { type: String, index: true }, expires: Date
}));
const scope = "https://www.googleapis.com/auth/gmail.send";
const callback = () => process.env.CLINIC_GMAIL_REDIRECT_URI || "https://medicall-ai-project.onrender.com/api/clinic/gmail/callback";
const key = () => crypto.scryptSync(process.env.JWT_SECRET, "medicall-clinic-mailbox-v1", 32);
function encrypt(token, id) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(String(id)));
  const bytes = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map(b => b.toString("base64")).join(".");
}
async function sender(clinicId, Clinic) {
  const clinic = await Clinic.findById(clinicId).select("email").lean();
  if (!clinic) return null;
  const box = await Mailbox.findOne({ _id: clinicId, email: clinic.email }).lean();
  if (!box?.encrypted) return null;
  const [iv, tag, bytes] = box.encrypted.split(".").map(v => Buffer.from(v, "base64"));
  const cipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(String(clinicId)));
  cipher.setAuthTag(tag);
  return { email: box.email, token: Buffer.concat([cipher.update(bytes), cipher.final()]).toString() };
}
function routes(app, protect, Clinic) {
  app.post("/api/clinic/gmail/connect", protect, async (req, res) => {
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) return res.status(503).json({message:"Gmail connection is unavailable."});
    const clinic = await Clinic.findById(req.clinicId).select("email").lean();
    const state = crypto.randomBytes(32).toString("hex");
    await Mailbox.updateOne({_id:req.clinicId}, {$set:{state, expires:new Date(Date.now()+600000)}}, {upsert:true});
    const params = new URLSearchParams({client_id:process.env.GMAIL_CLIENT_ID, redirect_uri:callback(),
      response_type:"code", scope:"openid email "+scope, state, login_hint:clinic.email, access_type:"offline", prompt:"consent"});
    res.json({url:"https://accounts.google.com/o/oauth2/v2/auth?"+params});
  });
  app.get("/api/clinic/gmail/callback", async (req,res) => {
    res.set({"Cache-Control":"no-store","Referrer-Policy":"no-referrer"});
    try {
      if (typeof req.query.state !== "string" || !/^[a-f0-9]{64}$/.test(req.query.state)) return res.status(400).send("Invalid connection request.");
      const box = await Mailbox.findOneAndUpdate({state:req.query.state, expires:{$gt:new Date()}}, {$unset:{state:1,expires:1}});
      if (!box || typeof req.query.code !== "string") return res.status(400).send("Connection expired or cancelled. Return to clinic settings and try again.");
      const response = await fetch("https://oauth2.googleapis.com/token",{method:"POST",signal:AbortSignal.timeout(15000),body:new URLSearchParams({
        code:req.query.code,grant_type:"authorization_code",client_id:process.env.GMAIL_CLIENT_ID,client_secret:process.env.GMAIL_CLIENT_SECRET,redirect_uri:callback()
      })});
      const credentials = await response.json();
      if (!response.ok || !credentials.refresh_token || !credentials.scope?.split(" ").includes(scope)) throw new Error();
      const identity = await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+credentials.access_token},signal:AbortSignal.timeout(10000)});
      const user = await identity.json();
      const clinic = await Clinic.findById(box._id).select("email").lean();
      if (!identity.ok || user.email_verified !== true || user.email?.toLowerCase() !== clinic?.email) return res.status(403).send("Choose the verified Google account matching your registered clinic email.");
      await Mailbox.updateOne({_id:box._id},{$set:{email:clinic.email,encrypted:encrypt(credentials.refresh_token,box._id)}});
      res.send("Clinic Gmail connected. Return to MediCall to manage appointments.");
    } catch { res.status(502).send("Could not connect Gmail. Return to clinic settings and try again."); }
  });
}
module.exports = {sender,routes};

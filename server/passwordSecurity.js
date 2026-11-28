const crypto = require("node:crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const resetSchema = new mongoose.Schema({
  role: { type: String, enum: ["clinic", "patient", "doctor"], required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
resetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
resetSchema.index({ role: 1, accountId: 1 });
const PasswordReset = mongoose.models.PasswordReset || mongoose.model("PasswordReset", resetSchema);

const requestBuckets = new Map();
const RESET_MESSAGE = "If an account matches this email, a password reset link will be sent shortly.";

function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

function canRequestFrom(ip) {
  const now = Date.now();
  const key = String(ip || "unknown");
  const current = requestBuckets.get(key);
  if (!current || current.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (current.count >= 6) return false;
  current.count += 1;
  if (requestBuckets.size > 5000) {
    for (const [bucketKey, bucket] of requestBuckets) if (bucket.resetAt <= now) requestBuckets.delete(bucketKey);
  }
  return true;
}

module.exports = function registerPasswordSecurity(app, { Clinic, Patient, Doctor, protect, protectPatient, protectDoctor, sendEmail, resetBaseUrl }) {
  const accountModels = { clinic: Clinic, patient: Patient, doctor: Doctor };

  app.post("/api/password/forgot", async (req, res) => {
    const role = String(req.body?.role || "").toLowerCase();
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!Object.hasOwn(accountModels, role) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ message: "Choose a valid account type and enter a valid email address." });
    }
    if (!canRequestFrom(req.ip)) return res.status(429).json({ message: "Too many reset requests. Please wait a few minutes and try again." });
    if (!resetBaseUrl || !sendEmail) return res.status(503).json({ message: "Password reset email is not configured. Please contact support." });

    try {
      const Model = accountModels[role];
      const account = role === "doctor"
        ? await Model.findOne({ email, isActive: true }).select("name email")
        : await Model.findOne({ email }).select("email");

      if (account) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
        await PasswordReset.deleteMany({ role, accountId: account._id });
        await PasswordReset.create({ role, accountId: account._id, tokenHash: hashToken(token), expiresAt });
        const link = new URL("/", resetBaseUrl);
        link.searchParams.set("passwordResetToken", token);
        link.searchParams.set("role", role);
        const greeting = role === "doctor" ? `Dr. ${account.name || ""}`.trim() : role === "clinic" ? "Clinic administrator" : "there";
        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#183044"><p style="color:#087d72;font-weight:700">MediCall AI · Account security</p><h2>Reset your password</h2><p>Hello ${greeting},</p><p>We received a request to reset the password for the ${role} account associated with this email.</p><p><a href="${link.toString()}" style="display:inline-block;background:#087d72;color:white;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Reset password</a></p><p>This link expires in 20 minutes and can be used once. If you did not request it, you can ignore this email.</p><p style="color:#607587;font-size:13px">For doctor accounts, only the doctor can use this link to manage their password.</p></div>`;
        try {
          await sendEmail({ to: account.email, subject: "Reset your MediCall AI password", html, text: `Hello ${greeting}. Reset your ${role} password using this one-time link (expires in 20 minutes): ${link.toString()}. If you did not request this, ignore this email.` });
        } catch (mailError) {
          await PasswordReset.deleteOne({ role, accountId: account._id, tokenHash: hashToken(token) });
          console.error("Password reset email failed:", mailError.message);
        }
      }
      return res.json({ message: RESET_MESSAGE });
    } catch (error) {
      console.error("Password reset request failed:", error.message);
      return res.status(500).json({ message: "Could not process the reset request. Please try again." });
    }
  });

  app.post("/api/password/reset", async (req, res) => {
    const role = String(req.body?.role || "").toLowerCase();
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");
    if (!Object.hasOwn(accountModels, role) || !/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ message: "This reset link is invalid or expired. Request a new one." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
    try {
      const reset = await PasswordReset.findOneAndDelete({ role, tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
      if (!reset) return res.status(400).json({ message: "This reset link is invalid, expired or already used. Request a new one." });
      const Model = accountModels[role];
      const filter = role === "doctor" ? { _id: reset.accountId, isActive: true } : { _id: reset.accountId };
      const account = await Model.findOneAndUpdate(filter, { $set: { password: await bcrypt.hash(password, 12) }, $inc: { sessionVersion: 1 } }, { new: true }).select("email");
      await PasswordReset.deleteMany({ role, accountId: reset.accountId });
      if (!account) return res.status(400).json({ message: "This reset link is invalid or the account is unavailable." });
      try {
        await sendEmail?.({ to: account.email, subject: "Your MediCall AI password was changed", html: "<p>Your MediCall AI password was changed successfully. If you did not make this change, contact your clinic or MediCall support immediately.</p>", text: "Your MediCall AI password was changed successfully. If you did not make this change, contact support immediately." });
      } catch (mailError) { console.error("Password change alert email failed:", mailError.message); }
      return res.json({ message: "Your password has been reset successfully." });
    } catch (error) {
      console.error("Password reset failed:", error.message);
      return res.status(500).json({ message: "Could not reset your password. Request a new link and try again." });
    }
  });

  async function changePassword(role, accountId, body, res) {
    const currentPassword = String(body?.currentPassword || "");
    const password = String(body?.password || "");
    if (!currentPassword || password.length < 8 || password.length > 128) return res.status(400).json({ message: "Enter your current password and a new password between 8 and 128 characters." });
    if (currentPassword === password) return res.status(400).json({ message: "Choose a new password that is different from your current one." });
    try {
      const Model = accountModels[role];
      const filter = role === "doctor" ? { _id: accountId, isActive: true } : { _id: accountId };
      const account = await Model.findOne(filter).select("+password email");
      if (!account || !account.password || !(await bcrypt.compare(currentPassword, account.password))) return res.status(401).json({ message: "Your current password is incorrect." });
      account.password = await bcrypt.hash(password, 12);
      account.sessionVersion = Number(account.sessionVersion || 0) + 1;
      await account.save();
      await PasswordReset.deleteMany({ role, accountId: account._id });
      try {
        await sendEmail?.({ to: account.email, subject: "Your MediCall AI password was changed", html: "<p>Your MediCall AI password was changed successfully. If you did not make this change, contact your clinic or MediCall support immediately.</p>", text: "Your MediCall AI password was changed successfully. If you did not make this change, contact support immediately." });
      } catch (mailError) { console.error("Password change alert email failed:", mailError.message); }
      return res.json({ message: "Password updated. Please sign in again with your new password." });
    } catch (error) {
      console.error("Change password failed:", error.message);
      return res.status(500).json({ message: "Could not change your password. Please try again." });
    }
  }

  app.patch("/api/auth/password", protect, (req, res) => changePassword("clinic", req.clinicId, req.body, res));
  app.patch("/api/patient-auth/password", protectPatient, (req, res) => changePassword("patient", req.patientId, req.body, res));
  app.patch("/api/doctor-auth/password", protectDoctor, (req, res) => changePassword("doctor", req.doctorId, req.body, res));
};

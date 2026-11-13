
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Groq = require("groq-sdk");
const multer = require("multer");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 5000;

// Development CORS: allow localhost and private-LAN Vite origins so a phone
// on the same Wi-Fi can use the app. In production, set CLIENT_URL explicitly.
const configuredOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function isPrivateDevHost(hostname) {
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // curl/Postman/server requests
    if (configuredOrigins.includes(origin)) return callback(null, true);
    try {
      const url = new URL(origin);
      if (process.env.NODE_ENV !== "production" && isPrivateDevHost(url.hostname)) {
        return callback(null, true);
      }
    } catch {}
    return callback(new Error("Origin is not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "1mb" }));

const { Schema } = mongoose;

// ==================== GROQ AI CHAT ====================

const mailTransporter = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

async function sendAppointmentEmail({ to, patientName, clinicName, doctorName, date, time, status = "Confirmed", appointmentId, bookingReference }) {
  if (!mailTransporter || !to) return false;
  const bookingId = bookingReference || appointmentId;
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const subject = status === "Confirmed" ? "Your MediCall AI appointment is confirmed" : `Your MediCall AI appointment was ${status.toLowerCase()}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#172033">
      <h2 style="color:#0f766e">MediCall AI</h2>
      <p>Dear ${escapeHtml(patientName)},</p>
      <p>Your appointment with <strong>${escapeHtml(doctorName)}</strong> at <strong>${escapeHtml(clinicName)}</strong> is <strong>${escapeHtml(status)}</strong>.</p>
      <div style="background:#f0fdfa;padding:16px;border-radius:12px">
        <p><strong>Date:</strong> ${escapeHtml(date)}</p><p><strong>Time:</strong> ${escapeHtml(time)}</p>
        <p><strong>Booking ID:</strong> ${escapeHtml(String(bookingId))}</p>
      </div>
      <p>If you need to change your appointment, please contact the clinic.</p><p>Thank you,<br/>MediCall AI</p>
    </div>`;
  await mailTransporter.sendMail({ from, to, subject, html, text: `Dear ${patientName}, your appointment with ${doctorName} at ${clinicName} is ${status}. Date: ${date}; Time: ${time}; Booking ID: ${bookingId}.` });
  return true;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

const groq = process.env.GROQ_API_KEY
  ? new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 20000,
      maxRetries: 1,
    })
  : null;


// Conversation-scoped booking state. For a multi-instance production deployment,
// move this map to Redis or persist it in MongoDB.
const bookingSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
function getBookingSession(id) {
  const entry = bookingSessions.get(id);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > SESSION_TTL_MS) {
    bookingSessions.delete(id);
    return null;
  }
  entry.updatedAt = Date.now();
  return entry;
}
function normalizePhone(value) { return String(value || '').replace(/[^\d+]/g, ''); }
function parseDateTime(text) {
  const value = String(text || '').trim();
  let date = '';
  let time = '';
  let m = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) date = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  if (!date && (m = value.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/))) date = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (!date && /\btomorrow\b/i.test(value)) { const d = new Date(); d.setDate(d.getDate()+1); date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  if (!date && /\btoday\b/i.test(value)) { const d = new Date(); date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  m = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) {
    let h = Number(m[1]); const min = Number(m[2] || 0); const ap = String(m[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) time = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }
  return { date, time };
}
function matchDoctor(text, doctors) {
  const lower = String(text || '').toLowerCase();
  return doctors.find(d => lower.includes(String(d.name || '').toLowerCase())) || null;
}

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "video/webm") {
      return callback(null, true);
    }
    return callback(new Error("Please upload a supported audio recording."));
  },
});

// Sarvam Saaras v3: return Roman-script Hindi/Hinglish for speech input.
app.post("/api/transcribe", uploadAudio.single("audio"), async (req, res) => {
  try {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "SARVAM_API_KEY is missing from server/.env" });
    }
    if (!req.file) return res.status(400).json({ message: "Audio recording is required." });

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" });
    form.append("file", blob, req.file.originalname || "recording.webm");
    form.append("model", "saaras:v3");
    form.append("mode", "translit");
    form.append("language_code", "unknown");

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(45000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Sarvam STT error:", response.status, payload);
      return res.status(response.status === 429 ? 429 : 502).json({
        message: payload?.error?.message || payload?.message || "Sarvam speech recognition failed. Check SARVAM_API_KEY and try again.",
      });
    }
    const text = typeof payload.transcript === "string" ? payload.transcript.trim() : "";
    if (!text) return res.status(422).json({ message: "No speech was detected. Please speak again." });
    return res.json({ text, languageCode: payload.language_code || "unknown" });
  } catch (error) {
    console.error("Sarvam transcription error:", error.message || error);
    return res.status(502).json({ message: "Speech recognition failed. Check the network and Sarvam API key." });
  }
});

// Sarvam Bulbul TTS: return playable audio without exposing the API key to React.
app.post("/api/tts", async (req, res) => {
  try {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) return res.status(500).json({ message: "SARVAM_API_KEY is missing from server/.env" });
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ message: "Text is required for speech." });
    if (text.length > 2500) return res.status(400).json({ message: "Please shorten the reply before generating speech." });

    // Roman Hinglish is spoken best with Hindi voice; English replies use Indian English.
    const languageCode = req.body?.languageCode === "en-IN" ? "en-IN" : "hi-IN";
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
        language_code: languageCode,
        speaker: process.env.SARVAM_TTS_SPEAKER || "shubh",
        pace: 1.0,
        output_audio_codec: "mp3",
      }),
      signal: AbortSignal.timeout(45000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Sarvam TTS error:", response.status, payload);
      return res.status(response.status === 429 ? 429 : 502).json({
        message: payload?.error?.message || payload?.message || "Voice generation failed. Check the Sarvam API configuration.",
      });
    }
    const audioBase64 = payload.audios?.[0];
    if (!audioBase64) return res.status(502).json({ message: "Voice provider returned empty audio." });
    return res.json({ audio: audioBase64, mimeType: "audio/mpeg" });
  } catch (error) {
    console.error("Sarvam TTS error:", error.message || error);
    return res.status(502).json({ message: "Voice generation failed. Check the network and Sarvam API key." });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return res.status(400).json({ message: "Please enter a message." });
    if (message.length > 4000) return res.status(400).json({ message: "Message is too long." });
    if (!groq) return res.status(500).json({ message: "GROQ_API_KEY is missing from server/.env" });

    const requestedClinicId = req.body?.clinicId;
    if (!requestedClinicId || !mongoose.isValidObjectId(requestedClinicId)) {
      return res.status(400).json({ message: "Clinic context is missing. Refresh the page and try again." });
    }
    const clinic = await Clinic.findById(requestedClinicId).select("clinicName location");
    if (!clinic) return res.status(404).json({ message: "Clinic not found." });
    const doctors = await Doctor.find({ clinicId: clinic._id, isActive: true }).select("name specialization fee").sort({ name: 1 });
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-16) : [];
    const conversation = history
      .filter((item) => ["user", "assistant"].includes(item?.role) && typeof item?.text === "string")
      .map((item) => ({ role: item.role, content: item.text.slice(0, 1500) }));
    conversation.push({ role: "user", content: message });

    const conversationId = String(req.body?.conversationId || '').trim();
    if (!conversationId || conversationId.length > 120) {
      return res.status(400).json({ message: "Conversation ID is missing. Refresh the page and try again." });
    }
    await recordConversation({ clinicId: clinic._id, conversationId, channel: req.body?.channel === "voice" ? "voice" : "chat" });
    const lowerMessage = message.toLowerCase();
    const priorAssistant = [...history].reverse().find(item => item?.role === 'assistant')?.text || '';
    let session = getBookingSession(conversationId);
    const explicitBookingIntent = /\b(book|booking|schedule|make an appointment|appointment book|appointment with)\b/i.test(message) && !/\b(status|already booked|is my appointment done|check my appointment)\b/i.test(message);
    const yesConfirmation = /^(yes|yeah|yep|confirm|confirmed|book it|do it|haan|han|ji|yes confirm|please confirm)[.!\s]*$/i.test(message);
    const assistantOfferedBooking = /would you like to book|shall i book|want to book|like to book/i.test(priorAssistant);

    // Start a deterministic booking flow when booking is requested (including a clear yes
    // after the assistant explicitly offered to book). The LLM is not trusted to remember fields.
    if (!session && (explicitBookingIntent || (yesConfirmation && assistantOfferedBooking))) {
      session = { clinicId: String(clinic._id), patientName: '', patientEmail: '', phone: '', doctorId: '', doctorName: '', date: '', time: '', reason: '', step: 'name', updatedAt: Date.now(), createdAt: Date.now() };
      const doctorInMessage = matchDoctor(message, doctors);
      const doctorInHistory = matchDoctor(history.map(x => x.text || '').join(' '), doctors);
      const doctor = doctorInMessage || doctorInHistory;
      if (doctor) { session.doctorId = String(doctor._id); session.doctorName = doctor.name; }
      // Reuse any details already shared earlier in this same conversation.
      for (const item of history.filter(x => x.role === 'user')) {
        const t = String(item.text || '').trim();
        const phoneMatch = t.match(/(?:\+?\d[\d\s().-]{8,}\d)/);
        if (phoneMatch) session.phone = normalizePhone(phoneMatch[0]);
        const foundDoctor = matchDoctor(t, doctors);
        if (foundDoctor) { session.doctorId = String(foundDoctor._id); session.doctorName = foundDoctor.name; }
        const dt = parseDateTime(t); if (dt.date) session.date = dt.date; if (dt.time) session.time = dt.time;
        if (/\b(my name is|name is|i am|i'm)\b/i.test(t)) session.patientName = t.replace(/^.*?\b(?:my name is|name is|i am|i'm)\b\s*/i, '').replace(/[.!]+$/, '').trim();
      }
      bookingSessions.set(conversationId, session);
    }

    if (session && session.clinicId === String(clinic._id)) {
      // If the current message contains a real doctor name, retain it.
      const foundDoctor = matchDoctor(message, doctors);
      if (foundDoctor) { session.doctorId = String(foundDoctor._id); session.doctorName = foundDoctor.name; }
      const dt = parseDateTime(message); if (dt.date) session.date = dt.date; if (dt.time) session.time = dt.time;
      const phoneMatch = message.match(/(?:\+?\d[\d\s().-]{8,}\d)/);
      if (phoneMatch) session.phone = normalizePhone(phoneMatch[0]);
      const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (emailMatch) session.patientEmail = emailMatch[0].toLowerCase();

      const isYes = yesConfirmation;
      const isNo = /^(no|nope|cancel|stop|nah)[.!\s]*$/i.test(message);
      if (isNo && session.step === 'confirm') {
        bookingSessions.delete(conversationId);
        return res.json({ reply: "No problem. I haven't booked anything. Tell me whenever you'd like to start again.", bookingCreated: false, bookingState: null });
      }

      if (session.step === 'name') {
        if (!session.patientName) {
          const nameMatch = message.match(/(?:my name is|name is|i am|i'm)\s+(.+)/i);
          const looksLikeBookingRequest = /\b(book|booking|appointment|doctor|schedule|want|need)\b/i.test(message);
          const candidate = (nameMatch ? nameMatch[1] : message).trim().replace(/[.!]+$/, '');
          if (candidate.length >= 2 && candidate.length <= 100 && (Boolean(nameMatch) || !looksLikeBookingRequest) && !/^(yes|yeah|yep|no|hi|hello|book|appointment)$/i.test(candidate)) session.patientName = candidate;
        }
        if (!session.patientName) return res.json({ reply: "Sure. What is your full name?", bookingCreated: false, bookingState: session.step });
        session.step = 'phone';
        bookingSessions.set(conversationId, session);
        return res.json({ reply: `Thanks, ${session.patientName}. What phone number should the clinic use?`, bookingCreated: false, bookingState: session.step });
      }
      if (session.step === 'phone') {
        if (session.phone && session.phone.replace(/\D/g,'').length >= 10 && session.phone.replace(/\D/g,'').length <= 15) {
          session.step = 'email';
        } else {
          bookingSessions.set(conversationId, session);
          return res.json({ reply: "Please enter a valid phone number with 10 to 15 digits.", bookingCreated: false, bookingState: session.step });
        }
      }
      if (session.step === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(session.patientEmail || '')) {
          bookingSessions.set(conversationId, session);
          return res.json({ reply: "What email address should I send your appointment confirmation to?", bookingCreated: false, bookingState: session.step });
        }
        session.step = session.doctorId ? 'date' : 'doctor';
      }
      if (session.step === 'doctor') {
        if (!session.doctorId) {
          bookingSessions.set(conversationId, session);
          return res.json({ reply: `Which doctor would you like? Available doctors: ${doctors.map(d => d.name).join(', ') || 'please contact the clinic'}.`, bookingCreated: false, bookingState: session.step });
        }
        session.step = 'date';
      }
      if (session.step === 'date') {
        if (!session.date) {
          bookingSessions.set(conversationId, session);
          return res.json({ reply: "What date would you prefer? Please say a date like 2026-11-05 or say tomorrow.", bookingCreated: false, bookingState: session.step });
        }
        session.step = 'time';
      }
      if (session.step === 'time') {
        if (!session.time) {
          bookingSessions.set(conversationId, session);
          return res.json({ reply: "What time would you prefer? Clinic hours are 09:00 to 17:00; for example, 10:30 AM.", bookingCreated: false, bookingState: session.step });
        }
        session.step = 'confirm';
      }
      if (session.step === 'confirm') {
        if (!isYes) {
          bookingSessions.set(conversationId, session);
          const doctor = doctors.find(d => String(d._id) === session.doctorId);
          return res.json({ reply: `Please confirm these details: ${session.patientName}, phone ${session.phone}, ${doctor?.name || session.doctorName}, ${session.date} at ${session.time}. Say “yes, confirm” to book, or “no” to cancel.`, bookingCreated: false, bookingState: 'confirm', booking: { ...session } });
        }
        const doctor = doctors.find(d => String(d._id) === session.doctorId);
        if (!doctor || !session.patientName || !session.patientEmail || !session.phone || !session.date || !session.time) {
          session.step = !session.patientName ? 'name' : !session.phone ? 'phone' : !session.patientEmail ? 'email' : !session.doctorId ? 'doctor' : !session.date ? 'date' : 'time';
          bookingSessions.set(conversationId, session);
          return res.json({ reply: "I still need a few details before I can confirm. " + ({name:'What is your full name?',phone:'What phone number should the clinic use?',email:'What email address should receive the confirmation?',doctor:'Which doctor would you like?',date:'What date would you prefer?',time:'What time would you prefer?'}[session.step]), bookingCreated: false, bookingState: session.step });
        }
        const [year, month, day] = session.date.split('-').map(Number); const [hour, minute] = session.time.split(':').map(Number);
        const apptDate = new Date(year, month - 1, day, hour, minute);
        const dayOfWeek = apptDate.getDay();
        const clinicHours = (clinic.businessHours || []).find((item) => item.dayOfWeek === dayOfWeek);
        const outsideClinicHours = !clinicHours || clinicHours.isOpen === false || `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}` < (clinicHours?.openTime || "09:00") || `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}` >= (clinicHours?.closeTime || "17:00");
        if (apptDate.getTime() <= Date.now() || apptDate.getFullYear() !== year || apptDate.getMonth() !== month-1 || apptDate.getDate() !== day || minute > 59 || outsideClinicHours) {
          session.step = apptDate.getTime() <= Date.now() ? 'date' : 'time'; bookingSessions.set(conversationId, session);
          const reply = session.step === 'date' ? "That date must be in the future. What future date would you prefer?" : (!clinicHours || clinicHours.isOpen === false ? "The clinic is closed on that day. Please choose one of its working days." : `The clinic is open from ${clinicHours.openTime} to ${clinicHours.closeTime}. Please choose a time within these hours.`);
          return res.json({ reply, bookingCreated: false, bookingState: session.step });
        }
        try {
          const appointment = await Appointment.create({ clinicId: clinic._id, doctorId: doctor._id, patientName: session.patientName, patientEmail: session.patientEmail, phone: session.phone, date: session.date, time: session.time, reason: session.reason || '' });
          let emailSent = false;
          try { emailSent = await sendAppointmentEmail({ to: session.patientEmail, patientName: session.patientName, clinicName: clinic.clinicName, doctorName: doctor.name, date: session.date, time: session.time, status: appointment.status, appointmentId: appointment._id, bookingReference: appointment.bookingReference }); }
          catch (mailError) { console.error("Chat booking email failed:", mailError.message); }
          await recordConversation({ clinicId: clinic._id, conversationId, channel: req.body?.channel === "voice" ? "voice" : "chat", appointmentId: appointment._id });
          bookingSessions.delete(conversationId);
          const bookingId = appointment.bookingReference;
          const reply = `Bahut badhiya, ${session.patientName}! Aapki appointment successfully confirm ho gayi hai.

Doctor: ${doctor.name} (${doctor.specialization})
Clinic: ${clinic.clinicName}
Date: ${session.date}
Time: ${session.time}
Booking ID: ${bookingId}

${emailSent ? "Confirmation email bhi bhej diya gaya hai." : "Confirmation email abhi nahi bheja ja saka; please clinic se contact karein."}

MediCall AI se baat karne ke liye shukriya! Aapse baat karke achha laga. Apna khayal rakhiye!`;
          return res.status(201).json({ reply, languageCode: "hi-IN", bookingCreated: true, appointment: { id: appointment._id, bookingId, bookingReference: bookingId, patientName: session.patientName, phone: session.phone, doctorName: doctor.name, specialization: doctor.specialization, clinicName: clinic.clinicName, date: session.date, time: session.time, status: appointment.status } });
        } catch (err) {
          if (err.code === 11000) return res.status(409).json({ message: "That time slot is already booked. Please choose another time.", bookingCreated: false });
          throw err;
        }
      }
      bookingSessions.set(conversationId, session);
    }

    const systemPrompt = `You are MediCall AI, a clinic receptionist for ${clinic.clinicName}.
Reply in the user's current language/script. Roman Hinglish must stay Roman Hinglish (Latin letters); English stays English; never switch to Arabic or Urdu script unless explicitly requested. Be friendly, concise, ask only ONE question at a time.
Selected clinic details (use only this clinic; do not invent): ${JSON.stringify({ name: clinic.clinicName, address: clinic.location?.address || "", directionsUrl: clinic.location?.mapsUrl || "" })}
Verified doctors at this selected clinic (use only these; never invent): ${JSON.stringify(doctors.map(d => ({name:d.name, specialization:d.specialization, fee:d.fee, doctorId:String(d._id)})))}
When a patient describes symptoms or asks which doctor to see, provide navigation guidance only, not a diagnosis. Recommend only doctors from the verified list whose specialization fits the concern. Include the doctor's name, specialization/occupation, selected clinic name, and clinic address when available. If no relevant doctor is listed, say so and suggest contacting the clinic; never make up a doctor, specialty, address or opening time. When asked for directions, share the verified address and directions URL if available.
Clinic hours: 09:00-17:00.
Your job includes actually booking appointments. Use the entire conversation to extract booking details. If the user wants a booking, gather full name, phone number, valid email address for confirmation, exact future date (YYYY-MM-DD), time (HH:MM), doctor name, and reason (reason can be empty). Ask for any missing field one at a time. Do not ask for name/phone again if already supplied in conversation. If doctor name is ambiguous or unavailable, ask/offer a real doctor from the list.
Once all required fields are known, summarize all details and ask the user to confirm. Do NOT book until the latest user message clearly confirms (yes, confirm, book it, etc.) after you asked for confirmation. If confirmed, set confirmed=true and return the exact structured fields. If a user asks about status, do not claim to check by name/phone unless you have actually queried records; tell them you can book or staff can verify status.
Return ONLY valid JSON matching: {"reply":"text to show user","bookingIntent":true|false,"confirmationRequested":true|false,"confirmed":true|false,"booking":{"patientName":"","phone":"","email":"","doctorName":"","date":"YYYY-MM-DD","time":"HH:MM","reason":""}}. Always include all keys. If not booking, bookingIntent=false and confirmed=false. If fields are incomplete, put known fields in booking and blank unknown fields. Do not output markdown or extra keys.`;

    let parsed;
    const model = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...conversation],
        max_completion_tokens: 500,
        temperature: 0.2,
        response_format: { type: "json_object" },
      });
      const raw = completion.choices?.[0]?.message?.content?.trim();
      if (!raw) throw new Error("Groq returned an empty response");
      parsed = JSON.parse(raw);
    } catch (modelError) {
      console.error("Groq structured chat error:", modelError.status || "", modelError.message || modelError);
      return res.status(502).json({ message: "AI reply failed. Please try again; your message was not booked." });
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!reply) return res.status(502).json({ message: "AI returned an empty response. Please try again." });

    if (parsed.bookingIntent && parsed.confirmed === true) {
      const b = parsed.booking || {};
      const patientName = String(b.patientName || "").trim();
      const phone = String(b.phone || "").trim();
      const patientEmail = String(b.email || b.patientEmail || "").trim().toLowerCase();
      const date = String(b.date || "").trim();
      const time = String(b.time || "").trim();
      const doctorName = String(b.doctorName || "").trim();
      const reason = String(b.reason || "").trim();
      const doctor = doctors.find(d => d.name.toLowerCase() === doctorName.toLowerCase()) ||
        doctors.find(d => doctorName && d.name.toLowerCase().includes(doctorName.toLowerCase()));
      if (!patientName || !phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail) || !date || !time || !doctor) {
        return res.json({ reply: "I still need the patient's full name, phone number, valid email address, doctor, date and time before I can book. Please share the missing details.", bookingCreated: false });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
        return res.json({ reply: "Please provide the appointment date as YYYY-MM-DD and time as HH:MM, then confirm again.", bookingCreated: false });
      }
      const [year, month, day] = date.split("-").map(Number);
      const [hour, minute] = time.split(":").map(Number);
      const appointmentDate = new Date(year, month - 1, day, hour, minute);
      if (appointmentDate.getFullYear() !== year || appointmentDate.getMonth() !== month - 1 || appointmentDate.getDate() !== day || appointmentDate.getHours() !== hour || appointmentDate.getMinutes() !== minute || appointmentDate.getTime() <= Date.now()) {
        return res.json({ reply: "That date or time is not a valid future appointment. Please provide a future date and time, then confirm again.", bookingCreated: false });
      }
      if (hour < 9 || hour >= 17) return res.json({ reply: "Clinic appointments are available from 09:00 to 17:00. Please choose a time within clinic hours.", bookingCreated: false });
      try {
        const appointment = await Appointment.create({ clinicId: clinic._id, doctorId: doctor._id, patientName, patientEmail, phone, date, time, reason });
        let emailSent = false;
        try { emailSent = await sendAppointmentEmail({ to: patientEmail, patientName, clinicName: clinic.clinicName, doctorName: doctor.name, date, time, status: appointment.status, appointmentId: appointment._id, bookingReference: appointment.bookingReference }); }
        catch (mailError) { console.error("AI booking email failed:", mailError.message); }
        await recordConversation({ clinicId: clinic._id, conversationId, channel: req.body?.channel === "voice" ? "voice" : "chat", appointmentId: appointment._id });
        return res.status(201).json({
          reply: `Bahut badhiya, ${patientName}! Aapki appointment successfully confirm ho gayi hai.

Doctor: ${doctor.name} (${doctor.specialization})
Clinic: ${clinic.clinicName}
Date: ${date}
Time: ${time}
Booking ID: ${appointment.bookingReference}

${emailSent ? "Confirmation email bhi bhej diya gaya hai." : "Confirmation email abhi nahi bheja ja saka; please clinic se contact karein."}

MediCall AI se baat karne ke liye shukriya! Aapse baat karke achha laga. Apna khayal rakhiye!`,
          languageCode: "hi-IN",
          bookingCreated: true,
          appointment: { id: appointment._id, bookingId: appointment.bookingReference, bookingReference: appointment.bookingReference, patientName, phone, doctorName: doctor.name, specialization: doctor.specialization, clinicName: clinic.clinicName, date, time, reason, status: appointment.status },
        });
      } catch (bookingError) {
        if (bookingError.code === 11000) return res.status(409).json({ message: "This doctor and time slot are already booked. Please choose another time." });
        throw bookingError;
      }
    }
    return res.json({ reply, bookingCreated: false });
  } catch (error) {
    console.error("Chat API error:", error.status || "", error.message || error);
    if (error.status === 429) return res.status(429).json({ message: "AI rate limit reached. Please try again in a moment." });
    return res.status(502).json({ message: "AI assistant is temporarily unavailable. Please try again." });
  }
});

// ==================== DATABASE MODELS ====================

const clinicSchema = new Schema(
  {
    clinicName: {
      type: String,
      required: true,
      trim: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    location: {
      address: { type: String, default: "", trim: true },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      mapsUrl: { type: String, default: "" },
    },
    businessHours: {
      type: [{
        dayOfWeek: { type: Number, min: 0, max: 6, required: true },
        isOpen: { type: Boolean, default: true },
        openTime: { type: String, default: "09:00" },
        closeTime: { type: String, default: "17:00" },
      }],
      default: () => [0,1,2,3,4,5,6].map((dayOfWeek) => ({ dayOfWeek, isOpen: dayOfWeek !== 0, openTime: "09:00", closeTime: "17:00" })),
    },

  },
  { timestamps: true }
);

const doctorSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    fee: { type: Number, default: 500, min: 0 },
    email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    password: { type: String, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

function generateBookingReference() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = require("crypto").randomBytes(8);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `MCA-${datePart}-${suffix}`;
}

const appointmentSchema = new Schema(
  {
    bookingReference: {
      type: String,
      unique: true,
      sparse: true,
      default: generateBookingReference,
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    patientEmail: { type: String, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Confirmed", "Cancelled", "Completed"],
      default: "Confirmed",
    },
    paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed", "Refunded"], default: "Pending" },
    paymentAmount: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ["", "Razorpay", "Cash", "UPI", "Card", "Other"], default: "" },
    paidAt: { type: Date, default: null },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    rescheduleRequest: {
      date: { type: String, default: "" },
      time: { type: String, default: "" },
      note: { type: String, default: "" },
      status: { type: String, enum: ["None", "Pending", "Approved", "Rejected"], default: "None" },
      requestedAt: { type: Date, default: null },
    },
    doctorUnavailableNotice: { type: Boolean, default: false },
    alternativeDates: { type: [String], default: [] },
  },
  { timestamps: true }
);

appointmentSchema.index(
  {
    clinicId: 1,
    doctorId: 1,
    date: 1,
    time: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "Confirmed",
    },
  }
);

const availabilitySchema = new Schema({
  clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  slotMinutes: { type: Number, default: 30, min: 10, max: 180 },
  approved: { type: Boolean, default: false },
}, { timestamps: true });

const patientSchema = new Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  password: { type: String, required: true },
}, { timestamps: true });

const Clinic = mongoose.model("Clinic", clinicSchema);
const Patient = mongoose.model("Patient", patientSchema);
const Doctor = mongoose.model("Doctor", doctorSchema);
const Appointment = mongoose.model("Appointment", appointmentSchema);
const Availability = mongoose.model("Availability", availabilitySchema);

// One document per AI conversation. A conversion is recorded only when the
// conversation actually creates an appointment, not merely when booking is discussed.
const conversationSchema = new Schema({
  clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
  conversationId: { type: String, required: true },
  channel: { type: String, enum: ["chat", "voice"], default: "chat" },
  messageCount: { type: Number, default: 0 },
  converted: { type: Boolean, default: false },
  appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", default: null },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });
conversationSchema.index({ clinicId: 1, conversationId: 1 }, { unique: true });
const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);

async function recordConversation({ clinicId, conversationId, channel = "chat", appointmentId = null }) {
  if (!clinicId || !conversationId) return;
  await Conversation.findOneAndUpdate(
    { clinicId, conversationId },
    { $set: { channel: channel === "voice" ? "voice" : "chat", lastSeenAt: new Date(), ...(appointmentId ? { converted: true, appointmentId } : {}) }, $inc: { messageCount: 1 }, $setOnInsert: { firstSeenAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}


// ==================== AUTH HELPERS ====================

function makeToken(clinic) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing.");
  }

  return jwt.sign(
    { clinicId: clinic._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function makePatientToken(patient) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing.");
  return jwt.sign({ patientId: patient._id.toString(), role: "patient" }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function protectPatient(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Please log in first." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "patient" || !decoded.patientId) return res.status(401).json({ message: "Invalid patient session." });
    req.patientId = decoded.patientId;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function protectDoctor(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Please log in first." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "doctor" || !decoded.doctorId || !decoded.clinicId) {
      return res.status(403).json({ message: "Doctor access required." });
    }
    req.doctorId = decoded.doctorId;
    req.clinicId = decoded.clinicId;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function protect(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Please log in first.",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded.clinicId || decoded.role === "patient" || decoded.role === "doctor") {
      return res.status(403).json({ message: "Clinic admin access required." });
    }
    req.clinicId = decoded.clinicId;
    return next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

// ==================== HEALTH CHECK ====================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MediCall AI",
  });
});

// ==================== REGISTER ====================

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      clinicName,
      adminName,
      email,
      password,
    } = req.body || {};

    if (
      !clinicName?.trim() ||
      !adminName?.trim() ||
      !email?.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingClinic = await Clinic.findOne({
      email: normalizedEmail,
    });

    if (existingClinic) {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    const clinic = await Clinic.create({
      clinicName: clinicName.trim(),
      adminName: adminName.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
    });

    return res.status(201).json({
      token: makeToken(clinic),
      clinic: {
        id: clinic._id,
        clinicName: clinic.clinicName,
        adminName: clinic.adminName,
        email: clinic.email,
        location: clinic.location || {},
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    console.error("Register error:", error);

    return res.status(500).json({
      message: "Could not register clinic.",
    });
  }
});

// ==================== LOGIN ====================

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(
      req.body?.email || ""
    ).toLowerCase().trim();

    const password = req.body?.password || "";

    const clinic = await Clinic.findOne({ email });

    if (
      !clinic ||
      !(await bcrypt.compare(password, clinic.password))
    ) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    return res.json({
      token: makeToken(clinic),
      clinic: {
        id: clinic._id,
        clinicName: clinic.clinicName,
        adminName: clinic.adminName,
        email: clinic.email,
        location: clinic.location || {},
        businessHours: clinic.businessHours || [],
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Could not log in.",
    });
  }
});

// ==================== CURRENT CLINIC ====================

app.get("/api/auth/me", protect, async (req, res) => {
  try {
    const clinic = await Clinic.findById(
      req.clinicId
    ).select("clinicName adminName email aiAgentName location businessHours");

    if (!clinic) {
      return res.status(404).json({
        message: "Clinic not found.",
      });
    }

    return res.json({
      clinic: {
        id: clinic._id,
        clinicName: clinic.clinicName,
        adminName: clinic.adminName,
        email: clinic.email,
      },
    });
  } catch (error) {
    console.error("Profile error:", error);

    return res.status(500).json({
      message: "Could not load clinic profile.",
    });
  }
});


// ==================== CLINIC LOCATION MANAGEMENT ====================
app.patch("/api/clinic/location", protect, async (req, res) => {
  try {
    const address = String(req.body?.address || "").trim();
    const latitude = req.body?.latitude === "" || req.body?.latitude == null ? null : Number(req.body.latitude);
    const longitude = req.body?.longitude === "" || req.body?.longitude == null ? null : Number(req.body.longitude);

    if (address.length > 500) return res.status(400).json({ message: "Address must be 500 characters or fewer." });
    if ((latitude === null) !== (longitude === null)) return res.status(400).json({ message: "Enter both latitude and longitude, or leave both empty." });
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return res.status(400).json({ message: "Latitude must be between -90 and 90." });
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return res.status(400).json({ message: "Longitude must be between -180 and 180." });
    if (!address && latitude === null) return res.status(400).json({ message: "Enter a clinic address or select coordinates." });

    const mapsUrl = latitude !== null
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    const clinic = await Clinic.findByIdAndUpdate(
      req.clinicId,
      { $set: { location: { address, latitude, longitude, mapsUrl } } },
      { returnDocument: "after", runValidators: true }
    ).select("clinicName location");

    if (!clinic) return res.status(404).json({ message: "Clinic not found." });
    return res.json({ message: "Clinic location saved successfully.", clinic });
  } catch (error) {
    console.error("Save clinic location error:", error);
    return res.status(500).json({ message: "Could not save clinic location." });
  }
});


app.patch("/api/clinic/profile", protect, async (req, res) => {
  try {
    const clinicName = String(req.body?.clinicName || "").trim();
    const adminName = String(req.body?.adminName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const businessHours = req.body?.businessHours;\n    const aiAgentName = String(req.body?.aiAgentName || "MediCall AI").trim().slice(0, 50) || "MediCall AI";
    if (!clinicName || !adminName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a clinic name, admin name and valid email address." });
    }
    if (clinicName.length > 120 || adminName.length > 100) return res.status(400).json({ message: "Clinic or admin name is too long." });
    if (!Array.isArray(businessHours) || businessHours.length !== 7) return res.status(400).json({ message: "Provide opening hours for all seven days." });
    const normalizedHours = businessHours.map((item, index) => {
      const dayOfWeek = Number(item.dayOfWeek);
      const openTime = String(item.openTime || "09:00");
      const closeTime = String(item.closeTime || "17:00");
      if (dayOfWeek !== index || !/^\d{2}:\d{2}$/.test(openTime) || !/^\d{2}:\d{2}$/.test(closeTime) || (item.isOpen && openTime >= closeTime)) throw new Error("Check the opening and closing times for each working day.");
      return { dayOfWeek, isOpen: Boolean(item.isOpen), openTime, closeTime };
    });
    const clinic = await Clinic.findByIdAndUpdate(req.clinicId, { $set: { clinicName, adminName, email, aiAgentName, businessHours: normalizedHours } }, { new: true, runValidators: true }).select("clinicName adminName email location businessHours");
    return res.json({ message: "Clinic profile and opening hours updated.", clinic });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That email address is already registered." });
    return res.status(400).json({ message: error.message || "Could not update clinic profile." });
  }
});

// ==================== PATIENT AUTHENTICATION ====================
app.post("/api/patient-auth/register", async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").toLowerCase().trim();
    const phone = String(req.body?.phone || "").trim();
    const password = String(req.body?.password || "");
    if (!fullName || !email || !phone || !password) return res.status(400).json({ message: "Please fill in all fields." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    if (await Patient.findOne({ email })) return res.status(409).json({ message: "An account with this email already exists." });
    const patient = await Patient.create({ fullName, email, phone, password: await bcrypt.hash(password, 12) });
    return res.status(201).json({ token: makePatientToken(patient), patient: { id: patient._id, fullName: patient.fullName, email: patient.email, phone: patient.phone } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    console.error("Patient registration error:", error);
    return res.status(500).json({ message: "Could not create patient account." });
  }
});

app.post("/api/patient-auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const password = String(req.body?.password || "");
    const patient = await Patient.findOne({ email });
    if (!patient || !(await bcrypt.compare(password, patient.password))) return res.status(401).json({ message: "Invalid email or password." });
    return res.json({ token: makePatientToken(patient), patient: { id: patient._id, fullName: patient.fullName, email: patient.email, phone: patient.phone } });
  } catch (error) {
    console.error("Patient login error:", error);
    return res.status(500).json({ message: "Could not log in." });
  }
});

app.get("/api/patient-auth/me", protectPatient, async (req, res) => {
  try {
    const patient = await Patient.findById(req.patientId).select("fullName email phone");
    if (!patient) return res.status(404).json({ message: "Patient account not found." });
    return res.json({ patient: { id: patient._id, fullName: patient.fullName, email: patient.email, phone: patient.phone } });
  } catch (error) {
    console.error("Patient profile error:", error);
    return res.status(500).json({ message: "Could not load patient profile." });
  }
});


app.patch("/api/patient-auth/profile", protectPatient, async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    if (!fullName || !phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter your name, valid email and phone number." });
    if (fullName.length > 100 || phone.length > 20) return res.status(400).json({ message: "Name or phone number is too long." });
    const patient = await Patient.findByIdAndUpdate(req.patientId, { $set: { fullName, email, phone } }, { new: true, runValidators: true });
    if (!patient) return res.status(404).json({ message: "Patient account not found." });
    return res.json({ message: "Your profile was updated.", patient: { id: patient._id, fullName: patient.fullName, email: patient.email, phone: patient.phone } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That email address is already in use." });
    return res.status(400).json({ message: "Could not update your profile." });
  }
});

// ==================== PUBLIC CLINIC INFO ====================

async function publicClinicsHandler(req, res) {
  try {
    const clinics = await Clinic.find({}).sort({ clinicName: 1 }).select("clinicName location businessHours");
    if (!clinics.length) return res.status(404).json({ message: "No clinic registered yet." });
    const requestedId = req.query.clinicId;
    const selectedClinic = requestedId
      ? clinics.find((item) => String(item._id) === String(requestedId))
      : clinics[0];
    if (!selectedClinic) return res.status(404).json({ message: "Selected clinic is not registered on MediCall AI." });
    const doctors = await Doctor.find({ clinicId: selectedClinic._id, isActive: true }).sort({ name: 1 });
    return res.json({
      clinics,
      clinic: { id: selectedClinic._id, clinicName: selectedClinic.clinicName, location: selectedClinic.location || {}, businessHours: selectedClinic.businessHours || [] },
      doctors,
    });
  } catch (error) {
    console.error("Public clinics error:", error);
    return res.status(500).json({ message: "Could not load clinic information." });
  }
}
app.get("/api/public/clinics", publicClinicsHandler);
// Backwards-compatible endpoint for older clients.
app.get("/api/public/clinic", publicClinicsHandler);

// ==================== PUBLIC APPOINTMENT BOOKING ====================

app.post("/api/public/appointments", async (req, res) => {
  try {
    const {
      clinicId,
      doctorId,
      patientName,
      patientEmail,
      email,
      phone,
      date,
      time,
      reason,
    } = req.body || {};
    const normalizedEmail = String(patientEmail || email || "").trim().toLowerCase();

    if (
      !clinicId ||
      !doctorId ||
      !patientName?.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      !phone?.trim() ||
      !date ||
      !time
    ) {
      return res.status(400).json({
        message: "Please provide all required booking details.",
      });
    }

    if (
      !mongoose.isValidObjectId(clinicId) ||
      !mongoose.isValidObjectId(doctorId)
    ) {
      return res.status(400).json({
        message: "Invalid clinic or doctor.",
      });
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time)    ) {
      return res.status(400).json({
        message: "Invalid date or time format.",
      });
    }

    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);

    const appointmentDate = new Date(
      year,
      month - 1,
      day,
      hour,
      minute
    );

    if (
      appointmentDate.getFullYear() !== year ||
      appointmentDate.getMonth() !== month - 1 ||
      appointmentDate.getDate() !== day ||
      appointmentDate.getHours() !== hour ||
      appointmentDate.getMinutes() !== minute ||
      appointmentDate.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        message: "Choose a valid future appointment time.",
      });
    }

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return res.status(404).json({ message: "Clinic not found." });
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const hours = (clinic.businessHours || []).find((item) => item.dayOfWeek === dayOfWeek);
    const opensAt = hours?.openTime || "09:00";
    const closesAt = hours?.closeTime || "17:00";
    if (!hours || hours.isOpen === false) {
      return res.status(400).json({ message: "The clinic is closed on the selected day. Please choose one of its working days." });
    }
    if (time < opensAt || time >= closesAt) {
      return res.status(400).json({ message: `The clinic is open from ${opensAt} to ${closesAt} on the selected day. Please choose a time within these hours.` });
    }

    const doctor = await Doctor.findOne({
      _id: doctorId,
      clinicId,
      isActive: true,
    });

    if (!doctor) {
      return res.status(404).json({
        message: "Clinic or doctor not found.",
      });
    }

    const appointment = await Appointment.create({
      clinicId,
      doctorId,
      patientName: patientName.trim(),
      patientEmail: normalizedEmail,
      phone: phone.trim(),
      date,
      time,
      reason:
        typeof reason === "string"
          ? reason.trim()
          : "",
    });

    let emailSent = false;
    try {
      emailSent = await sendAppointmentEmail({ to: normalizedEmail, patientName: appointment.patientName, clinicName: clinic.clinicName, doctorName: doctor.name, date: appointment.date, time: appointment.time, status: appointment.status, appointmentId: appointment._id, bookingReference: appointment.bookingReference });
    } catch (mailError) {
      console.error("Appointment confirmation email failed:", mailError.message);
    }

    return res.status(201).json({
      message: emailSent ? "Appointment confirmed. Confirmation email sent." : "Appointment confirmed, but email could not be sent. Please check SMTP settings.",
      emailSent,
      appointment: {
        id: appointment._id,
        bookingId: appointment.bookingReference,
        bookingReference: appointment.bookingReference,
        patientName: appointment.patientName,
        doctorName: doctor.name,
        date: appointment.date,
        time: appointment.time,
        status: appointment.status,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This time slot is already booked.",
      });
    }

    console.error("Booking error:", error);

    return res.status(500).json({
      message: "Could not book appointment.",
    });
  }
});

// ==================== DOCTOR AUTHENTICATION & PORTAL ====================
app.post("/api/doctor-auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    const doctor = await Doctor.findOne({ email, isActive: true }).select("+password");
    if (!doctor || !doctor.password || !(await bcrypt.compare(password, doctor.password))) {
      return res.status(401).json({ message: "Invalid doctor email or password." });
    }
    const token = jwt.sign({ role: "doctor", doctorId: doctor._id.toString(), clinicId: doctor.clinicId.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, doctor: { id: doctor._id, name: doctor.name, email: doctor.email, specialization: doctor.specialization, fee: doctor.fee, createdAt: doctor.createdAt, clinicId: doctor.clinicId } });
  } catch (error) { console.error("Doctor login error:", error); return res.status(500).json({ message: "Doctor login failed." }); }
});

app.get("/api/doctor/me", protectDoctor, async (req, res) => {
  const doctor = await Doctor.findOne({ _id: req.doctorId, clinicId: req.clinicId, isActive: true }).select("name email specialization fee clinicId createdAt");
  if (!doctor) return res.status(404).json({ message: "Doctor account not found." });
  return res.json({ doctor });
});

app.get("/api/doctor/appointments", protectDoctor, async (req, res) => {
  try {
    const appointments = await Appointment.find({ clinicId: req.clinicId, doctorId: req.doctorId }).sort({ date: 1, time: 1 });
    return res.json(appointments);
  } catch (error) { console.error("Doctor appointments error:", error); return res.status(500).json({ message: "Could not load appointments." }); }
});

app.get("/api/doctor/availability", protectDoctor, async (req, res) => {
  try { return res.json(await Availability.find({ clinicId: req.clinicId, doctorId: req.doctorId }).sort({ dayOfWeek: 1, startTime: 1 })); }
  catch (error) { console.error("Doctor availability error:", error); return res.status(500).json({ message: "Could not load availability." }); }
});

app.post("/api/doctor/availability", protectDoctor, async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, slotMinutes = 30 } = req.body || {};
    const day = Number(dayOfWeek), slot = Number(slotMinutes);
    if (!Number.isInteger(day) || day < 0 || day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime || "") || startTime >= endTime || !Number.isInteger(slot) || slot < 10 || slot > 180) {
      return res.status(400).json({ message: "Enter a valid day, time range and slot duration." });
    }
    const item = await Availability.create({ clinicId: req.clinicId, doctorId: req.doctorId, dayOfWeek: day, startTime, endTime, slotMinutes: slot, approved: false });
    return res.status(201).json({ message: "Availability submitted for clinic approval.", availability: item });
  } catch (error) { console.error("Save availability error:", error); return res.status(500).json({ message: "Could not save availability." }); }
});

app.delete("/api/doctor/availability/:id", protectDoctor, async (req, res) => {
  try {
    const item = await Availability.findOneAndDelete({ _id: req.params.id, clinicId: req.clinicId, doctorId: req.doctorId, approved: false });
    if (!item) return res.status(404).json({ message: "Pending availability not found." });
    return res.json({ message: "Availability request removed." });
  } catch (error) { return res.status(500).json({ message: "Could not remove availability." }); }
});

// Clinic admin reviews doctor availability requests.
app.get("/api/availability", protect, async (req, res) => {
  try {
    const items = await Availability.find({ clinicId: req.clinicId }).populate("doctorId", "name specialization").sort({ dayOfWeek: 1 });
    return res.json(items);
  } catch (error) { return res.status(500).json({ message: "Could not load availability requests." }); }
});
app.patch("/api/availability/:id/approval", protect, async (req, res) => {
  try {
    const approved = Boolean(req.body?.approved);
    const item = await Availability.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { approved }, { new: true }).populate("doctorId", "name specialization");
    if (!item) return res.status(404).json({ message: "Availability request not found." });
    return res.json({ message: approved ? "Availability approved." : "Availability rejected.", availability: item });
  } catch (error) { return res.status(500).json({ message: "Could not update availability." }); }
});

// ==================== GET DOCTORS ====================

app.get("/api/doctors", protect, async (req, res) => {
  try {
    let doctors = await Doctor.find({
      clinicId: req.clinicId,
    }).sort({ name: 1 });

    // MediCall AI now starts with an empty clinic team. Remove the legacy demo
    // profiles that older versions automatically inserted for every new clinic.
    // This one-time cleanup is scoped to the authenticated clinic only.
    const legacyDemoNames = [
      "Dr. Rajendra Sharma", "Dr. Aditi Verma", "Dr. Arjun Mehta",
      "Dr. Neha Kapoor", "Dr. Imran Khan", "Dr. Priya Singh",
    ];
    const legacy = await Doctor.find({ clinicId: req.clinicId, name: { $in: legacyDemoNames } }).select("_id");
    if (legacy.length) {
      const legacyIds = legacy.map((item) => item._id);
      await Availability.deleteMany({ clinicId: req.clinicId, doctorId: { $in: legacyIds } });
      await Doctor.deleteMany({ clinicId: req.clinicId, _id: { $in: legacyIds } });
    }
    doctors = await Doctor.find({ clinicId: req.clinicId }).sort({ name: 1 });

    return res.json(doctors);
  } catch (error) {
    console.error("Get doctors error:", error);

    return res.status(500).json({
      message: "Could not load doctors.",
    });
  }
});

// Update a doctor's consultation fee for future bookings. Existing appointments retain their recorded payment amount.
app.patch("/api/doctors/:id/fee", protect, async (req, res) => {
  try {
    const fee = Number(req.body?.fee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) return res.status(400).json({ message: "Enter a valid consultation fee between ₹0 and ₹10,00,000." });
    const doctor = await Doctor.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { $set: { fee } }, { new: true, runValidators: true }).select("-password");
    if (!doctor) return res.status(404).json({ message: "Doctor not found in this clinic." });
    return res.json({ message: "Consultation fee updated. This applies to new bookings.", doctor });
  } catch (error) { console.error("Update doctor fee error:", error); return res.status(500).json({ message: "Could not update consultation fee." }); }
});

// ==================== ADD DOCTOR ====================

app.post("/api/doctors", protect, async (req, res) => {
  try {
    const { name, specialization, fee, email, password } = req.body || {};

    if (!name?.trim() || !specialization?.trim()) {
      return res.status(400).json({
        message: "Name and specialization are required.",
      });
    }

    const parsedFee =
      fee === undefined || fee === ""
        ? 500
        : Number(fee);

    if (
      !Number.isFinite(parsedFee) ||
      parsedFee < 0
    ) {
      return res.status(400).json({
        message: "Fee must be a valid non-negative number.",
      });
    }

    if ((email && !password) || (!email && password)) {
      return res.status(400).json({ message: "Provide both doctor email and temporary password, or leave both blank." });
    }
    if (email && password.length < 8) return res.status(400).json({ message: "Doctor password must be at least 8 characters." });
    const doctorData = { clinicId: req.clinicId, name: name.trim(), specialization: specialization.trim(), fee: parsedFee };
    if (email) {
      doctorData.email = email.trim().toLowerCase();
      doctorData.password = await bcrypt.hash(password, 12);
    }
    const doctor = await Doctor.create(doctorData);
    const safeDoctor = doctor.toObject(); delete safeDoctor.password;

    return res.status(201).json(safeDoctor);
  } catch (error) {
    console.error("Add doctor error:", error);

    return res.status(500).json({
      message: "Could not add doctor.",
    });
  }
});


// Remove a doctor from this clinic's directory. Historical appointments are
// retained for audit/history; availability requests and the doctor login are removed.
app.delete("/api/doctors/:id", protect, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ _id: req.params.id, clinicId: req.clinicId });
    if (!doctor) return res.status(404).json({ message: "Doctor not found in this clinic." });
    const linkedAppointments = await Appointment.countDocuments({ clinicId: req.clinicId, doctorId: doctor._id, status: "Confirmed", date: { $gte: new Date().toISOString().slice(0, 10) } });
    if (linkedAppointments > 0 && req.query.confirm !== "true") {
      return res.status(409).json({ message: `This doctor has ${linkedAppointments} upcoming confirmed appointment(s). Confirm removal to continue.`, requiresConfirmation: true, upcomingAppointments: linkedAppointments });
    }
    await Availability.deleteMany({ clinicId: req.clinicId, doctorId: doctor._id });
    await Doctor.deleteOne({ _id: doctor._id, clinicId: req.clinicId });
    return res.json({ message: `${doctor.name} was removed from your clinic team. Existing appointment history has been retained.` });
  } catch (error) {
    console.error("Remove doctor error:", error);
    return res.status(500).json({ message: "Could not remove doctor." });
  }
});

// ==================== GET APPOINTMENTS ====================

app.get("/api/appointments", protect, async (req, res) => {
  try {
    const appointments = await Appointment.find({
      clinicId: req.clinicId,
    })
      .populate("doctorId", "name specialization fee")
      .sort({ date: 1, time: 1 });

    return res.json(appointments);
  } catch (error) {
    console.error("Get appointments error:", error);

    return res.status(500).json({
      message: "Could not load appointments.",
    });
  }
});

// ==================== UPDATE APPOINTMENT STATUS ====================

app.patch(
  "/api/appointments/:id/status",
  protect,
  async (req, res) => {
    try {
      const { status, collectPayment = false, paymentMethod = "" } = req.body || {};

      if (!["Cancelled", "Completed"].includes(status)) {
        return res.status(400).json({ message: "Invalid appointment status." });
      }
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid appointment ID." });
      }

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        clinicId: req.clinicId,
        status: status === "Cancelled" ? "Confirmed" : { $in: ["Confirmed", "Completed"] },
      }).populate("doctorId", "name specialization fee");

      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found or already updated." });
      }

      let revenueAdded = 0;
      let paymentRecorded = appointment.paymentStatus === "Paid";

      // Completion alone is not proof that money was received. The clinic UI
      // sends collectPayment=true only after staff confirms the payment method.
      if (status === "Completed" && collectPayment === true && appointment.paymentStatus !== "Paid") {
        const allowedMethods = ["Cash", "UPI", "Card", "Other"];
        if (!allowedMethods.includes(paymentMethod)) {
          return res.status(400).json({ message: "Choose Cash, UPI, Card or Other as the received payment method." });
        }
        const amount = Number(appointment.paymentAmount) > 0
          ? Number(appointment.paymentAmount)
          : Number(appointment.doctorId?.fee || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({ message: "Set a valid consultation fee for this doctor before recording payment." });
        }
        appointment.paymentAmount = amount;
        appointment.paymentStatus = "Paid";
        appointment.paymentMethod = paymentMethod;
        appointment.paidAt = new Date();
        revenueAdded = amount;
        paymentRecorded = true;
      }

      const statusChanged = appointment.status !== status;
      if (statusChanged) appointment.status = status;
      await appointment.save();

      let emailSent = false;
      if (statusChanged && appointment.patientEmail) {
        try {
          const clinic = await Clinic.findById(appointment.clinicId).select("clinicName");
          emailSent = await sendAppointmentEmail({
            to: appointment.patientEmail,
            patientName: appointment.patientName,
            clinicName: clinic?.clinicName || "the clinic",
            doctorName: appointment.doctorId?.name || "your doctor",
            date: appointment.date,
            time: appointment.time,
            status: appointment.status,
            appointmentId: appointment._id,
            bookingReference: appointment.bookingReference,
          });
        } catch (mailError) {
          console.error("Appointment status email failed:", mailError.message);
        }
      }

      const message = status === "Completed"
        ? revenueAdded > 0
          ? statusChanged
            ? `Visit completed. ₹${revenueAdded.toLocaleString("en-IN")} recorded as ${paymentMethod} offline revenue for your clinic.`
            : `Offline payment of ₹${revenueAdded.toLocaleString("en-IN")} recorded for this completed visit.`
          : paymentRecorded
            ? "Visit completed. This appointment's payment was already recorded; no duplicate revenue was added."
            : "Visit completed. No payment was recorded yet; you can record the offline payment later."
        : "Appointment cancelled.";

      return res.json({ message, emailSent, revenueAdded, appointment });
    } catch (error) {
      console.error("Update appointment error:", error);
      return res.status(500).json({ message: "Could not update appointment." });
    }
  }
);

// ==================== DASHBOARD STATS ====================

app.get("/api/dashboard/stats", protect, async (req, res) => {
  try {
    const now = new Date();

    const today =
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getDate()).padStart(2, "0")}`;

    const [
      doctors,
      total,
      upcoming,
      phones,
      todayCount,
    ] = await Promise.all([
      Doctor.countDocuments({
        clinicId: req.clinicId,
      }),

      Appointment.countDocuments({
        clinicId: req.clinicId,
      }),

      Appointment.countDocuments({
        clinicId: req.clinicId,
        status: "Confirmed",
        date: { $gte: today },
      }),

      Appointment.distinct("phone", {
        clinicId: req.clinicId,
      }),

      Appointment.countDocuments({
        clinicId: req.clinicId,
        date: today,
        status: "Confirmed",
      }),
    ]);

    return res.json({
      doctors,
      appointments: total,
      upcoming,
      patients: phones.length,
      today: todayCount,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);

    return res.status(500).json({
      message: "Could not load dashboard statistics.",
    });
  }
});


// ==================== PATIENT SELF-SERVICE, PAYMENTS & CLINIC ANALYTICS ====================
function validFutureSlot(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))) return false;
  const [y, m, d] = date.split("-").map(Number); const [h, min] = time.split(":").map(Number);
  const value = new Date(y, m - 1, d, h, min);
  return value.getFullYear() === y && value.getMonth() === m - 1 && value.getDate() === d && h >= 9 && h < 17 && min <= 59 && value.getTime() > Date.now();
}
async function emailAppointmentUpdate(appointment, subject, heading, message, extra = "") {
  if (!mailTransporter || !appointment.patientEmail) return false;
  const [clinic, doctor] = await Promise.all([Clinic.findById(appointment.clinicId).select("clinicName"), Doctor.findById(appointment.doctorId).select("name")]);
  const bookingId = appointment.bookingReference || appointment._id;
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#172033"><h2 style="color:#0f766e">MediCall AI</h2><p>Dear ${escapeHtml(appointment.patientName)},</p><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(message)}</p><p><b>Clinic:</b> ${escapeHtml(clinic?.clinicName || "Clinic")}<br/><b>Doctor:</b> ${escapeHtml(doctor?.name || "Doctor")}<br/><b>Date:</b> ${escapeHtml(appointment.date)}<br/><b>Time:</b> ${escapeHtml(appointment.time)}<br/><b>Booking ID:</b> ${escapeHtml(bookingId)}</p>${extra}<p>Thank you,<br/>MediCall AI</p></div>`;
  await mailTransporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: appointment.patientEmail, subject, html, text: `${heading}. ${message} Appointment: ${appointment.date} at ${appointment.time}. Booking ID: ${bookingId}.` });
  return true;
}

// Patient requests a new date/time. It remains pending until clinic admin decides.
app.post("/api/patient/appointments/:id/reschedule-request", protectPatient, async (req, res) => {
  try {
    const patient = await Patient.findById(req.patientId).select("email");
    const appointment = await Appointment.findOne({ _id: req.params.id, patientEmail: patient?.email, status: "Confirmed" });
    if (!appointment) return res.status(404).json({ message: "Appointment not found for this patient." });
    const { date, time, note = "" } = req.body || {};
    if (!validFutureSlot(date, time)) return res.status(400).json({ message: "Choose a valid future date and a time between 09:00 and 17:00." });
    appointment.rescheduleRequest = { date, time, note: String(note).slice(0, 500), status: "Pending", requestedAt: new Date() };
    await appointment.save();
    const clinic = await Clinic.findById(appointment.clinicId).select("clinicName email");
    if (mailTransporter && clinic?.email) await mailTransporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: clinic.email, subject: "Patient reschedule request", text: `${appointment.patientName} requested ${date} at ${time}. Booking ID: ${appointment.bookingReference || appointment._id}.` });
    return res.json({ message: "Your reschedule request has been sent to the clinic for approval.", appointment });
  } catch (e) { console.error("Reschedule request:", e); return res.status(500).json({ message: "Could not submit reschedule request." }); }
});

app.get("/api/patient/appointments", protectPatient, async (req, res) => {
  try { const patient = await Patient.findById(req.patientId).select("email"); const items = await Appointment.find({ patientEmail: patient.email }).populate("doctorId", "name specialization fee").populate("clinicId", "clinicName location").sort({ createdAt: -1 }); return res.json(items); }
  catch (e) { return res.status(500).json({ message: "Could not load your appointments." }); }
});

app.patch("/api/patient/appointments/:id/cancel", protectPatient, async (req, res) => {
  try {
    const patient = await Patient.findById(req.patientId).select("email");
    const appointment = await Appointment.findOneAndUpdate({ _id: req.params.id, patientEmail: patient?.email, status: "Confirmed" }, { $set: { status: "Cancelled" } }, { new: true });
    if (!appointment) return res.status(404).json({ message: "Appointment not found or already updated." });
    let emailSent = false; try { emailSent = await emailAppointmentUpdate(appointment, "Appointment cancelled", "Your appointment has been cancelled", "Your appointment is now cancelled."); } catch (e) { console.error("Cancel email:", e.message); }
    return res.json({ message: "Appointment cancelled.", emailSent, appointment });
  } catch (e) { return res.status(500).json({ message: "Could not cancel appointment." }); }
});

app.patch("/api/appointments/:id/reschedule-request", protect, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ _id: req.params.id, clinicId: req.clinicId, "rescheduleRequest.status": "Pending" });
    if (!appointment) return res.status(404).json({ message: "Pending request not found." });
    const { decision } = req.body || {};
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ message: "Decision must be approve or reject." });
    if (decision === "approve") {
      const { date, time } = appointment.rescheduleRequest;
      if (!validFutureSlot(date, time)) return res.status(400).json({ message: "Requested slot is no longer valid." });
      appointment.date = date; appointment.time = time; appointment.rescheduleRequest.status = "Approved";
    } else appointment.rescheduleRequest.status = "Rejected";
    await appointment.save();
    let emailSent = false;
    try { emailSent = await emailAppointmentUpdate(appointment, decision === "approve" ? "Appointment rescheduled" : "Reschedule request update", decision === "approve" ? "Your appointment has been rescheduled" : "Your reschedule request was not approved", decision === "approve" ? `Your new appointment time is ${appointment.date} at ${appointment.time}.` : "Please contact the clinic to choose another time."); } catch (e) { console.error("Reschedule decision email:", e.message); }
    return res.json({ message: decision === "approve" ? "Reschedule approved and patient notified." : "Request rejected and patient notified.", emailSent, appointment });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ message: "That slot is already booked." }); return res.status(500).json({ message: "Could not process request." }); }
});

// Razorpay order creation. Amount comes from the server-side doctor fee, never the browser.
app.post("/api/payments/create-order", protectPatient, async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: "Razorpay is not configured on the server." });
    const patient = await Patient.findById(req.patientId).select("email fullName phone");
    const appointment = await Appointment.findOne({ _id: req.body?.appointmentId, patientEmail: patient?.email, status: "Confirmed" }).populate("doctorId", "fee name");
    if (!appointment) return res.status(404).json({ message: "Appointment not found." });
    if (appointment.paymentStatus === "Paid") return res.status(409).json({ message: "This appointment is already paid." });
    const amount = Math.round(Number(appointment.doctorId?.fee || 0) * 100);
    if (!amount) return res.status(400).json({ message: "Consultation fee is not configured." });
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount, currency: "INR", receipt: `mc_${appointment._id.toString().slice(-18)}`, notes: { appointmentId: appointment._id.toString(), clinicId: appointment.clinicId.toString() } }) });
    const order = await response.json();
    if (!response.ok) { console.error("Razorpay order error", order); return res.status(502).json({ message: order.error?.description || "Could not create Razorpay order." }); }
    appointment.razorpayOrderId = order.id; appointment.paymentAmount = amount / 100; await appointment.save();
    return res.json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency, name: patient.fullName, email: patient.email, phone: patient.phone, doctorName: appointment.doctorId.name });
  } catch (e) { console.error("Create payment order:", e); return res.status(500).json({ message: "Could not start payment." }); }
});

app.post("/api/payments/verify", protectPatient, async (req, res) => {
  try {
    const { appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    const patient = await Patient.findById(req.patientId).select("email");
    const appointment = await Appointment.findOne({ _id: appointmentId, patientEmail: patient?.email, razorpayOrderId: razorpay_order_id });
    if (!appointment) return res.status(404).json({ message: "Payment order not found." });
    const expected = require("crypto").createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const crypto = require("crypto");
    const a = Buffer.from(expected); const b = Buffer.from(String(razorpay_signature || ""));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ message: "Payment signature verification failed." });
    appointment.paymentStatus = "Paid";
    appointment.paymentMethod = "Razorpay";
    appointment.paidAt = new Date();
    appointment.paymentAmount = Number(appointment.paymentAmount || 0);
    appointment.razorpayPaymentId = razorpay_payment_id;
    await appointment.save();
    return res.json({ message: "Payment verified successfully.", paymentStatus: appointment.paymentStatus });
  } catch (e) { console.error("Verify payment:", e); return res.status(500).json({ message: "Could not verify payment." }); }
});

app.get("/api/dashboard/analytics", protect, async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const [totalConversations, convertedConversations, chat, voice, totalAppointments, chatBookings, voiceBookings, recent] = await Promise.all([
      Conversation.countDocuments({ clinicId }), Conversation.countDocuments({ clinicId, converted: true }),
      Conversation.countDocuments({ clinicId, channel: "chat" }), Conversation.countDocuments({ clinicId, channel: "voice" }),
      Appointment.countDocuments({ clinicId }),
      Conversation.countDocuments({ clinicId, channel: "chat", converted: true }), Conversation.countDocuments({ clinicId, channel: "voice", converted: true }),
      Conversation.find({ clinicId }).sort({ lastSeenAt: -1 }).limit(30).select("channel messageCount converted lastSeenAt")
    ]);
    return res.json({ totalConversations, convertedConversations, conversionRate: totalConversations ? Number((convertedConversations / totalConversations * 100).toFixed(1)) : 0, chatConversations: chat, voiceConversations: voice, appointments: totalAppointments, chatBookings, voiceBookings, recent });
  } catch (e) { console.error("Analytics:", e); return res.status(500).json({ message: "Could not load analytics." }); }
});

// Emergency: mark a doctor inactive for a period and notify affected patients.
// Appointments are NOT silently moved; patients receive proposed dates and must contact/request a change.
app.post("/api/doctors/:id/unavailable", protect, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ _id: req.params.id, clinicId: req.clinicId });
    if (!doctor) return res.status(404).json({ message: "Doctor not found." });
    doctor.isActive = false; await doctor.save();
    const fromDate = String(req.body?.fromDate || new Date().toISOString().slice(0, 10));
    const toDate = String(req.body?.toDate || "");
    const affected = await Appointment.find({ clinicId: req.clinicId, doctorId: doctor._id, status: "Confirmed", date: { $gte: fromDate, ...(toDate ? { $lte: toDate } : {}) } });
    const alternatives = [];
    for (let offset = 1; offset <= 14 && alternatives.length < 5; offset++) { const d = new Date(`${fromDate}T12:00:00`); d.setDate(d.getDate() + offset); if (d.getDay() !== 0) alternatives.push(d.toISOString().slice(0, 10)); }
    let notified = 0;
    for (const appt of affected) {
      appt.doctorUnavailableNotice = true; appt.alternativeDates = alternatives; await appt.save();
      try { const options = alternatives.map(x => `<li>${escapeHtml(x)} (please contact the clinic to select a time)</li>`).join(""); const sent = await emailAppointmentUpdate(appt, "Urgent: doctor unavailable for your appointment", "Your doctor is temporarily unavailable", `Dr. ${doctor.name} is urgently unavailable. Your existing appointment has NOT been changed. Please contact the clinic to request a new slot. Suggested dates: ${alternatives.join(", ")}.`, `<p><b>Suggested alternative dates</b><ul>${options}</ul></p>`); if (sent) notified++; } catch (e) { console.error("Doctor unavailable email:", e.message); }
    }
    return res.json({ message: `Doctor marked unavailable. ${affected.length} appointment(s) flagged; ${notified} patient email(s) sent.`, affected: affected.length, notified, alternativeDates: alternatives });
  } catch (e) { console.error("Doctor unavailable:", e); return res.status(500).json({ message: "Could not mark doctor unavailable." }); }
});

app.patch("/api/doctors/:id/availability-status", protect, async (req, res) => {
  try {
    const isActive = Boolean(req.body?.isActive);
    const doctor = await Doctor.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { isActive }, { new: true });
    if (!doctor) return res.status(404).json({ message: "Doctor not found." });
    return res.json({ message: isActive ? "Doctor is active and available for new bookings." : "Doctor marked unavailable.", doctor });
  } catch (e) { return res.status(500).json({ message: "Could not update doctor availability." }); }
});

// Friendly upload/JSON errors (including unsupported audio type and oversized files).
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      message: error.code === "LIMIT_FILE_SIZE"
        ? "Audio recording is too large. Please record a shorter message."
        : "Could not process the audio upload.",
    });
  }
  if (error.message === "Please upload a supported audio recording.") {
    return res.status(400).json({ message: error.message });
  }
  if (error.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ message: error.message });
  }
  return next(error);
});

// ==================== START SERVER ====================

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from server/.env");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from server/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log("MongoDB connected");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MediCall API running on port ${PORT}`);
    console.log("Local testing: http://localhost:" + PORT + "/api/health");
    console.log("Phone testing: use your laptop LAN IP with port " + PORT);
  });
}

start().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
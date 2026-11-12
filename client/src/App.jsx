
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import DoctorPortal from "./DoctorPortal.jsx";

const API =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("medicall_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function Icon({ name, size = 18, className = "" }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", className, "aria-hidden": true };
  const paths = {
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 14 1 2.5 2 1-2 1-1 2.5-1-2.5-2-1 2-1 1-2.5Z"/></>,
    mic: <><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11.5a7 7 0 0 0 14 0"/><path d="M12 18.5v3"/><path d="M8.5 21.5h7"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a5 5 0 0 1 0 6"/><path d="M18 5a10 10 0 0 1 0 14"/></>,
    close: <><path d="m18 6-12 12"/><path d="m6 6 12 12"/></>,
    message: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.1a8.5 8.5 0 1 1 16.1-5.4Z"/><path d="M8 11h8M8 14h5"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  };
  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

const emptyBooking = {
  patientName: "",
  patientEmail: "",
  phone: "",
  doctorId: "",
  date: "",
  time: "",
  reason: "",
};

export default function App() {
  const [page, setPage] = useState("home");
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("medicall_theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("medicall_theme", theme);
    } catch {}
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const [clinic, setClinic] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [booking, setBooking] = useState(emptyBooking);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const conversationIdRef = useRef(
    localStorage.getItem("medicall_conversation_id") ||
      (() => { const id = `medicall-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem("medicall_conversation_id", id); return id; })()
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm MediCall AI. Ask me about our doctors or appointments.",
    },
  ]);

  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const processingVoiceRef = useRef(false);
  const silenceIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastVoiceAtRef = useRef(0);
  const heardSpeechRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const chatEndRef = useRef(null);
  const audioRef = useRef(null);

  const [token, setToken] = useState(
    () => localStorage.getItem("medicall_token") || ""
  );
  const [authMode, setAuthMode] = useState("clinic-login");
  const [patientToken, setPatientToken] = useState(() => localStorage.getItem("medicall_patient_token") || "");
  const [patient, setPatient] = useState(null);
  const [symptomQuery, setSymptomQuery] = useState("");
  const [symptomSpecialty, setSymptomSpecialty] = useState("");
  const [patientAuth, setPatientAuth] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [auth, setAuth] = useState({
    clinicName: "",
    adminName: "",
    email: "",
    password: "",
  });

  const [adminClinic, setAdminClinic] = useState(null);
  const [stats, setStats] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [showAllPatientAppointments, setShowAllPatientAppointments] = useState(false);
  const [clinicLocationDraft, setClinicLocationDraft] = useState({ address: "", latitude: "", longitude: "" });
  const [analytics, setAnalytics] = useState(null);
  const [rescheduleDrafts, setRescheduleDrafts] = useState({});
  const [adminDoctors, setAdminDoctors] = useState([]);
  const [availabilityRequests, setAvailabilityRequests] = useState([]);
  const [doctorForm, setDoctorForm] = useState({
    name: "",
    specialization: "",
    fee: "500",
    email: "",
    password: "",
  });

  const today = new Date().toLocaleDateString("en-CA");
  const symptomGuidance = [
    { terms: ["skin", "rash", "itch", "acne", "hair"], specialty: "Dermatology" },
    { terms: ["heart", "chest", "blood pressure", "bp", "palpitation"], specialty: "Cardiology" },
    { terms: ["tooth", "teeth", "gum", "dental"], specialty: "Dentistry" },
    { terms: ["bone", "joint", "back pain", "knee", "fracture"], specialty: "Orthopaedics" },
    { terms: ["child", "baby", "infant", "vaccination"], specialty: "Paediatrics" },
    { terms: ["eye", "vision", "glasses", "red eye"], specialty: "Ophthalmology" },
    { terms: ["fever", "cough", "cold", "weakness", "headache"], specialty: "General Physician" },
    { terms: ["stomach", "digestion", "acidity", "liver", "abdomen"], specialty: "Gastroenterology" },
  ];
  const matchedSpecialty = symptomGuidance.find((item) => item.terms.some((term) => symptomQuery.toLowerCase().includes(term)))?.specialty || "General Physician";
  const recommendedDoctors = doctors.filter((doctor) => !symptomSpecialty || (doctor.specialization || "").toLowerCase().includes(symptomSpecialty.toLowerCase()));
  const paidRevenue = appointments.filter((item) => item.paymentStatus === "Paid").reduce((sum, item) => sum + Number(item.doctorId?.fee || item.fee || 0), 0);
  const pendingPayments = appointments.filter((item) => item.paymentStatus !== "Paid" && item.status !== "Cancelled").length;
  const completedAppointments = appointments.filter((item) => item.status === "Completed").length;

  useEffect(() => {
    loadClinic();
    return () => {
      try {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
      audioContextRef.current?.close?.();
      window.speechSynthesis?.cancel();
      audioRef.current?.pause?.();
    };
  }, []);

  useEffect(() => {
    if (token) loadDashboard();
  }, [token]);

  useEffect(() => {
    if (!patientToken) return;
    axios.get(`${API}/patient-auth/me`, { headers: { Authorization: `Bearer ${patientToken}` } })
      .then(({ data }) => { setPatient(data.patient); setBooking((old) => ({ ...old, patientName: old.patientName || data.patient.fullName, patientEmail: old.patientEmail || data.patient.email, phone: old.phone || data.patient.phone })); loadPatientAppointments(); })
      .catch(() => { localStorage.removeItem("medicall_patient_token"); setPatientToken(""); setPatient(null); });
  }, [patientToken]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (!token || page !== "dashboard") return;

    const timer = setInterval(loadDashboard, 10000);
    return () => clearInterval(timer);
  }, [token, page]);

  async function loadClinic(clinicId = "") {
    try {
      const { data } = await axios.get(`${API}/public/clinics`, {
        params: clinicId ? { clinicId } : {},
      });
      setClinics(data.clinics || []);
      setClinic(data.clinic || null);
      setDoctors(data.doctors || []);
      setBooking((previous) => ({
        ...previous,
        doctorId: data.doctors?.some((doctor) => doctor._id === previous.doctorId)
          ? previous.doctorId : (data.doctors?.[0]?._id || ""),
        patientEmail: previous.patientEmail || patient?.email || "",
      }));
    } catch (err) {
      setClinics([]); setClinic(null); setDoctors([]);
      console.error("Clinic loading failed:", err.message);
    }
  }

  async function chooseClinic(clinicId) {
    setClinic(null);
    setDoctors([]);
    setBooking((previous) => ({ ...previous, doctorId: "" }));
    await loadClinic(clinicId);
  }

  async function loadDashboard() {
    try {
      const [me, stat, appt, doc, analyticsResponse] = await Promise.all([
        api.get("/auth/me"),
        api.get("/dashboard/stats"),
        api.get("/appointments"),
        api.get("/doctors"),
        api.get("/dashboard/analytics").catch(() => ({ data: null })),
      ]);

      setAdminClinic(me.data.clinic);
      setClinicLocationDraft({
        address: me.data.clinic?.location?.address || "",
        latitude: me.data.clinic?.location?.latitude ?? "",
        longitude: me.data.clinic?.location?.longitude ?? "",
      });
      setStats(stat.data);
      setAppointments(appt.data);
      setAdminDoctors(doc.data);
      setAnalytics(analyticsResponse.data);
      const availabilityResponse = await api.get("/availability").catch(() => ({ data: [] }));
      setAvailabilityRequests(availabilityResponse.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("medicall_token");
        setToken("");
        setPage("auth");
      }

      setError(
        err.response?.data?.message || "Dashboard could not be loaded."
      );
    }
  }

  async function registerOrLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const isPatient = authMode.startsWith("patient-");
      const isRegister = authMode.endsWith("register");
      const endpoint = isPatient
        ? `/patient-auth/${isRegister ? "register" : "login"}`
        : `/auth/${isRegister ? "register" : "login"}`;
      const payload = isPatient ? patientAuth : auth;
      const { data } = await axios.post(`${API}${endpoint}`, payload);

      if (isPatient) {
        localStorage.setItem("medicall_patient_token", data.token);
        setPatientToken(data.token);
        setPatient(data.patient);
        setPage("patient-dashboard");
        setTimeout(() => loadPatientAppointments(), 0);
        setNotice(isRegister ? "Patient account created successfully." : "Patient login successful.");
      } else {
        setNotice("");
        localStorage.setItem("medicall_token", data.token);
        setToken(data.token);
        setAdminClinic(data.clinic);
        setPage("dashboard");
        setNotice(isRegister ? "Clinic account created successfully." : "Clinic login successful.");
        await loadClinic();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function bookAppointment(e, details = booking) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (!clinic?.id) {
        throw new Error("Clinic is unavailable. Please try again later.");
      }

      const { data } = await axios.post(`${API}/public/appointments`, {
        clinicId: clinic.id,
        ...details,
      });

      const message =
        `Appointment confirmed for ${data.appointment.patientName} ` +
        `with ${data.appointment.doctorName} on ` +
        `${data.appointment.date} at ${data.appointment.time}.`;

      setNotice(data.emailSent ? `${message} A confirmation email was sent to ${details.patientEmail}.` : `${message} However, the confirmation email was not sent. Please contact the clinic.`);
      setBooking(emptyBooking);

      setChatMessages((previous) => [
        ...previous,
        { role: "assistant", text: message },
      ]);

      if (token) await loadDashboard();

      return { success: true, message };
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || "Booking failed.";

      setError(message);
      return { success: false, message };
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(message, readReplyAloud = false) {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage || chatLoading) return;

    setChatInput("");
    setError("");
    setChatMessages((previous) => [...previous, { role: "user", text: cleanMessage }]);
    setChatLoading(true);

    try {
      const history = chatMessages.slice(-16).map(({ role, text }) => ({ role, text }));
      const { data } = await axios.post(`${API}/chat`, {
        message: cleanMessage,
        clinicId: clinic?.id,
        conversationId: conversationIdRef.current,
        channel: readReplyAloud ? "voice" : "chat",
        history,
      }, { timeout: 60000 });
      const reply = data.reply || "Sorry, please try again.";
      setChatMessages((previous) => [...previous, { role: "assistant", text: reply }]);
      if (data.bookingCreated && token) await loadDashboard();
      if (readReplyAloud) await speak(reply, true);
    } catch (err) {
      console.error("Chat error:", err.response?.data || err.message);
      setChatMessages((previous) => [...previous, {
        role: "assistant",
        text: err.response?.data?.message || "Sorry, I couldn't connect. Please try again.",
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function sendChat(e) {
    e?.preventDefault();
    await sendMessage(chatInput, false);
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      setNotice("I heard you. Preparing a reply…");
    }
  }

  function stopVoiceConversation() {
    voiceModeRef.current = false;
    setVoiceMode(false);
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
    silenceIntervalRef.current = null;
    window.speechSynthesis?.cancel();
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    audioRef.current?.pause?.();
    audioRef.current = null;
    setListening(false);
    setNotice("Voice conversation stopped.");
  }

  async function startVoice(automaticRestart = false) {
    setError("");
    setChatOpen(true);
    if (!automaticRestart) {
      if (voiceModeRef.current) {
        stopVoiceConversation();
        return;
      }
      voiceModeRef.current = true;
      setVoiceMode(true);
    }
    if (!voiceModeRef.current || processingVoiceRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      voiceModeRef.current = false;
      setVoiceMode(false);
      setError("Voice recording is not supported in this browser. Use an up-to-date browser and HTTPS.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!voiceModeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      heardSpeechRef.current = false;
      lastVoiceAtRef.current = Date.now();

      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      // Detect a pause after speech and automatically submit the recording.
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        silenceIntervalRef.current = setInterval(() => {
          if (recorder.state !== "recording") return;
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (let i = 0; i < samples.length; i++) {
            const value = (samples[i] - 128) / 128;
            energy += value * value;
          }
          const volume = Math.sqrt(energy / samples.length);
          if (volume > 0.025) {
            heardSpeechRef.current = true;
            lastVoiceAtRef.current = Date.now();
          }
          if (heardSpeechRef.current && Date.now() - lastVoiceAtRef.current > 1300) {
            if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
            silenceIntervalRef.current = null;
            recorder.stop();
          }
        }, 180);
      }

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = (event) => {
        console.error("Recorder error:", event.error || event);
        setListening(false);
        setError("Recording failed. Check microphone permission and try again.");
      };

      recorder.onstop = async () => {
        if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
        silenceIntervalRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        try { await audioContextRef.current?.close?.(); } catch {}
        audioContextRef.current = null;
        setListening(false);

        const actualType = recorder.mimeType || audioChunksRef.current[0]?.type || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: actualType });
        audioChunksRef.current = [];
        if (!voiceModeRef.current) return;
        if (!audioBlob.size || !heardSpeechRef.current) {
          // Keep listening if the user didn't speak clearly yet.
          setNotice("Listening… speak in Hindi or English.");
          setTimeout(() => { if (voiceModeRef.current && !processingVoiceRef.current) startVoice(true); }, 250);
          return;
        }

        const extension = actualType.includes("mp4") ? "m4a" : actualType.includes("ogg") ? "ogg" : "webm";
        const formData = new FormData();
        formData.append("audio", audioBlob, `recording.${extension}`);
        processingVoiceRef.current = true;
        setChatLoading(true);
        setNotice("Understanding your speech…");
        try {
          const { data } = await axios.post(`${API}/transcribe`, formData, { timeout: 60000 });
          const transcript = data.text?.trim();
          if (!transcript) {
            setNotice("I couldn't hear that clearly. Listening again…");
          } else {
            setNotice(`Heard: “${transcript}”`);
            await sendTranscribedMessage(transcript);
          }
        } catch (err) {
          console.error("Transcription error:", err.response?.data || err.message);
          setError(err.response?.data?.message || "Voice transcription failed. Check the Sarvam API key.");
        } finally {
          processingVoiceRef.current = false;
          setChatLoading(false);
          if (voiceModeRef.current) setTimeout(() => startVoice(true), 350);
        }
      };

      recorder.start(250);
      setListening(true);
      setNotice("Live voice is on. Speak naturally; pause when you're done.");
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setListening(false);
      voiceModeRef.current = false;
      setVoiceMode(false);
      console.error("Microphone access error:", err);
      setError(err.name === "NotAllowedError"
        ? "Microphone permission denied. Allow microphone access in browser settings."
        : err.name === "NotFoundError"
          ? "No microphone was found on this device."
          : "Could not start the microphone. Use localhost or HTTPS and check browser permissions.");
    }
  }

  async function sendTranscribedMessage(transcript) {
    setChatInput("");
    setError("");
    setChatMessages((previous) => [...previous, { role: "user", text: transcript }]);
    try {
      const history = chatMessages.slice(-16).map(({ role, text }) => ({ role, text }));
      const { data } = await axios.post(`${API}/chat`, {
        message: transcript,
        clinicId: clinic?.id,
        conversationId: conversationIdRef.current,
        channel: "voice",
        history,
      }, { timeout: 60000 });
      const reply = data.reply || "Sorry, please try again.";
      setChatMessages((previous) => [...previous, { role: "assistant", text: reply }]);
      if (data.bookingCreated && token) await loadDashboard();
      if (voiceModeRef.current) await speak(reply, true);
    } catch (err) {
      console.error("Chat after transcription failed:", err.response?.data || err.message);
      const message = err.response?.data?.message || "I heard you, but couldn't reach the assistant. Please try again.";
      setChatMessages((previous) => [...previous, { role: "assistant", text: message }]);
      if (voiceModeRef.current) await speak(message, true);
    }
  }

  async function speak(text, waitForEnd = false) {
    try {
      const englishOnly = /^[\x00-\x7F]*$/.test(text) && /\b(the|and|your|please|how|what|would|appointment|doctor|hello|thank)\b/i.test(text);
      const { data } = await axios.post(`${API}/tts`, {
        text: String(text || "").slice(0, 2500),
        languageCode: englishOnly ? "en-IN" : "hi-IN",
      }, { timeout: 50000 });
      if (!data.audio) throw new Error("TTS returned no audio.");
      const audio = new Audio(`data:${data.mimeType || "audio/mpeg"};base64,${data.audio}`);
      audioRef.current = audio;
      if (waitForEnd) {
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch((error) => {
            console.error("TTS playback error:", error);
            resolve();
          });
        });
      } else {
        await audio.play();
      }
    } catch (error) {
      console.error("Sarvam voice playback failed:", error.response?.data || error.message);
      setError(error.response?.data?.message || "Natural voice playback failed. Check SARVAM_API_KEY.");
    }
  }

  async function addDoctor(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    try {
      await api.post("/doctors", {
        ...doctorForm,
        fee: Number(doctorForm.fee),
        email: doctorForm.email.trim(),
        password: doctorForm.password,
      });

      setDoctorForm({
        name: "",
        specialization: "",
        fee: "500",
        email: "",
        password: "",
      });

      setNotice("Doctor added successfully.");
      await Promise.all([loadDashboard(), loadClinic()]);
    } catch (err) {
      setError(err.response?.data?.message || "Could not add doctor.");
    }
  }

  async function removeDoctor(doctor) {
    const first = window.confirm(`Remove ${doctor.name} from your clinic team?`);
    if (!first) return;
    try {
      await api.delete(`/doctors/${doctor._id}`);
      setNotice(`${doctor.name} removed from your clinic team.`);
      await Promise.all([loadDashboard(), loadClinic()]);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.requiresConfirmation) {
        const confirmWithAppointments = window.confirm(`${err.response.data.message} If you continue, the doctor will be removed from the directory. Existing appointment records will be kept. Continue?`);
        if (!confirmWithAppointments) return;
        try {
          const { data } = await api.delete(`/doctors/${doctor._id}?confirm=true`);
          setNotice(data.message);
          await Promise.all([loadDashboard(), loadClinic()]);
        } catch (removeErr) {
          setError(removeErr.response?.data?.message || "Could not remove doctor.");
        }
      } else {
        setError(err.response?.data?.message || "Could not remove doctor.");
      }
    }
  }

  async function reviewAvailability(id, approved) {
    try {
      await api.patch(`/availability/${id}/approval`, { approved });
      setNotice(approved ? "Doctor availability approved." : "Doctor availability rejected.");
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || "Could not update availability."); }
  }

  async function updateAppointment(id, status) {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      setNotice(`Appointment marked ${status.toLowerCase()}.`);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update appointment.");
    }
  }

  async function saveClinicLocation(event) {
    event.preventDefault();
    try {
      const { data } = await api.patch("/clinic/location", clinicLocationDraft);
      setAdminClinic((current) => ({ ...current, location: data.clinic.location }));
      setNotice("Clinic location saved. Patients can now view the address and directions.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save clinic location.");
    }
  }

  async function loadPatientAppointments() {
    if (!patientToken) return;
    try {
      const { data } = await axios.get(`${API}/patient/appointments`, { headers: { Authorization: `Bearer ${patientToken}` } });
      setPatientAppointments(data || []);
    } catch (err) { setError(err.response?.data?.message || "Could not load patient appointments."); }
  }

  async function cancelPatientAppointment(id) {
    try {
      const { data } = await axios.patch(`${API}/patient/appointments/${id}/cancel`, {}, { headers: { Authorization: `Bearer ${patientToken}` } });
      setNotice(data.message + (data.emailSent ? " Cancellation email sent." : " Email could not be sent; SMTP may not be configured."));
      await loadPatientAppointments();
    } catch (err) { setError(err.response?.data?.message || "Could not cancel appointment."); }
  }

  async function requestReschedule(id) {
    const draft = rescheduleDrafts[id] || {};
    try {
      const { data } = await axios.post(`${API}/patient/appointments/${id}/reschedule-request`, draft, { headers: { Authorization: `Bearer ${patientToken}` } });
      setNotice(data.message); await loadPatientAppointments();
    } catch (err) { setError(err.response?.data?.message || "Could not submit reschedule request."); }
  }

  async function payAppointment(appointment) {
    try {
      const headers = { Authorization: `Bearer ${patientToken}` };
      const { data: order } = await axios.post(`${API}/payments/create-order`, { appointmentId: appointment._id }, { headers });
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = resolve; script.onerror = reject; document.body.appendChild(script); });
      }
      const checkout = new window.Razorpay({ key: order.keyId, amount: order.amount, currency: order.currency, name: "MediCall AI", description: `Consultation with ${order.doctorName}`, order_id: order.orderId, prefill: { name: order.name, email: order.email, contact: order.phone }, theme: { color: "#0f766e" }, handler: async (response) => {
        try { const verified = await axios.post(`${API}/payments/verify`, { appointmentId: appointment._id, ...response }, { headers }); setNotice(verified.data.message); await loadPatientAppointments(); }
        catch (err) { setError(err.response?.data?.message || "Payment verification failed. Contact the clinic before retrying."); }
      } });
      checkout.open();
    } catch (err) { setError(err.response?.data?.message || "Could not start Razorpay payment."); }
  }

  function logout() {
    localStorage.removeItem("medicall_token");
    setToken("");
    setAdminClinic(null);
    setPage("home");
    setNotice("Clinic admin logged out.");
  }

  function patientLogout() {
    localStorage.removeItem("medicall_patient_token");
    setPatientToken("");
    setPatient(null);
    setPage("home");
    setNotice("Patient logged out successfully.");
  }

  const field =
    "w-full border border-slate-200 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-50";

  const button =
    "rounded-xl bg-teal-700 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div data-theme={theme} className="app-shell min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/70 bg-white/90 px-4 py-3 shadow-[0_8px_30px_rgba(15,42,58,0.06)] backdrop-blur-2xl sm:px-6 lg:px-12">
        <button
          onClick={() => setPage("home")}
          className="flex items-center text-lg font-extrabold tracking-tight sm:text-xl"
        >
          <span className="mr-2 grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-700 text-white shadow-lg shadow-teal-700/20">
            <Icon name="plus" size={21} />
          </span>
          <span className="text-slate-900">MediCall <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">AI</span><span className="ml-2 hidden rounded-full bg-teal-50 px-2 py-1 align-middle text-[9px] font-extrabold uppercase tracking-[.18em] text-teal-700 sm:inline-block">Care, connected</span></span>
        </button>

        <nav className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
          <button onClick={() => { setPage("home"); setLoginMenuOpen(false); }} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-teal-50 hover:text-teal-800">Home</button>
          {token ? <>
            <button className="rounded-xl bg-gradient-to-r from-teal-700 to-cyan-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-teal-700/20 transition hover:-translate-y-0.5 hover:shadow-xl" onClick={() => { setPage("dashboard"); setLoginMenuOpen(false); }}>Clinic dashboard</button>
            <button onClick={() => { logout(); setLoginMenuOpen(false); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50">Log out</button>
          </> : patientToken ? <>
            <button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800" onClick={() => { setPage("patient-dashboard"); setLoginMenuOpen(false); }}>My account</button>
            <button onClick={() => { patientLogout(); setLoginMenuOpen(false); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50">Log out</button>
          </> : null}
          <button
            type="button"
            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to warm light theme"}
            title={theme === "light" ? "Switch to dark theme" : "Switch to warm light theme"}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-100"
          >
            {theme === "light" ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.7 8.7 0 1 0 20.2 15.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={loginMenuOpen}
              aria-controls="login-role-menu"
              onClick={() => setLoginMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-100"
            >
              Login
              <svg className={`h-4 w-4 transition-transform ${loginMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {loginMenuOpen && (
              <div id="login-role-menu" role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,42,58,.16)]">
                <p className="px-3 pb-2 pt-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-slate-400">Choose your portal</p>
                <button
                  role="menuitem"
                  onClick={() => { setAuthMode("patient-login"); setPage("auth"); setLoginMenuOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-teal-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
                    <Icon name="user" size={17} />
                  </span>
                  <span><span className="block text-sm font-bold text-slate-800">Patient login</span><span className="mt-0.5 block text-xs text-slate-500">Book and manage appointments</span></span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setPage("doctor-portal"); setLoginMenuOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-teal-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                    <Icon name="message" size={17} />
                  </span>
                  <span><span className="block text-sm font-bold text-slate-800">Doctor portal</span><span className="mt-0.5 block text-xs text-slate-500">View patients and availability</span></span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setAuthMode("clinic-login"); setPage("auth"); setLoginMenuOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-teal-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Icon name="plus" size={17} />
                  </span>
                  <span><span className="block text-sm font-bold text-slate-800">Clinic login</span><span className="mt-0.5 block text-xs text-slate-500">Manage your clinic dashboard</span></span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        {notice && page !== "doctor-portal" && (
          <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {page === "home" && (
        <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 md:py-16 lg:px-10">
          <section className="relative grid items-center gap-10 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-9 md:grid-cols-2 md:p-12 lg:p-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-teal-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Your clinic, made simpler
              </p>

              <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl md:text-6xl lg:text-7xl">
                Better healthcare, powered by{" "}
                <span className="text-teal-600">conversation.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                MediCall AI connects patients, doctors and clinics through one simple digital healthcare experience. Discover registered clinics, explore doctors and manage appointments with an AI-powered assistant.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button className={button} onClick={() => { setAuthMode("patient-login"); setPage("auth"); }}>
                  Get Started <span className="ml-1">→</span>
                </button>

                <button
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                  onClick={() => setChatOpen(true)}
                >
                  Talk to AI
                </button>
              </div>
            </div>

            <div className="relative rounded-[1.5rem] bg-gradient-to-br from-teal-700 to-teal-600 p-5 text-white shadow-lg shadow-teal-900/10 sm:p-7 md:p-9">
              <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full border border-white/15" />
              <div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full border border-white/15" />
              <div className="relative rounded-2xl border border-white/20 bg-white/10 p-7 text-center shadow-sm backdrop-blur sm:p-9">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-white/20 bg-white text-teal-700 shadow-lg">
                  <Icon name="spark" size={34} />
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-teal-100">MEDICALL AI ASSISTANT</p>
                <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                  How can we help today?
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-teal-50">
                  Ask about doctors, consultation fees or appointments. Chat in Hindi or English.
                </p>
                <button
                  className="mt-6 w-full rounded-xl bg-white px-5 py-4 text-sm font-extrabold text-teal-800 shadow-lg transition hover:bg-teal-50"
                  onClick={() => setChatOpen(true)}
                >
                  Talk to MediCall AI <span className="ml-1">→</span>
                </button>
                <div className="mt-5 flex justify-center gap-2 text-xs text-teal-50"><span>✓ Hindi & English</span><span>·</span><span>✓ Voice input</span></div>
              </div>
            </div>
          </section>

          <section className="mx-auto mt-16 max-w-6xl grid gap-8 md:grid-cols-[.9fr_1.1fr] md:items-center">
            <div className="rounded-[1.75rem] bg-[#102c3a] p-8 text-white sm:p-10">
              <p className="text-xs font-extrabold uppercase tracking-[.22em] text-cyan-200">Why MediCall AI?</p>
              <h2 className="mt-4 text-3xl font-black leading-tight">Making healthcare access easier for everyone.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-200">We developed MediCall AI to reduce the friction of finding a clinic, understanding available services and arranging appointments. Patients get a simpler way to connect with care, while clinics get tools to organise their daily work.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{icon:"✦",title:"AI-powered assistance",body:"Ask questions and get guided support through chat or voice."},{icon:"⌖",title:"Clinic discovery",body:"Choose from clinics that have created an account on MediCall AI."},{icon:"▦",title:"Appointment management",body:"Request, review and manage appointments in one place."},{icon:"♡",title:"Connected care teams",body:"Patients, doctors and clinic teams use role-based workspaces."}].map((item) => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-xl text-cyan-800">{item.icon}</span><h3 className="mt-4 font-extrabold text-slate-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p></article>)}
            </div>
          </section>
          <section className="mx-auto mt-12 max-w-6xl rounded-[1.75rem] border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white p-8 text-center sm:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-cyan-800">One platform · Three experiences</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">Care works better when everyone is connected.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">Patients can find registered clinics, doctors can manage their schedules, and clinics can coordinate appointments and their teams.</p>
            <button className={`${button} mt-6`} onClick={() => { setAuthMode("patient-login"); setPage("auth"); }}>Get Started with MediCall AI →</button>
          </section>

          {patientToken && <section id="booking" className="mt-20 scroll-mt-24 md:mt-24">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-700">PERSONALIZED CARE</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
                  {clinic?.clinicName || "Book your appointment"}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Meet the right specialist and choose a time that works for you. Our team is here to make your visit simple.</p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-100 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Easy online booking
              </div>
            </div>

            <div className="grid items-stretch gap-7 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-sm">
                <div className="bg-gradient-to-br from-slate-950 via-teal-950 to-teal-800 p-7 text-white sm:p-9">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">OUR MEDICAL TEAM</p>
                      <h3 className="mt-3 text-2xl font-black sm:text-3xl">Care you can trust.</h3>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-teal-50/85">Explore specialists and their consultation fees before you book.</p>
                    </div>
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10"><Icon name="plus" size={28} /></span>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3 text-sm">
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{doctors.length} specialist{doctors.length === 1 ? "" : "s"}</span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Transparent fees</span>
                  </div>
                </div>
                <div className="space-y-3 p-5 sm:p-7">
                  {doctors.map((doctor) => (
                    <button
                      key={doctor._id}
                      type="button"
                      onClick={() => setBooking((previous) => ({ ...previous, doctorId: doctor._id }))}
                      className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition duration-200 sm:p-5 ${booking.doctorId === doctor._id ? "border-teal-400 bg-teal-50 ring-4 ring-teal-50" : "border-slate-100 bg-slate-50/70 hover:border-teal-200 hover:bg-white hover:shadow-md"}`}
                    >
                      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-black ${booking.doctorId === doctor._id ? "bg-teal-600 text-white" : "bg-white text-teal-700 shadow-sm"}`}>{doctor.name?.trim()?.charAt(0)?.toUpperCase() || "D"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-extrabold text-slate-900 sm:text-lg">{doctor.name}</span>
                        <span className="mt-1 block text-sm text-slate-500">{doctor.specialization}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700"><span>✓</span> Select specialist</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-lg font-black text-slate-950">₹{doctor.fee}</span>
                        <span className="mt-1 block text-xs text-slate-500">per visit</span>
                      </span>
                    </button>
                  ))}
                  {!doctors.length && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <span className="text-3xl">🩺</span>
                      <p className="mt-3 font-bold text-slate-800">Doctor profiles coming soon</p>
                      <p className="mt-1 text-sm text-slate-500">Please contact the clinic for assistance.</p>
                    </div>
                  )}
                </div>
              </section>

              <form onSubmit={bookAppointment} className="rounded-[1.5rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
                <div className="mb-7 flex items-start gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700">▣</span>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">APPOINTMENT REQUEST</p>
                    <h3 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Let's book your visit</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Fill in the details below. Fields marked * are required.</p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Choose a registered clinic *</span>
                    <select className={`${field} min-h-12 rounded-xl bg-slate-50/70 px-4`} required value={clinic?.id || ""} onChange={(e) => chooseClinic(e.target.value)}>
                      <option value="">Select a clinic</option>
                      {clinics.map((item) => <option key={item._id} value={item._id}>{item.clinicName}</option>)}
                    </select>
                    <span className="mt-1 block text-xs text-slate-500">Only clinics with an active MediCall AI account are listed.</span>
                  </label>
                  <label className="block sm:col-span-1">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Full name *</span>
                    <input className={`${field} min-h-12 rounded-xl bg-slate-50/70 px-4`} placeholder="e.g. Ali Khan" required value={booking.patientName} onChange={(e) => setBooking({ ...booking, patientName: e.target.value })} />
                  </label>
                  <label className="block sm:col-span-1">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Phone number *</span>
                    <input className={`${field} min-h-12 rounded-xl bg-slate-50/70 px-4`} placeholder="Your contact number" type="tel" inputMode="tel" required value={booking.phone} onChange={(e) => setBooking({ ...booking, phone: e.target.value })} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Email address * <span className="font-normal text-slate-400">(appointment confirmation will be sent here)</span></span>
                    <input className={`${field} min-h-12 rounded-xl bg-slate-50/70 px-4`} placeholder="you@example.com" type="email" autoComplete="email" required value={booking.patientEmail} onChange={(e) => setBooking({ ...booking, patientEmail: e.target.value })} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Choose a doctor *</span>
                    <select className={`${field} min-h-12 rounded-xl bg-slate-50/70 px-4`} required value={booking.doctorId} onChange={(e) => setBooking({ ...booking, doctorId: e.target.value })}>
                      <option value="">Select a specialist</option>
                      {doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctor.name} — {doctor.specialization} (₹{doctor.fee})</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Preferred date *</span>
                    <input className={`${field} min-h-12 rounded-xl bg-slate-50/70 px-4`} type="date" min={today} required value={booking.date} onChange={(e) => setBooking({ ...booking, date: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Preferred time *</span>
                    <select className={`${field} min-h-12 rounded-xl bg-slate-50/70 px-4`} required value={booking.time} onChange={(e) => setBooking({ ...booking, time: e.target.value })}>
                      <option value="">Choose a time</option>
                      {Array.from({ length: 16 }, (_, i) => {
                        const hour = 9 + Math.floor(i / 2);
                        const minute = i % 2 ? "30" : "00";
                        const time = `${String(hour).padStart(2, "0")}:${minute}`;
                        return <option key={time} value={time}>{time}</option>;
                      })}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Reason for visit <span className="font-normal text-slate-400">(optional)</span></span>
                    <textarea className={`${field} rounded-xl bg-slate-50/70 px-4`} rows={4} placeholder="Tell us briefly what you need help with" value={booking.reason} onChange={(e) => setBooking({ ...booking, reason: e.target.value })} />
                  </label>
                </div>

                <button className={`${button} mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl text-base shadow-lg shadow-teal-700/20`} disabled={busy || !clinic || !doctors.length}>
                  {busy ? "Submitting your request…" : "Confirm appointment request →"}
                </button>
                <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500"><span className="text-teal-700">✓</span> Your details are sent securely to the clinic for processing.</p>
              </form>
            </div>
          </section>}
        </main>
      )}

      {page === "auth" && (
        <main className="relative mx-auto grid min-h-[78vh] max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-2 md:px-8">
          <section className="hidden overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-950 to-teal-700 p-10 text-white shadow-xl md:block">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl">✚</div>
            <p className="mt-10 text-xs font-bold uppercase tracking-[0.25em] text-teal-200">MEDICALL AI</p>
            <h1 className="mt-4 text-4xl font-black leading-tight">Better care starts with a simpler experience.</h1>
            <p className="mt-4 max-w-md leading-7 text-teal-50/80">Separate workspaces for patients, doctors and registered clinic teams, all in one place.</p>
            <div className="mt-10 grid gap-3 text-sm text-teal-50/90"><p>✓ Manage appointments with ease</p><p>✓ Explore doctors and book visits</p><p>✓ Keep your account details in one place</p></div>
          </section>
          <form onSubmit={registerOrLogin} className="mx-auto w-full max-w-md space-y-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-9">
            <div className="mb-2 grid grid-cols-3 rounded-2xl bg-slate-100 p-1.5">
              <button type="button" onClick={() => setAuthMode("clinic-login")} className={`rounded-xl px-2 py-2.5 text-sm font-bold ${!authMode.startsWith("patient-") ? "bg-white text-teal-800 shadow-sm" : "text-slate-500"}`}>Clinic</button>
              <button type="button" onClick={() => setAuthMode("patient-login")} className={`rounded-xl px-2 py-2.5 text-sm font-bold ${authMode.startsWith("patient-") ? "bg-white text-teal-800 shadow-sm" : "text-slate-500"}`}>Patient</button>
              <button type="button" onClick={() => { setNotice(""); setError(""); setPage("doctor-portal"); }} className="rounded-xl px-2 py-2.5 text-sm font-bold text-slate-500 hover:bg-white hover:text-teal-800">Doctor</button>
            </div>
            <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-700">Welcome to MediCall</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{authMode.endsWith("register") ? "Create your account" : "Welcome back"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{authMode.startsWith("patient-") ? "Sign in to your patient account or create one to get started." : "Sign in to manage your clinic workspace."}</p></div>
            {authMode.startsWith("patient-") ? <>
              {authMode.endsWith("register") && <>
                <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Full name</span><input className={`${field} rounded-xl bg-slate-50`} placeholder="Your full name" required value={patientAuth.fullName} onChange={(e) => setPatientAuth({ ...patientAuth, fullName: e.target.value })} /></label>
                <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Phone number</span><input className={`${field} rounded-xl bg-slate-50`} type="tel" placeholder="Your phone number" required value={patientAuth.phone} onChange={(e) => setPatientAuth({ ...patientAuth, phone: e.target.value })} /></label>
              </>}
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span><input className={`${field} rounded-xl bg-slate-50`} type="email" placeholder="you@example.com" required value={patientAuth.email} onChange={(e) => setPatientAuth({ ...patientAuth, email: e.target.value })} /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><input className={`${field} rounded-xl bg-slate-50`} type="password" minLength={8} placeholder="At least 8 characters" required value={patientAuth.password} onChange={(e) => setPatientAuth({ ...patientAuth, password: e.target.value })} /></label>
            </> : <>
              {authMode.endsWith("register") && <>
                <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Clinic name</span><input className={`${field} rounded-xl bg-slate-50`} placeholder="Clinic name" required value={auth.clinicName} onChange={(e) => setAuth({ ...auth, clinicName: e.target.value })} /></label>
                <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Admin name</span><input className={`${field} rounded-xl bg-slate-50`} placeholder="Admin name" required value={auth.adminName} onChange={(e) => setAuth({ ...auth, adminName: e.target.value })} /></label>
              </>}
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span><input className={`${field} rounded-xl bg-slate-50`} type="email" placeholder="clinic@example.com" required value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><input className={`${field} rounded-xl bg-slate-50`} type="password" minLength={8} placeholder="At least 8 characters" required value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} /></label>
            </>}
            <button className={`${button} w-full rounded-xl py-4`} disabled={busy}>{busy ? "Please wait…" : authMode.endsWith("register") ? "Create account" : "Sign in securely"}</button>
            <p className="text-center text-sm text-slate-500">{authMode.endsWith("register") ? "Already have an account?" : "New to MediCall?"} <button type="button" className="font-bold text-teal-700 hover:text-teal-900" onClick={() => setAuthMode(authMode.endsWith("register") ? authMode.replace("register", "login") : authMode.replace("login", "register"))}>{authMode.endsWith("register") ? "Sign in" : "Create account"}</button></p>
            <button type="button" onClick={() => setPage("home")} className="w-full text-sm font-semibold text-slate-400 hover:text-slate-700">← Back to patient website</button>
          </form>
        </main>
      )}

      {page === "patient-dashboard" && (
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <nav className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <a href="#patient-profile" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-cyan-50 hover:text-cyan-800">My profile</a>
            <a href="#patient-appointments" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-cyan-50 hover:text-cyan-800">Appointments</a>            <a href="#patient-clinic-location" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-cyan-50 hover:text-cyan-800">Clinic location</a>
          </nav>
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div id="patient-profile" className="scroll-mt-28 bg-gradient-to-r from-[#123747] to-[#087e83] p-8 text-white sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-100">PATIENT PORTAL</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Hello, {patient?.fullName || "there"}!</h1><p className="mt-3 max-w-xl text-sm leading-6 text-teal-50">Your MediCall patient account is ready. You can return to the clinic website to book a visit.</p></div>
            <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
              <div className="rounded-2xl border border-slate-200 p-5"><p className="text-sm font-semibold text-slate-500">Full name</p><p className="mt-2 text-lg font-bold text-slate-900">{patient?.fullName || "—"}</p></div>
              <div className="rounded-2xl border border-slate-200 p-5"><p className="text-sm font-semibold text-slate-500">Email address</p><p className="mt-2 break-all text-lg font-bold text-slate-900">{patient?.email || "—"}</p></div>
              <div className="rounded-2xl border border-slate-200 p-5"><p className="text-sm font-semibold text-slate-500">Phone number</p><p className="mt-2 text-lg font-bold text-slate-900">{patient?.phone || "—"}</p></div>
              <div className="flex flex-col justify-center gap-3 rounded-2xl bg-teal-50 p-5"><p className="font-bold text-teal-950">Ready to see a doctor?</p><p className="text-sm leading-5 text-teal-800">Choose a specialist and submit an appointment request.</p><button className={`${button} w-full`} onClick={() => setPage("home")}>Book an appointment →</button></div>
            </div>
            <div id="patient-appointments" className="scroll-mt-28 border-t border-slate-100 p-6 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-900">My appointments</h2><button onClick={loadPatientAppointments} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Refresh</button></div>
              <div className="space-y-4">{(showAllPatientAppointments ? patientAppointments : patientAppointments.slice(0, 3)).map((appt) => <article key={appt._id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{appt.doctorId?.name || "Doctor"}</p><p className="mt-1 text-sm text-slate-600">{appt.date} at {appt.time} · {appt.status}</p><p className="mt-1 text-xs text-slate-500">Payment: {appt.paymentStatus || "Pending"}</p>
                {appt.clinicId?.location?.address && <div className="mt-2 text-xs text-slate-600"><span className="font-semibold">Clinic:</span> {appt.clinicId.location.address} <a className="ml-1 font-bold text-teal-700 underline" href={appt.clinicId.location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.clinicId.location.address)}`} target="_blank" rel="noreferrer">Get directions</a></div>}{appt.doctorUnavailableNotice && <p className="mt-2 text-sm font-semibold text-amber-700">Doctor unavailable. Suggested dates: {(appt.alternativeDates || []).join(", ")}. Your appointment has not been changed.</p>}</div>
                <div className="flex flex-wrap gap-2">{appt.status === "Confirmed" && <><button onClick={() => cancelPatientAppointment(appt._id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Cancel</button>{appt.paymentStatus !== "Paid" && <button onClick={() => payAppointment(appt)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white">Pay online</button>}</>}</div></div>
                {appt.status === "Confirmed" && <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input type="date" min={new Date().toISOString().slice(0,10)} className="rounded-lg border border-slate-200 p-2 text-sm" value={rescheduleDrafts[appt._id]?.date || ""} onChange={(e) => setRescheduleDrafts((old) => ({ ...old, [appt._id]: { ...old[appt._id], date: e.target.value } }))}/><input type="time" min="09:00" max="16:59" className="rounded-lg border border-slate-200 p-2 text-sm" value={rescheduleDrafts[appt._id]?.time || ""} onChange={(e) => setRescheduleDrafts((old) => ({ ...old, [appt._id]: { ...old[appt._id], time: e.target.value } }))}/><button onClick={() => requestReschedule(appt._id)} className="rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800">Request reschedule</button></div>}
                {appt.rescheduleRequest?.status === "Pending" && <p className="mt-2 text-xs font-semibold text-amber-700">Reschedule request pending clinic approval: {appt.rescheduleRequest.date} at {appt.rescheduleRequest.time}</p>}
              </article>)}{!patientAppointments.length && <p className="text-sm text-slate-500">No appointments linked to this patient account yet. Book using the same email address as your account.</p>}
              {patientAppointments.length > 3 && <button onClick={() => setShowAllPatientAppointments((value) => !value)} className="mt-2 rounded-xl border border-teal-200 px-4 py-2.5 text-sm font-bold text-teal-800 hover:bg-teal-50">{showAllPatientAppointments ? "Show latest 3 bookings" : `View all bookings (${patientAppointments.length})`}</button>}</div>
            </div>
            <section className="border-t border-slate-100 bg-gradient-to-br from-indigo-50/80 via-white to-teal-50/70 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><Icon name="spark" size={20}/></span><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-indigo-700">Smart care finder</p><h2 className="text-xl font-black text-slate-950">Find a relevant specialist</h2></div></div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Describe your concern in a few words. MediCall AI will suggest a medical specialty and show matching doctors from the selected registered clinic. This is navigation guidance, not a diagnosis.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={symptomQuery} onChange={(e) => setSymptomQuery(e.target.value)} placeholder="e.g. skin rash, knee pain, fever, tooth pain" className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"/><button onClick={() => setSymptomSpecialty(matchedSpecialty)} className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-700/15 hover:bg-indigo-800">Find specialist</button></div>
              {symptomSpecialty && <button onClick={() => setSymptomSpecialty("")} className="mt-2 text-xs font-semibold text-slate-500 underline">Clear recommendation</button>}
              {symptomSpecialty && <div className="mt-4 rounded-2xl border border-indigo-100 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Suggested specialty</p><p className="mt-1 text-lg font-black text-slate-900">{symptomSpecialty}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{recommendedDoctors.slice(0,4).map((doctor) => <div key={doctor._id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-bold text-slate-800">{doctor.name}</p><p className="text-xs text-slate-500">{doctor.specialization}</p></div><span className="text-sm font-extrabold text-teal-800">₹{doctor.fee}</span></div>)}</div>{!recommendedDoctors.length && <p className="mt-2 text-sm text-amber-700">No matching specialist is listed in the currently selected clinic. Try another registered clinic or choose a general physician.</p>}<button onClick={() => setPage("home")} className="mt-4 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">Continue to clinic booking</button></div>}
              <p className="mt-3 text-[11px] leading-5 text-slate-500">For severe chest pain, difficulty breathing, stroke symptoms, heavy bleeding or another emergency, seek emergency medical care immediately instead of using online recommendations.</p>
            </section>
            <div id="patient-clinic-location" className="scroll-mt-28 border-t border-slate-100 bg-cyan-50/60 px-6 py-6 sm:px-8">
              <h2 className="font-extrabold text-slate-900">Clinic locations</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Saved clinic addresses and map directions for your bookings.</p>
              {[...new Map(patientAppointments.filter((appt) => appt.clinicId?._id).map((appt) => [appt.clinicId._id, appt.clinicId])).values()].map((item) => <div key={item._id} className="mt-3 rounded-xl border border-cyan-100 bg-white p-4">
                <p className="font-bold text-cyan-950">{item.clinicName}</p>
                <p className="mt-1 text-sm text-slate-600">{item.location?.address || "Clinic has not added its location yet."}</p>
                {item.location?.mapsUrl && <a className="mt-2 inline-block text-sm font-bold text-teal-700 underline" href={item.location.mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>}
              </div>)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-5 sm:px-8"><p className="text-sm text-slate-500">You are signed in as a patient.</p><button onClick={patientLogout} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Log out of patient account</button></div>
          </section>
        </main>
      )}

      {page === "dashboard" && (
        <main id="dashboard-top" className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-10">
          <section className="relative mb-7 overflow-hidden rounded-[30px] border border-slate-200/70 bg-gradient-to-br from-white via-white to-cyan-50/70 p-6 shadow-[0_14px_45px_rgba(15,42,58,.07)] sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-teal-50" />
            <div className="pointer-events-none absolute right-24 top-16 h-24 w-24 rounded-full border border-teal-100" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Clinic workspace
                </div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Good to see you, {adminClinic?.adminName || "Admin"}
                </h1>
                <p className="mt-2 text-sm text-slate-500">{adminClinic?.clinicName || "Your clinic"} · Manage appointments, doctors and patient visits.</p>
              </div>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:shadow-xl" onClick={loadDashboard}>
                <Icon name="arrow" size={16} /> Refresh data
              </button>
            </div>
          </section>
          <nav className="mb-7 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm" aria-label="Clinic dashboard sections">
            {[ ["Overview", "dashboard-top"], ["Appointments", "clinic-appointments"], ["AI analytics", "clinic-analytics"], ["Team", "clinic-team"], ["Location", "clinic-location"] ].map(([label, target]) => <a key={target} href={`#${target}`} className="rounded-xl px-4 py-2.5 text-xs font-extrabold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700">{label}</a>)}
            <span className="ml-auto hidden rounded-xl bg-emerald-50 px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 sm:inline-flex">● Clinic workspace active</span>
          </nav>

          <section id="clinic-analytics" className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Today's appointments", value: stats.today || 0, note: "Scheduled for today", icon: "message", tint: "bg-blue-50 text-blue-700" },
              { label: "Upcoming visits", value: stats.upcoming || 0, note: "Confirmed appointments", icon: "arrow", tint: "bg-teal-50 text-teal-700" },
              { label: "Unique patients", value: stats.patients || 0, note: "Patients in your records", icon: "user", tint: "bg-violet-50 text-violet-700" },
              { label: "Doctors", value: stats.doctors || 0, note: "Available specialists", icon: "plus", tint: "bg-amber-50 text-amber-700" },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{item.value}</p>
                  </div>
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${item.tint}`}><Icon name={item.icon} size={20} /></span>
                </div>
                <p className="mt-3 text-xs text-slate-400">{item.note}</p>
              </article>
            ))}
          </section>

          <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[{ label: "AI conversations", value: analytics?.totalConversations ?? 0 }, { label: "Booked from AI", value: analytics?.convertedConversations ?? 0 }, { label: "AI conversion", value: `${analytics?.conversionRate ?? 0}%` }, { label: "Chat / Voice", value: `${analytics?.chatConversations ?? 0} / ${analytics?.voiceConversations ?? 0}` }].map((item) => <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{item.value}</p></article>)}
            <p className="sm:col-span-2 xl:col-span-4 text-xs text-slate-500">Conversion = unique tracked AI conversations that created an appointment ÷ total unique AI conversations. Chat and voice are counted separately using the conversation channel sent by the website.</p>
          </section>

          <section className="mb-7 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <article className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-[#171c45] via-[#252b62] to-[#34418a] p-6 text-white shadow-[0_16px_40px_rgba(35,43,98,.18)]">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-indigo-200">Clinic intelligence</p><h2 className="mt-2 text-xl font-black">Performance at a glance</h2><p className="mt-1 text-sm text-indigo-100/80">Calculated from your clinic's appointment and payment records.</p></div><span className="rounded-xl bg-white/10 p-3"><Icon name="spark" size={22}/></span></div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs text-indigo-100">Verified paid revenue</p><p className="mt-2 text-2xl font-black">₹{paidRevenue.toLocaleString("en-IN")}</p></div><div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs text-indigo-100">Completed visits</p><p className="mt-2 text-2xl font-black">{completedAppointments}</p></div><div className="col-span-2 rounded-xl border border-white/10 bg-white/10 p-4 sm:col-span-1"><p className="text-xs text-indigo-100">Payment pending</p><p className="mt-2 text-2xl font-black">{pendingPayments}</p></div></div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-teal-700">AI conversion insight</p><h2 className="mt-2 text-xl font-black text-slate-950">Turn conversations into care</h2><p className="mt-2 text-sm leading-6 text-slate-500">{analytics?.totalConversations ? `${analytics.convertedConversations || 0} of ${analytics.totalConversations} tracked conversations led to an appointment (${analytics.conversionRate || 0}%).` : "Conversation metrics will appear after patients start using the AI chat or voice assistant."}</p><div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-indigo-500" style={{ width: `${Math.min(100, Math.max(0, Number(analytics?.conversionRate || 0)))}%` }}/></div><div className="mt-3 flex justify-between text-xs text-slate-500"><span>AI conversion</span><strong className="text-slate-800">{analytics?.conversionRate || 0}%</strong></div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Improvement tip: review unanswered questions and make sure doctor specializations, fees and availability are up to date.</p></article>
          </section>

          <section id="clinic-appointments" className="mb-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,42,58,.045)]">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">Appointments</h2>
                <p className="mt-1 text-sm text-slate-500">Review bookings and update their status.</p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{appointments.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Patient</th><th className="px-6 py-4">Specialist</th><th className="px-6 py-4">Appointment</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((appointment) => (
                    <tr key={appointment._id} className="transition hover:bg-slate-50/70">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{appointment.patientName}</div>
                        <div className="mt-1 text-xs text-slate-500">{appointment.phone}</div>
                      </td>
                      <td className="px-6 py-4"><div className="font-medium text-slate-700">{appointment.doctorId?.name || "Doctor"}</div></td>
                      <td className="px-6 py-4"><div className="font-medium text-slate-700">{appointment.date}</div><div className="mt-1 text-xs text-slate-500">{appointment.time}</div></td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${appointment.status === "Confirmed" ? "bg-emerald-50 text-emerald-700" : appointment.status === "Cancelled" ? "bg-rose-50 text-rose-700" : appointment.status === "Completed" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{appointment.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        {appointment.rescheduleRequest?.status === "Pending" ? <div className="flex flex-wrap items-center gap-2"><button className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white" onClick={async () => { try { await api.patch(`/appointments/${appointment._id}/reschedule-request`, { decision: "approve" }); setNotice("Reschedule approved; patient email sent if SMTP is configured."); await loadDashboard(); } catch (e) { setError(e.response?.data?.message || "Could not approve request."); } }}>Approve {appointment.rescheduleRequest.date} {appointment.rescheduleRequest.time}</button><button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700" onClick={async () => { try { await api.patch(`/appointments/${appointment._id}/reschedule-request`, { decision: "reject" }); setNotice("Reschedule request rejected; patient notified if SMTP is configured."); await loadDashboard(); } catch (e) { setError(e.response?.data?.message || "Could not reject request."); } }}>Reject</button></div> : appointment.status === "Confirmed" ? <div className="flex items-center gap-3">
                          <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-700" onClick={() => updateAppointment(appointment._id, "Completed")}>Mark complete</button>
                          <button className="px-2 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700" onClick={() => updateAppointment(appointment._id, "Cancelled")}>Cancel</button>
                        </div> : <span className="text-xs text-slate-400">No actions</span>}
                      </td>
                    </tr>
                  ))}
                  {!appointments.length && <tr><td colSpan="5" className="px-6 py-14 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Icon name="message" size={22} /></span>
                    <p className="mt-3 font-semibold text-slate-700">No appointments yet</p><p className="mt-1 text-sm text-slate-500">New patient bookings will appear here.</p>
                  </td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section id="clinic-location" className="mb-7 scroll-mt-28 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50/70 p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-cyan-700">Clinic profile</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Set your clinic location</h2>
              <p className="mt-1 text-sm text-slate-600">Add the complete address. To choose any point, open Google Maps, right-click (desktop) or long-press (mobile) the location, then paste its coordinates below.</p>
            </div>
            <form onSubmit={saveClinicLocation} className="grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Clinic full address</span><textarea rows="2" maxLength="500" required={!clinicLocationDraft.latitude && !clinicLocationDraft.longitude} value={clinicLocationDraft.address} onChange={(e) => setClinicLocationDraft((v) => ({ ...v, address: e.target.value }))} placeholder="Building, street, area, city, state, PIN code" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-400"/></label>
              <label><span className="mb-1 block text-xs font-bold text-slate-600">Latitude (optional)</span><input type="number" step="any" min="-90" max="90" value={clinicLocationDraft.latitude} onChange={(e) => setClinicLocationDraft((v) => ({ ...v, latitude: e.target.value }))} placeholder="28.6139" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/></label>
              <label><span className="mb-1 block text-xs font-bold text-slate-600">Longitude (optional)</span><input type="number" step="any" min="-180" max="180" value={clinicLocationDraft.longitude} onChange={(e) => setClinicLocationDraft((v) => ({ ...v, longitude: e.target.value }))} placeholder="77.2090" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/></label>
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <button type="submit" className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-teal-800">Save clinic location</button>
                <a className="text-sm font-bold text-teal-700 underline" href="https://www.google.com/maps" target="_blank" rel="noreferrer">Open Google Maps to choose location ↗</a>
                {clinicLocationDraft.latitude !== "" && clinicLocationDraft.longitude !== "" && <a className="text-sm font-bold text-indigo-700 underline" href={`https://www.google.com/maps?q=${clinicLocationDraft.latitude},${clinicLocationDraft.longitude}`} target="_blank" rel="noreferrer">Preview selected point ↗</a>}
              </div>
            </form>
          </section>

          <section id="clinic-team" className="grid scroll-mt-28 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-white to-cyan-50/70 p-5 shadow-[0_12px_35px_rgba(15,42,58,.06)] sm:p-6">
              <div className="mb-5">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-teal-700"><Icon name="plus" size={13}/> Team setup</span>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-950">Add your first doctor</h2>
                <p className="mt-1 text-sm text-slate-500">Add a specialist to your clinic directory.</p>
              </div>
              <form onSubmit={addDoctor} className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Doctor name</span><input className={`${field} rounded-xl bg-slate-50/70`} placeholder="e.g. Dr. Aditi Sharma" required value={doctorForm.name} onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })} /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Specialization</span><input className={`${field} rounded-xl bg-slate-50/70`} placeholder="e.g. Orthopaedics" required value={doctorForm.specialization} onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })} /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Consultation fee (₹)</span><input className={`${field} rounded-xl bg-slate-50/70`} type="number" min="0" placeholder="500" value={doctorForm.fee} onChange={(e) => setDoctorForm({ ...doctorForm, fee: e.target.value })} /></label>
                <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3"><p className="text-sm font-bold text-teal-900">Doctor portal account (optional)</p><p className="mt-1 text-xs text-teal-800">Add an email and temporary password so this doctor can sign in separately. Both fields are required together.</p><label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Doctor email</span><input className={`${field} rounded-xl bg-white`} type="email" placeholder="doctor@example.com" value={doctorForm.email} onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })} /></label><label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Temporary password (minimum 8 characters)</span><input className={`${field} rounded-xl bg-white`} type="password" minLength="8" placeholder="Create initial password" value={doctorForm.password} onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })} /></label></div>
                <button className={`${button} flex w-full items-center justify-center gap-2 rounded-xl`}><Icon name="plus" size={16} /> Add doctor</button>
              </form>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold tracking-tight text-slate-950">Clinic team</h2><p className="mt-1 text-sm text-slate-500">Build and maintain your clinic’s own care team. No sample doctors are added automatically.</p></div>
                <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">{adminDoctors.length} doctors</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {adminDoctors.map((doctor) => (
                  <article key={doctor._id} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-teal-50/50 p-4 shadow-[0_5px_20px_rgba(15,42,58,.035)] transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_16px_35px_rgba(15,118,110,.10)]">
                    <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[3rem] bg-teal-50/80 transition group-hover:bg-teal-100/80" />
                    <div className="relative flex items-start gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 text-base font-black text-white shadow-md shadow-teal-700/15">{(doctor.name || "D").replace(/^dr\.?\s*/i, "").slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-extrabold text-slate-900">{doctor.name}</p><span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider ${doctor.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{doctor.isActive ? "Active" : "Unavailable"}</span></div>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500">{doctor.specialization}</p><p className="mt-1 truncate text-[10px] text-slate-400">{doctor.email || "Doctor portal login not configured"}</p>
                        <div className="mt-3 flex items-center justify-between gap-2"><p className="text-sm font-extrabold text-teal-800">₹{doctor.fee}<span className="ml-1 text-[10px] font-medium text-slate-400">/ visit</span></p><button onClick={() => removeDoctor(doctor)} className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-rose-600 transition hover:bg-rose-50">Remove doctor</button></div>
                        {doctor.isActive ? <button className="mt-3 w-full rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100" onClick={async () => { const fromDate = window.prompt("Unavailable from date (YYYY-MM-DD)", new Date().toISOString().slice(0,10)); if (!fromDate) return; const toDate = window.prompt("Unavailable through date (YYYY-MM-DD, optional)", fromDate) || ""; try { const { data } = await api.post(`/doctors/${doctor._id}/unavailable`, { fromDate, toDate }); setNotice(data.message); await loadDashboard(); } catch (e) { setError(e.response?.data?.message || "Could not notify patients."); } }}>Mark unavailable & notify patients</button> : <button className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100" onClick={async () => { try { const { data } = await api.patch(`/doctors/${doctor._id}/availability-status`, { isActive: true }); setNotice(data.message); await loadDashboard(); await loadClinic(); } catch (e) { setError(e.response?.data?.message || "Could not reactivate doctor."); } }}>Reactivate doctor</button>}
                      </div>
                    </div>
                  </article>
                ))}
                {!adminDoctors.length && <div className="col-span-full rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center"><p className="font-semibold text-slate-700">No doctors added yet</p><p className="mt-1 text-sm text-slate-500">Add your clinic’s first doctor using the form.</p></div>}
              </div>
            </div>
          </section>

          <section className="mt-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4"><h2 className="text-lg font-semibold text-slate-950">Doctor availability approvals</h2><p className="mt-1 text-sm text-slate-500">Review weekly schedules submitted by doctors before they are used for patient bookings.</p></div>
            <div className="space-y-3">
              {availabilityRequests.map((item) => <article key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div><p className="font-semibold text-slate-800">{item.doctorId?.name || "Doctor"} · { ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][item.dayOfWeek] }</p><p className="mt-1 text-xs text-slate-500">{item.startTime}–{item.endTime} · {item.slotMinutes}-minute slots</p></div><div className="flex items-center gap-2">{item.approved ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Approved</span> : <><button onClick={() => reviewAvailability(item._id, true)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white">Approve</button><button onClick={() => reviewAvailability(item._id, false)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">Reject</button></>}</div></article>)}
              {!availabilityRequests.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No doctor availability requests yet.</p>}
            </div>
          </section>
        </main>
      )}
      {page === "doctor-portal" && <DoctorPortal onExit={() => setPage("home")} />}

      <footer className="border-t bg-white px-5 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} MediCall AI · Clinic-managed appointments
      </footer>

      {chatOpen && (
        <section className="fixed bottom-20 right-3 z-50 flex h-[min(720px,82dvh)] w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.35)] sm:bottom-24 sm:right-5">
          <header className="flex items-center justify-between border-b border-slate-100 bg-white p-4 text-slate-900">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon name="spark" size={21} /></span>
                <div><h2 className="font-semibold tracking-tight">MediCall AI</h2>
                <p className="mt-0.5 text-xs text-slate-500">Clinic assistant · Hindi & English</p></div>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="close" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-4">
            {chatMessages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === "user"
                    ? "ml-auto rounded-br-md bg-teal-700 text-white"
                    : "rounded-bl-md border border-slate-200/80 bg-white text-slate-800"
                }`}
              >
                {message.text}

                {message.role === "assistant" && (
                  <button
                    className="ml-2 text-xs text-teal-700"
                    title="Read aloud"
                    onClick={() => speak(message.text)}
                  >
                    <Icon name="volume" size={15} />
                  </button>
                )}
              </div>
            ))}

            {chatLoading && (
              <p className="text-sm text-slate-500">MediCall is typing...</p>
            )}

            <div ref={chatEndRef} />
          </div>

          {(notice || error) && <div className={`px-3 py-2 text-xs ${error ? "bg-red-50 text-red-700" : "bg-teal-50 text-teal-800"}`}>{error || notice}</div>}

          <form onSubmit={sendChat} className="flex items-center gap-2 border-t border-slate-100 bg-white p-3">
            <input
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-50"
              placeholder="Type your message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
            />

            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-sm font-bold transition ${voiceMode ? "animate-pulse bg-red-600 text-white" : "bg-teal-50 text-teal-800 hover:bg-teal-100"}`}
              title={voiceMode ? "Stop live voice conversation" : "Start live voice conversation"}
              onClick={() => startVoice(false)}
              disabled={chatLoading && !voiceMode}
              aria-label={voiceMode ? "Stop live voice conversation" : "Start live voice conversation"}
            >
              <span className="inline-flex items-center gap-2">{voiceMode ? <Icon name="close" size={16} /> : <Icon name="mic" size={16} />}{voiceMode ? "End voice" : "Live voice"}</span>
            </button>

            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-700 text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40" disabled={chatLoading || !chatInput.trim()} aria-label="Send message" title="Send message">
              <Icon name="send" size={17} />
            </button>
          </form>

          <div className="border-t border-slate-100 px-3 py-2 text-center text-[10px] text-slate-400">
            Live voice: speak naturally and pause; replies play aloud and listening resumes automatically. Hindi accuracy depends on audio quality and model support.
          </div>
        </section>
      )}

      {!chatOpen && (
        <button
          className="fixed bottom-5 right-5 z-40 grid h-16 w-16 place-items-center rounded-2xl bg-teal-700 text-2xl text-white shadow-xl shadow-teal-900/25 transition hover:-translate-y-1 hover:bg-teal-800"
          onClick={() => setChatOpen(true)}
          aria-label="Open MediCall AI"
        >
          <Icon name="message" size={26} />
        </button>
      )}
    </div>
  );
}
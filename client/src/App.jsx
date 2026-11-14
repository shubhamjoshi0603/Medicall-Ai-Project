
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import DoctorPortal from "./DoctorPortal.jsx";
import medicallLogo from "./assets/medicall-logo.svg";
import medicallLogoDark from "./assets/medicall-logo-dark.svg";
import healthcareHero from "./assets/healthcare-hero.svg";
import clinicWorkspaceArt from "./assets/clinic-workspace.svg";

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
    check: <path d="m5 12 4 4L19 6"/>,
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

function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const escapeCell = (value) => {
    const raw = String(value ?? "");
    const safe = /^[=+@-]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);
  const [clinic, setClinic] = useState(null);
  const [selectedClinicId, setSelectedClinicId] = useState(() => {
    try { return localStorage.getItem("medicall_selected_clinic") || ""; }
    catch { return ""; }
  });
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
  const [showPatientPassword, setShowPatientPassword] = useState(false);
  const [showClinicPassword, setShowClinicPassword] = useState(false);
  const [showDoctorSetupPassword, setShowDoctorSetupPassword] = useState(false);
  const [auth, setAuth] = useState({
    clinicName: "",
    adminName: "",
    email: "",
    password: "",
  });

  const [clinicView, setClinicView] = useState("overview");
  const [clinicProfileDraft, setClinicProfileDraft] = useState({ clinicName: "", adminName: "", email: "", phone: "", aiAgentName: "MediCall AI", businessHours: [] });
  const [patientProfileEditing, setPatientProfileEditing] = useState(false);
  const [patientProfileDraft, setPatientProfileDraft] = useState({ fullName: "", email: "", phone: "" });
  const [adminClinic, setAdminClinic] = useState(null);
  const [stats, setStats] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [patientReviews, setPatientReviews] = useState([]);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [familyDraft, setFamilyDraft] = useState({ fullName: "", relationship: "Child", dateOfBirth: "", phone: "" });
  const [recordDraft, setRecordDraft] = useState({ title: "", category: "Prescription", familyMemberId: "", appointmentId: "" });
  const [recordFile, setRecordFile] = useState(null);
  const [patientModuleBusy, setPatientModuleBusy] = useState(false);
  const [showAllPatientAppointments, setShowAllPatientAppointments] = useState(false);
  const [clinicLocationDraft, setClinicLocationDraft] = useState({ address: "", latitude: "", longitude: "" });
  const [analytics, setAnalytics] = useState(null);
  const [rescheduleDrafts, setRescheduleDrafts] = useState({});
  const [collectionModal, setCollectionModal] = useState(null);
  const [collectionMethod, setCollectionMethod] = useState("Cash");
  const [appointmentFilter, setAppointmentFilter] = useState("upcoming");
  const [patientSearch, setPatientSearch] = useState("");
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
  const clinicDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const selectedClinicHours = clinic?.businessHours?.find((item) => item.dayOfWeek === (booking.date ? new Date(`${booking.date}T12:00:00`).getDay() : -1));
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
  const specialtyAliases = {
    "General Physician": ["general physician", "general medicine", "family medicine", "internal medicine"],
    "Orthopaedics": ["orthopaedics", "orthopedics", "orthopaedic", "orthopedic"],
    "Paediatrics": ["paediatrics", "pediatrics", "paediatric", "pediatric"],
    "Dentistry": ["dentistry", "dentist", "dental"],
    "Dermatology": ["dermatology", "dermatologist", "skin"],
    "Ophthalmology": ["ophthalmology", "ophthalmologist", "eye"],
    "Gastroenterology": ["gastroenterology", "gastroenterologist", "gastro"],
    "Cardiology": ["cardiology", "cardiologist", "cardiac"],
  };
  const specialtyTerms = specialtyAliases[symptomSpecialty] || [symptomSpecialty.toLowerCase()];
  const recommendedDoctors = doctors.filter((doctor) => {
    const occupation = (doctor.specialization || "").toLowerCase();
    return !symptomSpecialty || specialtyTerms.some((term) => occupation.includes(term));
  });
  const dateKey = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const todayDateKey = dateKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowDateKey = dateKey(tomorrowDate);
  const amountForAppointment = (item) => {
    const recorded = Number(item.paymentAmount || 0);
    return recorded > 0 ? recorded : Number(item.doctorId?.fee || item.fee || 0);
  };
  const isOnlinePayment = (item) => item.paymentMethod === "Razorpay" || Boolean(item.razorpayPaymentId);
  const paidAppointments = appointments.filter((item) => item.paymentStatus === "Paid");
  const onlineRevenue = paidAppointments.filter(isOnlinePayment).reduce((sum, item) => sum + amountForAppointment(item), 0);
  const offlineRevenue = paidAppointments.filter((item) => !isOnlinePayment(item)).reduce((sum, item) => sum + amountForAppointment(item), 0);
  const paidRevenue = onlineRevenue + offlineRevenue;
  const pendingPayments = appointments.filter((item) => item.status !== "Cancelled" && item.paymentStatus !== "Paid").length;
  const completedAppointments = appointments.filter((item) => item.status === "Completed").length;
  const todayAppointmentsCount = appointments.filter((item) => item.status === "Confirmed" && item.date === todayDateKey).length;
  const tomorrowAppointmentsCount = appointments.filter((item) => item.status === "Confirmed" && item.date === tomorrowDateKey).length;
  const scheduledLaterCount = appointments.filter((item) => item.status === "Confirmed" && item.date > tomorrowDateKey).length;
  const cancelledAppointmentsCount = appointments.filter((item) => item.status === "Cancelled").length;
  const weeklyAppointmentActivity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const key = dateKey(day);
    return { key, label: day.toLocaleDateString("en-IN", { weekday: "short" }), count: appointments.filter((item) => item.date === key && item.status !== "Cancelled").length };
  });
  const weeklyMaxAppointments = Math.max(1, ...weeklyAppointmentActivity.map((day) => day.count));
  const monthlyAppointmentActivity = Array.from({ length: 30 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (29 - index));
    const key = dateKey(day);
    return {
      key,
      label: day.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      count: appointments.filter((item) => item.date === key && item.status !== "Cancelled").length,
    };
  });
  const monthlyMaxAppointments = Math.max(1, ...monthlyAppointmentActivity.map((day) => day.count));
  const outcomeCounts = [
    { label: "Completed", count: completedAppointments, color: "#16a36a" },
    { label: "Upcoming", count: appointments.filter((item) => item.status === "Confirmed" && item.date >= todayDateKey).length, color: "#2854b8" },
    { label: "Cancelled", count: cancelledAppointmentsCount, color: "#94a3b8" },
  ];
  const outcomeTotal = Math.max(1, outcomeCounts.reduce((sum, item) => sum + item.count, 0));
  const outcomeGradient = `conic-gradient(${outcomeCounts.map((item, index) => {
    const start = outcomeCounts.slice(0, index).reduce((sum, previous) => sum + previous.count, 0) / outcomeTotal * 100;
    const end = start + item.count / outcomeTotal * 100;
    return `${item.color} ${start}% ${end}%`;
  }).join(", ")})`;

  const filteredClinicAppointments = appointments.filter((item) => {
    if (appointmentFilter === "today") return item.status === "Confirmed" && item.date === todayDateKey;
    if (appointmentFilter === "tomorrow") return item.status === "Confirmed" && item.date === tomorrowDateKey;
    if (appointmentFilter === "later") return item.status === "Confirmed" && item.date > tomorrowDateKey;
    if (appointmentFilter === "completed") return item.status === "Completed";
    if (appointmentFilter === "cancelled") return item.status === "Cancelled";
    if (appointmentFilter === "all") return true;
    return item.status === "Confirmed" && item.date >= todayDateKey;
  });

  const clinicPatients = Object.values(appointments.reduce((groups, item) => {
    const identity = String(item.patientEmail || item.phone || item._id).trim().toLowerCase();
    if (!groups[identity]) groups[identity] = { identity, patientName: item.patientName || "Patient", email: item.patientEmail || "", phone: item.phone || "", appointments: [] };
    groups[identity].appointments.push(item);
    return groups;
  }, {})).map((patientRecord) => {
    const history = [...patientRecord.appointments].sort((a, b) => `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`));
    return { ...patientRecord, totalVisits: history.length, completedVisits: history.filter((item) => item.status === "Completed").length, upcomingVisits: history.filter((item) => item.status === "Confirmed" && item.date >= todayDateKey).length, lastAppointment: history[0]?.date || "—" };
  }).sort((a, b) => a.patientName.localeCompare(b.patientName));

  const filteredClinicPatients = clinicPatients.filter((item) => {
    const query = patientSearch.trim().toLowerCase();
    return !query || [item.patientName, item.email, item.phone].some((value) => String(value || "").toLowerCase().includes(query));
  });

  const doctorWorkload = adminDoctors.map((doctor) => {
    const doctorAppointments = appointments.filter((item) => String(item.doctorId?._id || item.doctorId || "") === String(doctor._id));
    return { ...doctor, totalAppointments: doctorAppointments.length, upcomingAppointments: doctorAppointments.filter((item) => item.status === "Confirmed" && item.date >= todayDateKey).length, completedAppointments: doctorAppointments.filter((item) => item.status === "Completed").length };
  }).sort((a, b) => b.totalAppointments - a.totalAppointments);

  useEffect(() => {
    loadClinic(localStorage.getItem("medicall_selected_clinic") || "");
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
      .then(({ data }) => { setPatient(data.patient); setPatientProfileDraft({ fullName: data.patient.fullName || "", email: data.patient.email || "", phone: data.patient.phone || "" }); setBooking((old) => ({ ...old, patientName: old.patientName || data.patient.fullName, patientEmail: old.patientEmail || data.patient.email, phone: old.phone || data.patient.phone })); loadPatientAppointments(); loadPatientModules(); })
      .catch(() => { localStorage.removeItem("medicall_patient_token"); setPatientToken(""); setPatient(null); });
  }, [patientToken]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Automatically dismiss global success and error banners after 10 seconds.
  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(""), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!error) return undefined;
    const timeoutId = window.setTimeout(() => setError(""), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  useEffect(() => {
    if (!token || page !== "dashboard" || clinicView === "settings") return;

    const timer = setInterval(loadDashboard, 30000);
    return () => clearInterval(timer);
  }, [token, page, clinicView]);

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
      if (clinicId) {
        try { localStorage.removeItem("medicall_selected_clinic"); } catch {}
        setSelectedClinicId("");
        setClinic(null);
        setDoctors([]);
        await loadClinic("");
        return;
      }
      setClinics([]); setClinic(null); setDoctors([]);
      console.error("Clinic loading failed:", err.message);
    }
  }

  async function chooseClinic(clinicId) {
    setClinic(null);
    setDoctors([]);
    setSelectedClinicId(clinicId || "");
    try {
      if (clinicId) localStorage.setItem("medicall_selected_clinic", clinicId);
      else localStorage.removeItem("medicall_selected_clinic");
    } catch {}
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
      setClinicProfileDraft({
        clinicName: me.data.clinic?.clinicName || "",
        adminName: me.data.clinic?.adminName || "",
        email: me.data.clinic?.email || "",
        phone: me.data.clinic?.phone || "",
        aiAgentName: me.data.clinic?.aiAgentName || "MediCall AI",
        businessHours: (me.data.clinic?.businessHours?.length ? me.data.clinic.businessHours : [0,1,2,3,4,5,6].map((dayOfWeek) => ({ dayOfWeek, isOpen: dayOfWeek !== 0, openTime: "09:00", closeTime: "17:00" }))).map((item) => ({ ...item })),
      });
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
      if (!selectedClinicId || !clinic?.id || selectedClinicId !== clinic.id) {
        throw new Error("Please select a registered clinic before booking your appointment.");
      }
      if (details.date && details.time) {
        const selectedDay = new Date(`${details.date}T12:00:00`).getDay();
        const hours = clinic.businessHours?.find((item) => item.dayOfWeek === selectedDay);
        if (!hours || hours.isOpen === false) throw new Error("The clinic is closed on this day. Please choose one of its working days.");
        if (details.time < hours.openTime || details.time >= hours.closeTime) throw new Error(`The clinic is open from ${hours.openTime} to ${hours.closeTime}. Please choose a time within these hours.`);
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
    if (!selectedClinicId || selectedClinicId !== clinic?.id) {
      setChatMessages((previous) => [...previous, { role: "assistant", text: "Please choose a registered clinic from the clinic selector above before I recommend doctors, share clinic directions or help book an appointment." }]);
      return;
    }

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
      if (readReplyAloud) await speak(reply, true, data.languageCode || "");
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

  async function speak(text, waitForEnd = false, languageCodeOverride = "") {
    try {
      const englishOnly = /^[\x00-\x7F]*$/.test(text) && /\b(the|and|your|please|how|what|would|appointment|doctor|hello|thank)\b/i.test(text);
      const { data } = await axios.post(`${API}/tts`, {
        text: String(text || "").slice(0, 2500),
        languageCode: languageCodeOverride || (englishOnly ? "en-IN" : "hi-IN"),
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

  async function updateDoctorFee(doctor, delta) {
    const nextFee = Math.max(0, Number(doctor.fee || 0) + delta);
    try {
      const { data } = await api.patch(`/doctors/${doctor._id}/fee`, { fee: nextFee });
      setAdminDoctors((current) => current.map((item) => item._id === doctor._id ? data.doctor : item));
      setNotice(`${doctor.name} consultation fee is now ₹${nextFee}. This applies to new bookings.`);
      await loadClinic();
    } catch (err) { setError(err.response?.data?.message || "Could not update consultation fee."); }
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

  async function updateAppointment(id, status, extra = {}) {
    try {
      const { data } = await api.patch(`/appointments/${id}/status`, { status, ...extra });
      setNotice(data.message || `Appointment marked ${status.toLowerCase()}.`);
      await loadDashboard();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Could not update appointment.");
      return false;
    }
  }

  function completeAppointment(appointment) {
    if (appointment.paymentStatus === "Paid") {
      if (window.confirm("This visit is already paid. Mark the appointment as completed? The existing payment will not be counted again.")) {
        updateAppointment(appointment._id, "Completed");
      }
      return;
    }
    setCollectionMethod("Cash");
    setCollectionModal(appointment);
  }

  async function confirmAppointmentCollection() {
    if (!collectionModal) return;
    const saved = await updateAppointment(collectionModal._id, "Completed", {
      collectPayment: true,
      paymentMethod: collectionMethod,
    });
    if (saved) setCollectionModal(null);
  }

  async function saveClinicProfile(event) {
    event.preventDefault();
    try {
      const { data } = await api.patch("/clinic/profile", clinicProfileDraft);
      setAdminClinic((current) => ({ ...current, ...data.clinic }));
      setNotice(data.message || "Clinic profile updated.");
    } catch (err) { setError(err.response?.data?.message || "Could not update clinic profile."); }
  }
  async function savePatientProfile(event) {
    event.preventDefault();
    try {
      const { data } = await axios.patch(`${API}/patient-auth/profile`, patientProfileDraft, { headers: { Authorization: `Bearer ${patientToken}` } });
      setPatient(data.patient);
      setBooking((old) => ({ ...old, patientName: data.patient.fullName, patientEmail: data.patient.email, phone: data.patient.phone }));
      setPatientProfileEditing(false);
      setNotice(data.message || "Your profile was updated.");
    } catch (err) { setError(err.response?.data?.message || "Could not update your profile."); }
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

  async function loadPatientModules() {
    if (!patientToken) return;
    const headers = { Authorization: "Bearer " + patientToken };
    try {
      const [familyResult, recordsResult, reviewsResult] = await Promise.all([
        axios.get(API + "/patient/family", { headers }),
        axios.get(API + "/patient/records", { headers }),
        axios.get(API + "/patient/reviews", { headers }),
      ]);
      setFamilyMembers(familyResult.data || []);
      setMedicalRecords(recordsResult.data || []);
      setPatientReviews(reviewsResult.data || []);
    } catch (err) { setError(err.response?.data?.message || "Could not load your health records."); }
  }

  async function saveFamilyMember(event) {
    event.preventDefault();
    if (!patientToken) return;
    setPatientModuleBusy(true);
    try {
      const response = await axios.post(API + "/patient/family", familyDraft, { headers: { Authorization: "Bearer " + patientToken } });
      setFamilyMembers((items) => [response.data.member, ...items]);
      setFamilyDraft({ fullName: "", relationship: "Child", dateOfBirth: "", phone: "" });
      setNotice(response.data.message || "Family member added.");
    } catch (err) { setError(err.response?.data?.message || "Could not add family member."); }
    finally { setPatientModuleBusy(false); }
  }

  async function removeFamilyMember(member) {
    if (!window.confirm("Remove " + member.fullName + " and their linked medical records?")) return;
    try {
      const response = await axios.delete(API + "/patient/family/" + member._id, { headers: { Authorization: "Bearer " + patientToken } });
      setFamilyMembers((items) => items.filter((item) => item._id !== member._id));
      await loadPatientModules();
      setNotice(response.data.message || "Family member removed.");
    } catch (err) { setError(err.response?.data?.message || "Could not remove family member."); }
  }

  async function uploadMedicalRecord(event) {
    event.preventDefault();
    if (!recordFile || !recordDraft.title.trim()) { setError("Add a document title and choose a PDF, JPG or PNG file."); return; }
    const formData = new FormData();
    formData.append("file", recordFile);
    formData.append("title", recordDraft.title);
    formData.append("category", recordDraft.category);
    if (recordDraft.familyMemberId) formData.append("familyMemberId", recordDraft.familyMemberId);
    if (recordDraft.appointmentId) formData.append("appointmentId", recordDraft.appointmentId);
    setPatientModuleBusy(true);
    try {
      const response = await axios.post(API + "/patient/records", formData, { headers: { Authorization: "Bearer " + patientToken, "Content-Type": "multipart/form-data" } });
      setMedicalRecords((items) => [response.data.record, ...items]);
      setRecordDraft({ title: "", category: "Prescription", familyMemberId: "", appointmentId: "" });
      setRecordFile(null);
      event.target.reset();
      setNotice(response.data.message || "Medical document saved.");
    } catch (err) { setError(err.response?.data?.message || "Could not upload medical document."); }
    finally { setPatientModuleBusy(false); }
  }

  async function downloadMedicalRecord(record) {
    try {
      const response = await axios.get(API + "/patient/records/" + record._id + "/download", { headers: { Authorization: "Bearer " + patientToken }, responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = record.fileName || "medical-record";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.response?.data?.message || "Could not download medical document."); }
  }

  async function submitPatientReview(appointmentId) {
    const draft = reviewDrafts[appointmentId] || { rating: 5, comment: "" };
    try {
      const response = await axios.post(API + "/patient/reviews", { appointmentId, rating: Number(draft.rating), comment: draft.comment }, { headers: { Authorization: "Bearer " + patientToken } });
      setPatientReviews((items) => [response.data.review, ...items]);
      setNotice(response.data.message || "Review saved.");
    } catch (err) { setError(err.response?.data?.message || "Could not save review."); }
  }

  async function startVideoConsultation(appointment) {
    try {
      const response = await axios.post(API + "/patient/appointments/" + appointment._id + "/video-room", {}, { headers: { Authorization: "Bearer " + patientToken } });
      await loadPatientAppointments();
      window.open(response.data.roomUrl, "_blank", "noopener,noreferrer");
    } catch (err) { setError(err.response?.data?.message || "Could not start video consultation."); }
  }

  async function askPatientAssistant(event) {
    event.preventDefault();
    const question = assistantInput.trim();
    if (!question || assistantBusy) return;
    setAssistantMessages((items) => [...items, { role: "user", text: question }]);
    setAssistantInput("");
    setAssistantBusy(true);
    try {
      const response = await axios.post(API + "/patient/assistant", { message: question }, { headers: { Authorization: "Bearer " + patientToken } });
      setAssistantMessages((items) => [...items, { role: "assistant", text: response.data.answer }]);
    } catch (err) {
      setAssistantMessages((items) => [...items, { role: "assistant", text: err.response?.data?.message || "The assistant is temporarily unavailable." }]);
    } finally { setAssistantBusy(false); }
  }

  async function deleteMedicalRecord(record) {
    if (!window.confirm("Delete " + record.title + "?")) return;
    try {
      const response = await axios.delete(API + "/patient/records/" + record._id, { headers: { Authorization: "Bearer " + patientToken } });
      setMedicalRecords((items) => items.filter((item) => item._id !== record._id));
      setNotice(response.data.message || "Medical document deleted.");
    } catch (err) { setError(err.response?.data?.message || "Could not delete medical document."); }
  }

  function printPaymentInvoice(appointment) {
    const popup = window.open("", "_blank", "width=760,height=850");
    if (!popup) { setError("Allow pop-ups to print or save your invoice."); return; }
    const bookingId = appointment.bookingReference || appointment._id;
    const amount = Number(appointment.paymentAmount || appointment.doctorId?.fee || 0);
    const rows = [
      ["Receipt / Booking ID", bookingId],
      ["Patient", patient?.fullName || appointment.patientName],
      ["Clinic", appointment.clinicId?.clinicName || "MediCall clinic"],
      ["Doctor", appointment.doctorId?.name || "Doctor"],
      ["Appointment", appointment.date + " at " + appointment.time],
      ["Payment method", appointment.paymentMethod || "Online"],
      ["Payment status", appointment.paymentStatus],
    ];
    const rowHtml = rows.map((row) => "<tr><td>" + row[0] + "</td><td>" + String(row[1] || "").replace(/[&<>]/g, "") + "</td></tr>").join("");
    popup.document.write("<!doctype html><html><head><title>MediCall receipt</title><style>body{font:15px Arial;color:#172033;padding:40px;max-width:720px;margin:auto}h1{color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:28px}td{padding:13px;border-bottom:1px solid #ddd}.total{font-size:22px;font-weight:bold;text-align:right;margin-top:28px}</style></head><body><h1>MediCall AI</h1><p>Payment receipt</p><table>" + rowHtml + "</table><p class='total'>Total paid: ₹" + amount.toLocaleString("en-IN") + "</p><script>window.onload=function(){window.print()}<\/script></body></html>");
    popup.document.close();
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
          <img src={theme === "dark" ? medicallLogoDark : medicallLogo} alt="MediCall AI — Care, connected" className="h-11 w-auto sm:h-12" />
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
        <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 md:py-10 lg:px-10">
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
              <img src={healthcareHero} alt="Illustration representing connected healthcare" className="pointer-events-none absolute -right-12 -top-10 hidden h-56 w-72 object-contain opacity-35 mix-blend-screen md:block" />
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

          <section className="mx-auto mt-10 max-w-6xl grid gap-6 md:grid-cols-[.9fr_1.1fr] md:items-center">
            <div className="rounded-[1.75rem] bg-[#102c3a] p-8 text-white sm:p-10">
              <p className="text-xs font-extrabold uppercase tracking-[.22em] text-cyan-200">Why MediCall AI?</p>
              <h2 className="mt-4 text-3xl font-black leading-tight">Making healthcare access easier for everyone.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-200">We developed MediCall AI to reduce the friction of finding a clinic, understanding available services and arranging appointments. Patients get a simpler way to connect with care, while clinics get tools to organise their daily work.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{icon:"✦",title:"AI-powered assistance",body:"Ask questions and get guided support through chat or voice."},{icon:"⌖",title:"Clinic discovery",body:"Choose from clinics that have created an account on MediCall AI."},{icon:"▦",title:"Appointment management",body:"Request, review and manage appointments in one place."},{icon:"♡",title:"Connected care teams",body:"Patients, doctors and clinic teams use role-based workspaces."}].map((item) => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-xl text-cyan-800">{item.icon}</span><h3 className="mt-4 font-extrabold text-slate-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p></article>)}
            </div>
          </section>
          <section className="mx-auto mt-9 max-w-6xl rounded-[1.75rem] border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white p-8 text-center sm:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-cyan-800">One platform · Three experiences</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">Care works better when everyone is connected.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">Patients can find registered clinics, doctors can manage their schedules, and clinics can coordinate appointments and their teams.</p>
            <button className={`${button} mt-6`} onClick={() => { setAuthMode("patient-login"); setPage("auth"); }}>Get Started with MediCall AI →</button>
          </section>

          {patientToken && <section id="booking" className="mt-12 scroll-mt-24 md:mt-14">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-700">PERSONALIZED CARE</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
                  {selectedClinicId && clinic?.id === selectedClinicId ? clinic.clinicName : "Book your appointment"}
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
                        <span className="mt-1 block text-sm text-slate-500">{doctor.specialization}</span><span className="mt-1 block text-[11px] text-slate-500">At this clinic since {doctor.createdAt ? new Date(doctor.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "date unavailable"}</span>
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
                    <select className={`${field} min-h-12 rounded-xl bg-slate-50/70 px-4`} required value={selectedClinicId} onChange={(e) => chooseClinic(e.target.value)}>
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
                      {Array.from({ length: 48 }, (_, i) => {
                        const hour = Math.floor(i / 2);
                        const minute = i % 2 ? "30" : "00";
                        const time = `${String(hour).padStart(2, "0")}:${minute}`;
                        if (!selectedClinicHours || selectedClinicHours.isOpen === false || time < selectedClinicHours.openTime || time >= selectedClinicHours.closeTime) return null;
                        return <option key={time} value={time}>{time}</option>;
                      })}
                    </select>
                  </label>
                  {booking.date && (!selectedClinicHours || selectedClinicHours.isOpen === false) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 sm:col-span-2">The clinic is closed on {clinicDays[new Date(`${booking.date}T12:00:00`).getDay()]}. Please select one of its working days.</p>}
                  {booking.date && selectedClinicHours?.isOpen && <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold text-blue-800 sm:col-span-2">Clinic hours on {clinicDays[selectedClinicHours.dayOfWeek]}: {selectedClinicHours.openTime}–{selectedClinicHours.closeTime}. Choose a time within these hours.</p>}
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Reason for visit <span className="font-normal text-slate-400">(optional)</span></span>
                    <textarea className={`${field} rounded-xl bg-slate-50/70 px-4`} rows={4} placeholder="Tell us briefly what you need help with" value={booking.reason} onChange={(e) => setBooking({ ...booking, reason: e.target.value })} />
                  </label>
                </div>

                <button className={`${button} mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl text-base shadow-lg shadow-teal-700/20`} disabled={busy || !selectedClinicId || !clinic || !doctors.length}>
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
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><div className="relative"><input className={`${field} rounded-xl bg-slate-50 pr-20`} type={showPatientPassword ? "text" : "password"} minLength={8} placeholder="At least 8 characters" required value={patientAuth.password} onChange={(e) => setPatientAuth({ ...patientAuth, password: e.target.value })} /><button type="button" onClick={() => setShowPatientPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-700">{showPatientPassword ? "Hide" : "Show"}</button></div></label>
            </> : <>
              {authMode.endsWith("register") && <>
                <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Clinic name</span><input className={`${field} rounded-xl bg-slate-50`} placeholder="Clinic name" required value={auth.clinicName} onChange={(e) => setAuth({ ...auth, clinicName: e.target.value })} /></label>
                <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Admin name</span><input className={`${field} rounded-xl bg-slate-50`} placeholder="Admin name" required value={auth.adminName} onChange={(e) => setAuth({ ...auth, adminName: e.target.value })} /></label>
              </>}
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span><input className={`${field} rounded-xl bg-slate-50`} type="email" placeholder="clinic@example.com" required value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><div className="relative"><input className={`${field} rounded-xl bg-slate-50 pr-20`} type={showClinicPassword ? "text" : "password"} minLength={8} placeholder="At least 8 characters" required value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} /><button type="button" onClick={() => setShowClinicPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-700">{showClinicPassword ? "Hide" : "Show"}</button></div></label>
            </>}
            <button className={`${button} w-full rounded-xl py-4`} disabled={busy}>{busy ? "Please wait…" : authMode.endsWith("register") ? "Create account" : "Sign in securely"}</button>
            <p className="text-center text-sm text-slate-500">{authMode.endsWith("register") ? "Already have an account?" : "New to MediCall?"} <button type="button" className="font-bold text-teal-700 hover:text-teal-900" onClick={() => setAuthMode(authMode.endsWith("register") ? authMode.replace("register", "login") : authMode.replace("login", "register"))}>{authMode.endsWith("register") ? "Sign in" : "Create account"}</button></p>
            <button type="button" onClick={() => setPage("home")} className="w-full text-sm font-semibold text-slate-400 hover:text-slate-700">← Back to patient website</button>
          </form>
        </main>
      )}

      {page === "patient-dashboard" && (
        <main className="patient-dashboard mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <nav className="patient-portal-nav mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-lg shadow-slate-900/[0.04] backdrop-blur sm:gap-2.5"><a href="#patient-profile" className="patient-nav-link patient-nav-home"><span className="patient-nav-icon">⌂</span><span>My account</span></a><a href="#patient-profile" className="patient-nav-link"><span className="patient-nav-icon">◉</span><span>My profile</span></a><a href="#patient-appointments" className="patient-nav-link"><span className="patient-nav-icon">▣</span><span>Appointments</span></a><a href="#patient-health-dashboard" className="patient-nav-link"><span className="patient-nav-icon">♥</span><span>Health</span></a><a href="#patient-notifications" className="patient-nav-link"><span className="patient-nav-icon">◷</span><span>Updates</span></a><a href="#patient-records" className="patient-nav-link"><span className="patient-nav-icon">▤</span><span>Records</span></a><a href="#patient-family" className="patient-nav-link"><span className="patient-nav-icon">♧</span><span>Family</span></a><a href="#patient-payments" className="patient-nav-link"><span className="patient-nav-icon">₹</span><span>Payments</span></a><a href="#patient-ai-assistant" className="patient-nav-link"><span className="patient-nav-icon">✦</span><span>AI assistant</span></a><a href="#patient-smart-care" className="patient-nav-link"><span className="patient-nav-icon">✦</span><span>Find care</span></a>{selectedClinicId && clinic?.id === selectedClinicId && <a href="#patient-clinic-location" className="patient-nav-link"><span className="patient-nav-icon">⌖</span><span>Clinic location</span></a>}<span className="ml-auto hidden rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 sm:inline-flex sm:items-center sm:gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/> Patient account</span></nav>
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div id="patient-profile" className="patient-hero scroll-mt-28 bg-gradient-to-r from-[#123747] to-[#087e83] px-6 py-5 text-white sm:px-7 sm:py-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/15 text-xl font-black text-white">{(patient?.fullName || "P").trim().charAt(0).toUpperCase()}</span>
                  <div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-100">PATIENT PORTAL · CARE, CONNECTED</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Welcome back, {patient?.fullName || "there"}!</h1><p className="mt-1 text-sm text-teal-50">Your health appointments, all in one place.</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">{patientAppointments.length} appointment{patientAppointments.length===1?"":"s"}</span>
                  {selectedClinicId && clinic?.id===selectedClinicId && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">{clinic.clinicName}</span>}
                </div>
              </div>
            </div>

            <div className="border-b border-slate-100 px-4 pb-1 pt-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-teal-700">YOUR DETAILS</p><h2 className="mt-1 text-lg font-black text-slate-900">My profile</h2><p className="mt-0.5 text-xs text-slate-500">Keep your contact information up to date.</p></div><button type="button" onClick={()=>setPatientProfileEditing((value)=>!value)} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-extrabold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100">{patientProfileEditing ? "Close editor" : "Edit details"} <span aria-hidden="true">✎</span></button></div></div>
            {patientProfileEditing && <form onSubmit={savePatientProfile} className="grid gap-3 border-b border-slate-100 bg-blue-50/50 p-4 sm:grid-cols-2 sm:p-5"><label className="text-xs font-bold text-slate-600">Full name<input required value={patientProfileDraft.fullName} onChange={(e)=>setPatientProfileDraft((v)=>({...v,fullName:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/></label><label className="text-xs font-bold text-slate-600">Email address<input required type="email" value={patientProfileDraft.email} onChange={(e)=>setPatientProfileDraft((v)=>({...v,email:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/></label><label className="text-xs font-bold text-slate-600">Phone number<input required type="tel" value={patientProfileDraft.phone} onChange={(e)=>setPatientProfileDraft((v)=>({...v,phone:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/></label><div className="flex items-end gap-2"><button className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Save changes</button><button type="button" onClick={()=>setPatientProfileEditing(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">Cancel</button></div></form>}

              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full name</p><p className="mt-1.5 text-base font-bold text-slate-900">{patient?.fullName || "—"}</p></div>
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email address</p><p className="mt-1.5 break-all text-base font-bold text-slate-900">{patient?.email || "—"}</p></div>
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone number</p><p className="mt-1.5 text-base font-bold text-slate-900">{patient?.phone || "—"}</p></div>
              <div className="flex flex-col justify-center gap-2 rounded-2xl bg-teal-50 p-4"><p className="font-bold text-teal-950">Ready to see a doctor?</p><p className="text-sm leading-5 text-teal-800">Choose a clinic and find the right specialist.</p><button className={`${button} w-full py-2.5`} onClick={() => setPage("home")}>Book an appointment →</button></div>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:px-5">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Confirmed</p><p className="mt-1 text-xl font-black text-slate-900">{patientAppointments.filter((item)=>item.status==="Confirmed").length}</p></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Completed</p><p className="mt-1 text-xl font-black text-slate-900">{patientAppointments.filter((item)=>item.status==="Completed").length}</p></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Paid visits</p><p className="mt-1 text-xl font-black text-slate-900">{patientAppointments.filter((item)=>item.paymentStatus==="Paid").length}</p></div>
            </div>
            <div id="patient-appointments" className="patient-appointments-list scroll-mt-28 border-t border-slate-100 px-4 py-5 sm:px-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-900">My appointments</h2><button onClick={loadPatientAppointments} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Refresh</button></div>
              <div className="space-y-3">{(showAllPatientAppointments ? patientAppointments : patientAppointments.slice(0, 3)).map((appt) => <article key={appt._id} className="patient-appointment-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{appt.doctorId?.name || "Doctor"}</p><p className="mt-1 text-sm text-slate-600">{appt.date} at {appt.time} · {appt.status}</p><p className="mt-1 inline-flex items-center gap-2 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-extrabold text-teal-800"><span className="text-[10px] uppercase tracking-wider text-teal-600">Booking ID</span> {appt.bookingReference || appt._id}</p><p className="mt-1 text-xs text-slate-500">Payment: {appt.paymentStatus || "Pending"}</p>
                {selectedClinicId && appt.clinicId?._id === selectedClinicId && appt.clinicId?.location?.address && <div className="mt-2 text-xs text-slate-600"><span className="font-semibold">Clinic:</span> {appt.clinicId.location.address} <a className="ml-1 font-bold text-teal-700 underline" href={appt.clinicId.location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.clinicId.location.address)}`} target="_blank" rel="noreferrer">Get directions</a></div>}{appt.doctorUnavailableNotice && <p className="mt-2 text-sm font-semibold text-amber-700">Doctor unavailable. Suggested dates: {(appt.alternativeDates || []).join(", ")}. Your appointment has not been changed.</p>}</div>
                <div className="flex flex-wrap gap-2">{appt.status === "Confirmed" && <><button onClick={() => startVideoConsultation(appt)} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white">Video visit</button><button onClick={() => cancelPatientAppointment(appt._id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Cancel</button>{appt.paymentStatus !== "Paid" && <button onClick={() => payAppointment(appt)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white">Pay online</button>}</>}</div></div>
                {appt.status === "Confirmed" && <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input type="date" min={new Date().toISOString().slice(0,10)} className="rounded-lg border border-slate-200 p-2 text-sm" value={rescheduleDrafts[appt._id]?.date || ""} onChange={(e) => setRescheduleDrafts((old) => ({ ...old, [appt._id]: { ...old[appt._id], date: e.target.value } }))}/><input type="time" min="09:00" max="16:59" className="rounded-lg border border-slate-200 p-2 text-sm" value={rescheduleDrafts[appt._id]?.time || ""} onChange={(e) => setRescheduleDrafts((old) => ({ ...old, [appt._id]: { ...old[appt._id], time: e.target.value } }))}/><button onClick={() => requestReschedule(appt._id)} className="rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800">Request reschedule</button></div>}
                {appt.rescheduleRequest?.status === "Pending" && <p className="mt-2 text-xs font-semibold text-amber-700">Reschedule request pending clinic approval: {appt.rescheduleRequest.date} at {appt.rescheduleRequest.time}</p>}
                {appt.status === "Completed" && !patientReviews.some((review)=>String(review.appointmentId)===String(appt._id)) && <form onSubmit={(e)=>{e.preventDefault();submitPatientReview(appt._id);}} className="mt-3 grid gap-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3 sm:grid-cols-[150px_1fr_auto]"><label className="text-xs font-bold text-slate-700">Rate your visit<select value={reviewDrafts[appt._id]?.rating || 5} onChange={(e)=>setReviewDrafts((old)=>({...old,[appt._id]:{...old[appt._id],rating:e.target.value}}))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm">{[5,4,3,2,1].map((n)=><option key={n} value={n}>{n} / 5 stars</option>)}</select></label><label className="text-xs font-bold text-slate-700">Feedback (optional)<input maxLength={1000} value={reviewDrafts[appt._id]?.comment || ""} onChange={(e)=>setReviewDrafts((old)=>({...old,[appt._id]:{...old[appt._id],comment:e.target.value}}))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm" placeholder="Share your experience"/></label><button className="self-end rounded-lg bg-amber-600 px-3 py-2.5 text-xs font-bold text-white">Submit review</button></form>}
                {patientReviews.some((review)=>String(review.appointmentId)===String(appt._id)) && <p className="mt-2 text-xs font-semibold text-emerald-700">✓ Your verified visit review has been submitted.</p>}
              </article>)}{!patientAppointments.length && <p className="text-sm text-slate-500">No appointments linked to this patient account yet. Book using the same email address as your account.</p>}
              {patientAppointments.length > 3 && <button onClick={() => setShowAllPatientAppointments((value) => !value)} className="mt-2 rounded-xl border border-teal-200 px-4 py-2.5 text-sm font-bold text-teal-800 hover:bg-teal-50">{showAllPatientAppointments ? "Show latest 3 bookings" : `View all bookings (${patientAppointments.length})`}</button>}</div>
            </div>

            <section id="patient-health-dashboard" className="scroll-mt-28 border-t border-slate-100 bg-slate-50/70 px-4 py-5 sm:px-5">
              <div className="mb-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-teal-700">YOUR HEALTH SNAPSHOT</p><h2 className="mt-1 text-xl font-black text-slate-900">Health dashboard</h2><p className="mt-1 text-sm text-slate-500">A summary of your MediCall appointments and recorded payments.</p></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[{label:"Total visits",value:patientAppointments.length},{label:"Completed",value:patientAppointments.filter((item)=>item.status==="Completed").length},{label:"Upcoming",value:patientAppointments.filter((item)=>item.status==="Confirmed"&&item.date>=today).length},{label:"Health documents",value:medicalRecords.length}].map((item)=><article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black text-slate-900">{item.value}</p></article>)}
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-bold text-slate-900">Recent care activity</h3>
                {patientAppointments.length ? <div className="mt-3 space-y-3">{patientAppointments.slice(0,4).map((item)=><div key={item._id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-bold text-slate-800">{item.doctorId?.name || "Doctor"} · {item.clinicId?.clinicName || "Clinic"}</p><p className="mt-1 text-xs text-slate-500">{item.date} at {item.time}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">{item.status}</span></div>)}</div> : <p className="mt-2 text-sm text-slate-500">Your appointment timeline will appear here after your first booking.</p>}
              </div>
            </section>


            <section id="patient-notifications" className="scroll-mt-28 border-t border-slate-100 px-4 py-5 sm:px-5">
              <div className="mb-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-700">APPOINTMENT UPDATES</p><h2 className="mt-1 text-xl font-black text-slate-900">Notifications & reminders</h2><p className="mt-1 text-sm text-slate-500">Important updates are generated from your appointment status and schedule.</p></div>
              <div className="space-y-2">
                {patientAppointments.filter((item)=>item.doctorUnavailableNotice || ["Pending","Approved","Rejected"].includes(item.rescheduleRequest?.status) || (item.status==="Confirmed" && item.date>=today)).sort((x,y)=>String(x.date).localeCompare(String(y.date))).slice(0,8).map((item)=><article key={item._id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">◷</span><div className="min-w-0"><p className="text-sm font-bold text-slate-900">{item.doctorUnavailableNotice ? "Doctor availability update" : item.rescheduleRequest?.status && item.rescheduleRequest.status!=="None" ? "Reschedule request " + item.rescheduleRequest.status.toLowerCase() : "Upcoming appointment reminder"}</p><p className="mt-1 text-xs text-slate-600">{item.doctorId?.name || "Your doctor"} · {item.date} at {item.time}</p>{item.doctorUnavailableNotice && <p className="mt-1 text-xs text-amber-700">Suggested alternatives: {(item.alternativeDates || []).join(", ") || "Please contact the clinic."}</p>}</div><span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{item.status}</span></article>)}
                {!patientAppointments.some((item)=>item.doctorUnavailableNotice || ["Pending","Approved","Rejected"].includes(item.rescheduleRequest?.status) || (item.status==="Confirmed" && item.date>=today)) && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">You are all caught up. New appointment updates will appear here.</p>}
              </div>
              <p className="mt-3 text-[10px] leading-4 text-slate-500">These are in-app reminders based on the latest appointment data. Automatic SMS reminders are currently paused.</p>
            </section>

            <section id="patient-records" className="scroll-mt-28 border-t border-slate-100 px-4 py-5 sm:px-5">
              <div className="mb-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-indigo-700">PRIVATE HEALTH FILES</p><h2 className="mt-1 text-xl font-black text-slate-900">Medical records & prescriptions</h2><p className="mt-1 text-sm text-slate-500">Upload prescriptions, lab reports, scans and discharge summaries. Only your signed-in account can access these files.</p></div>
              <form onSubmit={uploadMedicalRecord} className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700">Document title<input required maxLength={120} value={recordDraft.title} onChange={(e)=>setRecordDraft((v)=>({...v,title:e.target.value}))} placeholder="e.g. Blood test report" className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/></label>
                <label className="text-xs font-bold text-slate-700">Category<select value={recordDraft.category} onChange={(e)=>setRecordDraft((v)=>({...v,category:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">{["Prescription","Lab report","Scan / imaging","Discharge summary","Other"].map((item)=><option key={item}>{item}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">For family member (optional)<select value={recordDraft.familyMemberId} onChange={(e)=>setRecordDraft((v)=>({...v,familyMemberId:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">Myself</option>{familyMembers.map((member)=><option key={member._id} value={member._id}>{member.fullName} · {member.relationship}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Link appointment (optional)<select value={recordDraft.appointmentId} onChange={(e)=>setRecordDraft((v)=>({...v,appointmentId:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">No linked appointment</option>{patientAppointments.map((item)=><option key={item._id} value={item._id}>{item.date} · {item.doctorId?.name || "Doctor"}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700 sm:col-span-2">Choose file (PDF, JPG or PNG · max 5 MB)<input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e)=>setRecordFile(e.target.files?.[0] || null)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"/></label>
                <button disabled={patientModuleBusy} className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{patientModuleBusy ? "Saving…" : "Upload medical document"}</button>
              </form>
              <div className="mt-4 space-y-2">{medicalRecords.map((record)=><article key={record._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div className="min-w-0"><p className="font-bold text-slate-900">{record.title}</p><p className="mt-1 text-xs text-slate-500">{record.category} · {record.fileName} · {(record.fileSize/1024).toFixed(0)} KB</p><p className="mt-1 text-[10px] text-slate-400">{record.familyMemberId?.fullName ? "For " + record.familyMemberId.fullName : "For you"} · {new Date(record.createdAt).toLocaleDateString("en-IN")}</p></div><div className="flex gap-2"><button onClick={()=>downloadMedicalRecord(record)} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">Download</button><button onClick={()=>deleteMedicalRecord(record)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Delete</button></div></article>)}
                {!medicalRecords.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No medical documents uploaded yet.</p>}</div>
            </section>

            <section id="patient-family" className="scroll-mt-28 border-t border-slate-100 bg-emerald-50/30 px-4 py-5 sm:px-5">
              <div className="mb-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">CARE FOR YOUR HOUSEHOLD</p><h2 className="mt-1 text-xl font-black text-slate-900">Family members</h2><p className="mt-1 text-sm text-slate-500">Keep dependent details and link their medical documents to the right person.</p></div>
              <form onSubmit={saveFamilyMember} className="grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700">Full name<input required maxLength={100} value={familyDraft.fullName} onChange={(e)=>setFamilyDraft((v)=>({...v,fullName:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Family member name"/></label>
                <label className="text-xs font-bold text-slate-700">Relationship<select value={familyDraft.relationship} onChange={(e)=>setFamilyDraft((v)=>({...v,relationship:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm">{["Child","Parent","Spouse","Sibling","Other"].map((item)=><option key={item}>{item}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Date of birth (optional)<input type="date" value={familyDraft.dateOfBirth} onChange={(e)=>setFamilyDraft((v)=>({...v,dateOfBirth:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label>
                <label className="text-xs font-bold text-slate-700">Phone (optional)<input type="tel" maxLength={20} value={familyDraft.phone} onChange={(e)=>setFamilyDraft((v)=>({...v,phone:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Contact number"/></label>
                <button disabled={patientModuleBusy} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">Add family member</button>
              </form>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{familyMembers.map((member)=><article key={member._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div><p className="font-bold text-slate-900">{member.fullName}</p><p className="mt-1 text-xs text-slate-500">{member.relationship}{member.dateOfBirth ? " · DOB " + member.dateOfBirth : ""}{member.phone ? " · " + member.phone : ""}</p></div><button onClick={()=>removeFamilyMember(member)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Remove</button></article>)}
                {!familyMembers.length && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500 sm:col-span-2">No family members added yet.</p>}</div>
            </section>

            <section id="patient-payments" className="scroll-mt-28 border-t border-slate-100 px-4 py-5 sm:px-5">
              <div className="mb-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-amber-700">BILLING & RECEIPTS</p><h2 className="mt-1 text-xl font-black text-slate-900">Payment history & invoices</h2><p className="mt-1 text-sm text-slate-500">Review recorded payment status and print or save receipts for paid appointments.</p></div>
              <div className="space-y-2">{patientAppointments.filter((item)=>Number(item.paymentAmount || item.doctorId?.fee || 0)>0 || item.paymentStatus).map((item)=><article key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div><p className="font-bold text-slate-900">{item.doctorId?.name || "Doctor"} · {item.clinicId?.clinicName || "Clinic"}</p><p className="mt-1 text-xs text-slate-500">{item.date} at {item.time} · {item.bookingReference || item._id}</p><p className="mt-1 text-xs font-semibold text-slate-700">₹{Number(item.paymentAmount || item.doctorId?.fee || 0).toLocaleString("en-IN")} · {item.paymentMethod || "Payment method not recorded"}</p></div><div className="flex items-center gap-2"><span className={"rounded-full px-3 py-1.5 text-[10px] font-bold " + (item.paymentStatus==="Paid"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700")}>{item.paymentStatus || "Pending"}</span>{item.paymentStatus==="Paid" && <button onClick={()=>printPaymentInvoice(item)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Invoice / Print</button>}</div></article>)}
                {!patientAppointments.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Payment history will appear after you book an appointment.</p>}</div>
            </section>


            <section id="patient-ai-assistant" className="scroll-mt-28 border-t border-slate-100 bg-gradient-to-br from-indigo-50/60 via-white to-cyan-50/60 px-4 py-5 sm:px-5">
              <div className="mb-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-indigo-700">PERSONAL CARE COMPANION</p><h2 className="mt-1 text-xl font-black text-slate-900">MediCall AI assistant</h2><p className="mt-1 text-sm text-slate-500">Ask about your appointment schedule, common health terms or how to prepare for a clinic visit.</p></div>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
                {!assistantMessages.length && <p className="text-sm text-slate-500">Try asking: “What appointments do I have coming up?” or “What should I bring to a doctor visit?”</p>}
                {assistantMessages.map((message,index)=><div key={index} className={"max-w-[90%] rounded-2xl px-3 py-2.5 text-sm " + (message.role==="user"?"ml-auto bg-indigo-700 text-white":"bg-slate-100 text-slate-800")}><p className="whitespace-pre-wrap">{message.text}</p></div>)}
                {assistantBusy && <p className="text-xs font-semibold text-indigo-700">MediCall AI is preparing a reply…</p>}
              </div>
              <form onSubmit={askPatientAssistant} className="mt-3 flex gap-2"><input value={assistantInput} onChange={(e)=>setAssistantInput(e.target.value)} maxLength={2000} placeholder="Ask your health or appointment question…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500"/><button disabled={assistantBusy || !assistantInput.trim()} className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Ask</button></form>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">AI support is informational, not a diagnosis or prescription. Do not use it for emergencies; seek urgent medical care when needed.</p>
            </section>

            <section id="patient-smart-care" className="smart-care-card scroll-mt-28 border-t border-slate-100 bg-gradient-to-br from-indigo-50/80 via-white to-teal-50/70 px-4 py-5 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><Icon name="spark" size={18}/></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-indigo-700">SMART CARE FINDER</p><h2 className="text-lg font-black text-slate-950">Find the right specialist</h2></div></div>
                <span className="rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-indigo-700">Guidance, not diagnosis</span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600">Choose a clinic and describe your concern. We’ll match it with real doctors listed by that clinic.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[0.85fr_1.15fr]">
                <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-600">Selected clinic</span><select value={selectedClinicId} onChange={(e)=>chooseClinic(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Choose a clinic first</option>{clinics.map((item)=><option key={item._id} value={item._id}>{item.clinicName}</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-[11px] font-bold text-slate-600">What symptoms or concern do you have?</span><input value={symptomQuery} onChange={(e)=>setSymptomQuery(e.target.value)} placeholder="e.g. skin rash, knee pain, fever, tooth pain" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"/></label>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2"><button onClick={()=>{if(!symptomQuery.trim()){setError("Please describe your symptoms first.");return;}if(!selectedClinicId){setError("Please select a clinic first.");return;}setSymptomSpecialty(matchedSpecialty);}} className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-800">Find matching doctors</button>{symptomSpecialty && <button onClick={()=>{setSymptomSpecialty("");setSymptomQuery("");}} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600">Clear</button>}</div>
              {symptomSpecialty && selectedClinicId && clinic?.id===selectedClinicId && <div className="mt-3 rounded-2xl border border-indigo-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">Suggested medical specialty</p><p className="mt-1 text-lg font-black text-slate-900">{symptomSpecialty}</p><p className="mt-1 text-xs text-slate-500">Based on the words you entered; this is not a medical diagnosis.</p></div>
                  <div className="rounded-xl bg-indigo-50 px-3 py-2 text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">Clinic</p><p className="text-sm font-bold text-indigo-950">{clinic.clinicName}</p></div>
                </div>
                {clinic.location?.address && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Clinic location</p><p className="mt-0.5 text-sm font-semibold text-slate-700">{clinic.location.address}</p></div><a className="shrink-0 text-xs font-bold text-teal-700 underline" href={clinic.location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.location.address)}`} target="_blank" rel="noreferrer">Directions ↗</a></div>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {recommendedDoctors.slice(0,4).map((doctor)=><article key={doctor._id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-extrabold text-slate-900">{doctor.name}</p><p className="mt-0.5 text-xs font-semibold text-indigo-700">{doctor.specialization}</p><p className="mt-1 text-[10px] text-slate-500">Listed at {clinic.clinicName}</p><p className="mt-1 text-[10px] font-medium text-slate-500">Joined clinic: {doctor.createdAt ? new Date(doctor.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "Date not available"}</p></div><p className="shrink-0 text-sm font-black text-teal-800">₹{doctor.fee}</p></div>
                    <button onClick={()=>{setBooking((old)=>({...old,doctorId:doctor._id}));setPage("home");window.setTimeout(()=>document.getElementById("booking")?.scrollIntoView({behavior:"smooth",block:"start"}),120);}} className="mt-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white">Book this doctor →</button>
                  </article>)}
                </div>
                {!recommendedDoctors.length && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No doctor with this specialty is currently listed at {clinic.clinicName}. Please contact the clinic or select another clinic. For general concerns, consider speaking with a General Physician.</p>}
                {recommendedDoctors.length>0 && <p className="mt-2 text-[10px] text-slate-500">Showing up to four matching doctors from this selected clinic.</p>}
              </div>}
              {!selectedClinicId && <p className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-white/80 p-3 text-xs text-indigo-800">Select a registered clinic to see its doctors, address and directions.</p>}
              <p className="mt-3 text-[10px] leading-4 text-slate-500">For severe chest pain, difficulty breathing, stroke symptoms, heavy bleeding or another emergency, seek emergency medical care immediately.</p>
            </section>
            {selectedClinicId && clinic?.id===selectedClinicId && <div id="patient-clinic-location" className="scroll-mt-28 border-t border-slate-100 bg-cyan-50/60 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-cyan-700">SELECTED CLINIC</p><h2 className="mt-1 font-extrabold text-slate-900">{clinic.clinicName}</h2></div><span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-teal-800">Clinic location</span></div>
              <p className="mt-2 text-sm leading-5 text-slate-600">{clinic.location?.address || "This clinic has not added its full address yet."}</p>
              <div className="mt-3 rounded-xl border border-cyan-100 bg-white/80 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-800">Opening hours</p><p className="mt-1 text-[11px] font-semibold text-cyan-800">Open {(clinic.businessHours || []).filter((item) => item.isOpen).length} days per week</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{(clinic.businessHours || []).map((hours)=><p key={hours.dayOfWeek} className="text-xs text-slate-600"><strong className="inline-block w-24 text-slate-800">{clinicDays[hours.dayOfWeek]}</strong>{hours.isOpen ? `${hours.openTime} – ${hours.closeTime}` : "Closed"}</p>)}</div></div>
              {(clinic.location?.mapsUrl || clinic.location?.address) && <a className="mt-2 inline-flex text-sm font-bold text-teal-700 underline" href={clinic.location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.location.address)}`} target="_blank" rel="noreferrer">Open directions in Google Maps ↗</a>}
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-5 sm:px-8"><p className="text-sm text-slate-500">You are signed in as a patient.</p><button onClick={patientLogout} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Log out of patient account</button></div>
          </section>
        </main>
      )}

      {page === "dashboard" && (
        <main id="dashboard-top" data-clinic-view={clinicView} className="clinic-dashboard mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:pl-[260px] lg:pr-10">
          <section className="relative mb-6 overflow-hidden rounded-[26px] border border-slate-200 bg-gradient-to-r from-[#F5F7F9] via-white to-[#EAF2F6] p-5 shadow-sm sm:p-6">
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-3 py-1.5 text-[11px] font-bold tracking-wide text-blue-700 shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" /> CLINIC WORKSPACE</div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-[30px]">Good day, ${adminClinic?.clinicName || "Your clinic"}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Your clinic at a glance. Manage appointments, care teams and daily operations from one place.</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600"><span className="rounded-full border border-white bg-white/80 px-3 py-1.5">🩺 ${adminDoctors.length} doctors</span><span className="rounded-full border border-white bg-white/80 px-3 py-1.5">📅 ${todayAppointmentsCount} visits today</span><span className="rounded-full border border-white bg-white/80 px-3 py-1.5">🤖 ${adminClinic?.aiAgentName || "MediCall AI"} assistant</span></div>
              </div>
              <div className="flex shrink-0 items-center gap-3 self-stretch sm:self-center"><img src={clinicWorkspaceArt} alt="Illustration of a modern clinic team" className="hidden h-24 w-28 rounded-2xl object-contain sm:block md:h-28 md:w-36"/><button title="Reload the latest clinic profile, appointments, statistics, doctors and analytics from the server." aria-label="Refresh clinic dashboard data" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50" onClick={loadDashboard}><Icon name="arrow" size={16}/> Refresh data</button></div>
            </div>
</section>
          <aside className="clinic-sidebar fixed left-0 top-[76px] z-30 hidden h-[calc(100vh-76px)] w-[248px] flex-col border-r border-slate-200 px-3 py-5 text-white shadow-xl lg:flex" aria-label="Clinic dashboard navigation">
            <div className="mb-7 flex items-center gap-3 px-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg"><Icon name="plus" size={22}/></span><span className="min-w-0"><strong className="block truncate text-sm font-black">{adminClinic?.clinicName || "MAX HEALTHCARE"}</strong><span className="text-[10px] font-semibold tracking-wider text-blue-200">CLINIC WORKSPACE</span></span></div>
            <p className="px-3 pb-2 text-[9px] font-extrabold tracking-[.2em] text-blue-200/70">CLINICAL</p>
            {[[ "overview","Overview","spark"],["analytics","Analytics","message"],["appointments","Appointments","check"],["patients","Patients","user"],["team","Doctors & team","user"],["reports","Reports","check"],["settings","Clinic settings","plus"]].map(([key,label,icon]) => <button key={key} type="button" aria-current={clinicView===key?"page":undefined} onClick={() => {setClinicView(key);window.scrollTo({top:0,behavior:"smooth"});}} className={`clinic-nav-item mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-bold transition ${clinicView===key?"is-active":" "}`}><span className="clinic-nav-icon"><Icon name={icon} size={18}/></span><span>{label}</span>{clinicView===key && <span className="ml-auto text-[10px] font-black tracking-wider">●</span>}</button>)}
            <div className="mt-auto rounded-2xl border border-white/15 bg-white/[0.08] p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-blue-200">Managed by</p><p className="mt-1 text-sm font-extrabold tracking-wide text-white">MAX Healthcare</p><div className="my-3 h-px bg-white/15"/><button onClick={logout} className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-left text-xs font-bold text-white transition hover:bg-white/20">Sign out</button></div>
          </aside>
          <nav className="clinic-mobile-nav mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:hidden">{[[ "overview","Overview"],["analytics","Analytics"],["appointments","Appointments"],["patients","Patients"],["team","Team"],["reports","Reports"],["settings","Settings"]].map(([key,label])=><button key={key} onClick={()=>{setClinicView(key);window.scrollTo({top:0,behavior:"smooth"});}} className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-bold ${clinicView===key?"bg-blue-700 text-white":"text-slate-600 hover:bg-blue-50"}`}>{label}</button>)}</nav>

          <section id="clinic-analytics" data-clinic-panel="overview" hidden={clinicView !== "overview"} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Today", value: todayAppointmentsCount, note: "Confirmed visits", icon: "message", tint: "bg-slate-100 text-slate-700", filter: "today" },
              { label: "Tomorrow", value: tomorrowAppointmentsCount, note: "Next-day schedule", icon: "arrow", tint: "bg-blue-50 text-blue-700", filter: "tomorrow" },
              { label: "Scheduled later", value: scheduledLaterCount, note: "Future confirmed", icon: "plus", tint: "bg-slate-100 text-slate-700", filter: "later" },
              { label: "Completed visits", value: completedAppointments, note: "Visit history", icon: "check", tint: "bg-emerald-50 text-emerald-700", filter: "completed" },
              { label: "Cancelled", value: cancelledAppointmentsCount, note: "Closed bookings", icon: "close", tint: "bg-slate-100 text-slate-600", filter: "cancelled" },
              { label: "Doctors", value: stats.doctors || 0, note: "Clinic team", icon: "user", tint: "bg-slate-100 text-slate-700", filter: "team" },
            ].map((item) => (
              <article key={item.label} onClick={() => item.filter === "team" ? document.getElementById("clinic-team")?.scrollIntoView({ behavior: "smooth" }) : setAppointmentFilter(item.filter)} className="clinic-stat-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{item.value}</p>
                  </div>
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${item.tint}`}><Icon name={item.icon} size={20} /></span>
                </div>
                <p className="mt-3 text-xs text-slate-400">{item.note}</p>
              </article>
            ))}
          </section>

          <section data-clinic-panel="analytics" hidden={clinicView !== "analytics"} className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 clinic-ai-metrics">
            {[{ label: "AI conversations", value: analytics?.totalConversations ?? 0 }, { label: "Booked from AI", value: analytics?.convertedConversations ?? 0 }, { label: "AI conversion", value: `${analytics?.conversionRate ?? 0}%` }, { label: "Chat / Voice", value: `${analytics?.chatConversations ?? 0} / ${analytics?.voiceConversations ?? 0}` }].map((item) => <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{item.value}</p></article>)}
            <p className="sm:col-span-2 xl:col-span-4 text-xs text-slate-500">Conversion = unique tracked AI conversations that created an appointment ÷ total unique AI conversations. Chat and voice are counted separately using the conversation channel sent by the website.</p>
          </section>

          <section data-clinic-panel="overview" hidden={clinicView !== "overview"} className="mb-7 grid gap-4 lg:grid-cols-[1.15fr_.85fr] clinic-insights">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 via-white to-slate-50 p-6 text-slate-900 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-slate-500">Clinic intelligence</p><h2 className="mt-2 text-xl font-black">Performance at a glance</h2><p className="mt-1 text-sm text-slate-600">Consultation fees recorded as received are added to your clinic revenue.</p></div><span className="rounded-xl border border-slate-200 bg-white p-3 text-slate-500"><Icon name="spark" size={22}/></span></div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">Total collected</p><p className="mt-2 text-2xl font-black text-slate-900">₹{paidRevenue.toLocaleString("en-IN")}</p><p className="mt-1 text-[10px] text-slate-500">All confirmed receipts</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">Online payments</p><p className="mt-2 text-2xl font-black text-slate-900">₹{onlineRevenue.toLocaleString("en-IN")}</p><p className="mt-1 text-[10px] text-slate-500">Razorpay verified</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">Offline collections</p><p className="mt-2 text-2xl font-black text-slate-900">₹{offlineRevenue.toLocaleString("en-IN")}</p><p className="mt-1 text-[10px] text-slate-500">Cash · UPI · Card · Other</p></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Payment pending: {pendingPayments}</span><span>Completed visits: {completedAppointments}</span></div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-teal-700">AI conversion insight</p><h2 className="mt-2 text-xl font-black text-slate-950">Turn conversations into care</h2><p className="mt-2 text-sm leading-6 text-slate-500">{analytics?.totalConversations ? `${analytics.convertedConversations || 0} of ${analytics.totalConversations} tracked conversations led to an appointment (${analytics.conversionRate || 0}%).` : "Conversation metrics will appear after patients start using the AI chat or voice assistant."}</p><div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-indigo-500" style={{ width: `${Math.min(100, Math.max(0, Number(analytics?.conversionRate || 0)))}%` }}/></div><div className="mt-3 flex justify-between text-xs text-slate-500"><span>AI conversion</span><strong className="text-slate-800">{analytics?.conversionRate || 0}%</strong></div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Improvement tip: review unanswered questions and make sure doctor specializations, fees and availability are up to date.</p></article>
          </section>

          <section data-clinic-panel="analytics" hidden={clinicView !== "analytics"} className="mb-7 grid gap-4 lg:grid-cols-[1.35fr_.65fr] clinic-monthly-insights">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Appointment activity</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">30-day trend</h2></div>
                <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon name="message" size={19}/></span>
              </div>
              <div className="mt-5 flex h-36 items-end gap-[3px] border-b border-slate-100 px-1" role="img" aria-label="Appointments per day over the last 30 days">
                {monthlyAppointmentActivity.map((day) => <div key={day.key} title={`${day.label}: ${day.count} appointments`} className="flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t-sm bg-gradient-to-t from-blue-700 to-blue-400" style={{ height: day.count ? `${Math.max(5, day.count / monthlyMaxAppointments * 100)}%` : "2px", opacity: day.count ? 1 : .16 }}/></div>)}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{monthlyAppointmentActivity[0]?.label}</span><span>Last 30 days</span><span>Today</span></div>
              <p className="mt-3 text-xs text-slate-400">Confirmed and completed appointments by appointment date. Hover over a bar for its daily count.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Booking outcomes</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Appointment split</h2>
              <div className="mt-5 flex items-center justify-center">
                <div className="grid h-36 w-36 place-items-center rounded-full" style={{ background: outcomeGradient }}>
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><strong className="block text-2xl text-slate-900">{outcomeCounts.reduce((sum, item) => sum + item.count, 0)}</strong><span className="text-[10px] font-semibold text-slate-500">Total visits</span></div></div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {outcomeCounts.map((item) => <div key={item.label} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}/>{item.label}</span><strong className="text-slate-900">{item.count} <span className="font-normal text-slate-400">({Math.round(item.count / outcomeTotal * 100)}%)</span></strong></div>)}
              </div>
            </article>
          </section>

          <section data-clinic-panel="analytics" hidden={clinicView !== "analytics"} className="mb-7 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Appointments overview</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Last 7 days</h2></div><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon name="message" size={19}/></span></div>
              <div className="mt-5 flex h-36 items-end justify-between gap-3 border-b border-slate-100 px-1">
                {weeklyAppointmentActivity.map((day) => <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-bold text-slate-500">{day.count || ""}</span><div className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-blue-700 to-blue-500 transition-all" style={{ height: day.count ? `${Math.max(8, day.count / weeklyMaxAppointments * 100)}%` : "3px", opacity: day.count ? 1 : .16 }} /><span className="text-[10px] font-semibold text-slate-500">{day.label}</span></div>)}
              </div>
              <p className="mt-3 text-xs text-slate-400">Confirmed and completed appointments by booking date.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quick stats</p><div className="mt-4 space-y-4">{[{label:"Today's appointments",value:todayAppointmentsCount},{label:"Tomorrow",value:tomorrowAppointmentsCount},{label:"AI bookings",value:analytics?.convertedConversations ?? 0}].map((item)=><div key={item.label} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0"><span className="text-sm text-slate-500">{item.label}</span><strong className="text-xl text-slate-900">{item.value}</strong></div>)}</div></article>
          </section>

          <section id="clinic-appointments" data-clinic-panel="appointments" hidden={clinicView !== "appointments"} className="clinic-appointments mb-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,42,58,.045)]">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">Appointments</h2>
                <p className="mt-1 text-sm text-slate-500">Review bookings and update their status.</p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{filteredClinicAppointments.length} shown · {appointments.length} total</span>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
              {[
                ["upcoming", "Upcoming"],
                ["today", "Today"],
                ["tomorrow", "Tomorrow"],
                ["later", "Scheduled later"],
                ["completed", "Completed"],
                ["cancelled", "Cancelled"],
                ["all", "All bookings"],
              ].map(([value, label]) => <button key={value} onClick={() => setAppointmentFilter(value)} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${appointmentFilter === value ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"}`}>{label}</button>)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Patient</th><th className="px-6 py-4">Specialist</th><th className="px-6 py-4">Appointment</th><th className="px-6 py-4">Payment</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClinicAppointments.map((appointment) => (
                    <tr key={appointment._id} className="transition hover:bg-slate-50/70">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{appointment.patientName}</div>
                        <div className="mt-1 text-xs text-slate-500">{appointment.phone}</div><div className="mt-1 text-[10px] font-semibold text-slate-400">{appointment.bookingReference || appointment._id}</div>
                      </td>
                      <td className="px-6 py-4"><div className="font-medium text-slate-700">{appointment.doctorId?.name || "Doctor"}</div></td>
                      <td className="px-6 py-4"><div className="font-medium text-slate-700">{appointment.date}</div><div className="mt-1 text-xs text-slate-500">{appointment.time}</div></td>
                      <td className="px-6 py-4">
                        <div className={`font-bold ${appointment.paymentStatus === "Paid" ? "text-emerald-700" : appointment.status === "Cancelled" ? "text-slate-500" : "text-amber-700"}`}>{appointment.paymentStatus === "Paid" ? ((appointment.paymentMethod === "Razorpay" || appointment.razorpayPaymentId) ? "Paid online" : "Paid offline") : appointment.status === "Cancelled" ? "Closed · cancelled" : appointment.paymentStatus === "Failed" ? "Payment failed" : "Awaiting payment"}</div>
                        <div className="mt-1 text-xs text-slate-500">{appointment.paymentStatus === "Paid" ? `₹${Number(appointment.paymentAmount || appointment.doctorId?.fee || 0).toLocaleString("en-IN")} · ${appointment.paymentMethod || "Recorded"}` : appointment.status === "Cancelled" ? "No collection due" : `₹${Number(appointment.paymentAmount || appointment.doctorId?.fee || 0).toLocaleString("en-IN")} expected`}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${appointment.status === "Confirmed" ? "bg-emerald-50 text-emerald-700" : appointment.status === "Cancelled" ? "bg-rose-50 text-rose-700" : appointment.status === "Completed" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{appointment.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        {appointment.status === "Confirmed" && appointment.rescheduleRequest?.status === "Pending" ? <div className="flex flex-wrap items-center gap-2"><button className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white" onClick={async () => { try { await api.patch(`/appointments/${appointment._id}/reschedule-request`, { decision: "approve" }); setNotice("Reschedule approved; patient email sent if SMTP is configured."); await loadDashboard(); } catch (e) { setError(e.response?.data?.message || "Could not approve request."); } }}>Approve {appointment.rescheduleRequest.date} {appointment.rescheduleRequest.time}</button><button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700" onClick={async () => { try { await api.patch(`/appointments/${appointment._id}/reschedule-request`, { decision: "reject" }); setNotice("Reschedule request rejected; patient notified if SMTP is configured."); await loadDashboard(); } catch (e) { setError(e.response?.data?.message || "Could not reject request."); } }}>Reject</button></div> : appointment.status === "Confirmed" ? <div className="flex items-center gap-3">
                          <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100" onClick={() => completeAppointment(appointment)}>{appointment.paymentStatus === "Paid" ? "Complete visit" : `Complete & collect ₹${Number(appointment.paymentAmount || appointment.doctorId?.fee || 0).toLocaleString("en-IN")}`}</button>
                          <button className="px-2 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700" onClick={() => updateAppointment(appointment._id, "Cancelled")}>Cancel</button>
                        </div> : appointment.status === "Completed" && appointment.paymentStatus !== "Paid" ? <button className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100" onClick={() => { setCollectionMethod("Cash"); setCollectionModal(appointment); }}>Record offline payment</button> : <span className="text-xs text-slate-400">No actions</span>}
                      </td>
                    </tr>
                  ))}
                  {!filteredClinicAppointments.length && <tr><td colSpan="6" className="px-6 py-14 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Icon name="message" size={22} /></span>
                    <p className="mt-3 font-semibold text-slate-700">No appointments yet</p><p className="mt-1 text-sm text-slate-500">No bookings match this view. Choose another schedule or status filter.</p>
                  </td></tr>}
                </tbody>
              </table>
            </div>
          </section>



          <section data-clinic-panel="patients" hidden={clinicView !== "patients"} className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Patient directory</p><h2 className="mt-1 text-xl font-black text-slate-950">Patients</h2><p className="mt-1 text-sm text-slate-500">A clinic-scoped view built from your appointment records.</p></div>
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{clinicPatients.length} unique patients</span><button type="button" onClick={() => downloadCsv(`medicall-patients-${todayDateKey}.csv`, [["Patient name","Email","Phone","Total appointments","Completed visits","Upcoming visits","Last appointment"], ...clinicPatients.map((item) => [item.patientName,item.email,item.phone,item.totalVisits,item.completedVisits,item.upcomingVisits,item.lastAppointment])])} disabled={!clinicPatients.length} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Export patients CSV</button></div>
            </div>
            <div className="border-b border-slate-100 p-4 sm:px-6"><input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Search by patient name, email or phone..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 sm:max-w-md"/></div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:px-6">{[{label:"Unique patients",value:clinicPatients.length},{label:"Returning patients",value:clinicPatients.filter((item) => item.totalVisits > 1).length},{label:"Upcoming visits",value:clinicPatients.reduce((sum, item) => sum + item.upcomingVisits, 0)},{label:"Completed visits",value:clinicPatients.reduce((sum, item) => sum + item.completedVisits, 0)}].map((item) => <article key={item.label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-black text-slate-900">{item.value}</p></article>)}</div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Patient</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Appointments</th><th className="px-5 py-3">Upcoming</th><th className="px-5 py-3">Last appointment</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredClinicPatients.map((item) => <tr key={item.identity} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-semibold text-slate-800">{item.patientName}</td><td className="px-5 py-4"><div className="text-slate-700">{item.phone || "Phone not provided"}</div><div className="mt-1 text-xs text-slate-500">{item.email || "Email not provided"}</div></td><td className="px-5 py-4"><strong>{item.totalVisits}</strong><span className="ml-2 text-xs text-slate-500">· {item.completedVisits} completed</span></td><td className="px-5 py-4">{item.upcomingVisits}</td><td className="px-5 py-4 text-slate-600">{item.lastAppointment}</td></tr>)}{!filteredClinicPatients.length && <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-slate-500">{clinicPatients.length ? "No patients match your search." : "Patient records will appear after appointments are booked."}</td></tr>}</tbody></table></div>
            <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">Patient details are shown only to the authenticated clinic team. Records are grouped by email, then phone when email is unavailable.</p>
          </section>

          <section data-clinic-panel="reports" hidden={clinicView !== "reports"} className="mb-7 space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Clinic reporting</p><h2 className="mt-1 text-xl font-black text-slate-950">Reports & exports</h2><p className="mt-1 text-sm text-slate-500">Download clinic appointment and patient summaries for offline review.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => downloadCsv(`medicall-appointments-${todayDateKey}.csv`, [["Booking ID","Patient","Email","Phone","Doctor","Date","Time","Status","Payment status","Payment method","Amount (INR)"], ...appointments.map((item) => [item.bookingReference || item._id,item.patientName,item.patientEmail,item.phone,item.doctorId?.name || "Doctor",item.date,item.time,item.status,item.paymentStatus || "Pending",item.paymentMethod || "",amountForAppointment(item)])])} disabled={!appointments.length} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Export appointments CSV</button><button type="button" onClick={() => downloadCsv(`medicall-doctor-workload-${todayDateKey}.csv`, [["Doctor","Specialization","Total appointments","Upcoming appointments","Completed appointments","Status"], ...doctorWorkload.map((item) => [item.name,item.specialization,item.totalAppointments,item.upcomingAppointments,item.completedAppointments,item.isActive ? "Active" : "Unavailable"])])} disabled={!doctorWorkload.length} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Export doctor report</button></div></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Total appointments",value:appointments.length},{label:"Completed visits",value:completedAppointments},{label:"Cancelled bookings",value:cancelledAppointmentsCount},{label:"Collected revenue",value:`₹${paidRevenue.toLocaleString("en-IN")}`}].map((item) => <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black text-slate-900">{item.value}</p></article>)}</div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="font-bold text-slate-900">Doctor workload</h3><p className="mt-1 text-xs text-slate-500">Appointment counts are calculated from this clinic’s records.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Doctor</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Upcoming</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Availability</th></tr></thead><tbody className="divide-y divide-slate-100">{doctorWorkload.map((item) => <tr key={item._id}><td className="px-5 py-4"><div className="font-semibold text-slate-800">{item.name}</div><div className="text-xs text-slate-500">{item.specialization}</div></td><td className="px-5 py-4 font-bold">{item.totalAppointments}</td><td className="px-5 py-4">{item.upcomingAppointments}</td><td className="px-5 py-4">{item.completedAppointments}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.isActive ? "Active" : "Unavailable"}</span></td></tr>)}{!doctorWorkload.length && <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-slate-500">Add doctors to see workload reports.</td></tr>}</tbody></table></div></div>
            <p className="text-[11px] text-slate-500">Revenue uses recorded payments only. CSV exports contain patient contact information; store and share them securely.</p>
          </section>

          <section id="clinic-team" data-clinic-panel="team" hidden={clinicView !== "team"} className="grid scroll-mt-28 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-white to-cyan-50/70 p-5 shadow-[0_12px_35px_rgba(15,42,58,.06)] sm:p-6">
              <div className="mb-5">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-teal-700"><Icon name="plus" size={13}/> Team setup</span>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-950">Add your first doctor</h2>
                <p className="mt-1 text-sm text-slate-500">Add a specialist to your clinic directory.</p>
                <img src={clinicWorkspaceArt} alt="Modern clinic building illustration" className="my-3 h-28 w-full rounded-xl bg-slate-50 object-contain"/>
              </div>
              <form onSubmit={addDoctor} className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Doctor name</span><input className={`${field} rounded-xl bg-slate-50/70`} placeholder="e.g. Dr. Aditi Sharma" required value={doctorForm.name} onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })} /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Specialization</span><input className={`${field} rounded-xl bg-slate-50/70`} placeholder="e.g. Orthopaedics" required value={doctorForm.specialization} onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })} /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Consultation fee (₹)</span><input className={`${field} rounded-xl bg-slate-50/70`} type="number" min="0" placeholder="500" value={doctorForm.fee} onChange={(e) => setDoctorForm({ ...doctorForm, fee: e.target.value })} /></label>
                <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3"><p className="text-sm font-bold text-teal-900">Doctor portal account (optional)</p><p className="mt-1 text-xs text-teal-800">Add an email and temporary password so this doctor can sign in separately. Both fields are required together.</p><label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Doctor email</span><input className={`${field} rounded-xl bg-white`} type="email" placeholder="doctor@example.com" value={doctorForm.email} onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })} /></label><label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Temporary password (minimum 8 characters)</span><div className="relative"><input className={`${field} rounded-xl bg-white pr-20`} type={showDoctorSetupPassword ? "text" : "password"} minLength="8" placeholder="Create initial password" value={doctorForm.password} onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })} /><button type="button" onClick={() => setShowDoctorSetupPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-700">{showDoctorSetupPassword ? "Hide" : "Show"}</button></div></label></div>
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
                        <div className="mt-3 flex items-center justify-between gap-2"><div><p className="text-sm font-extrabold text-teal-800">₹{doctor.fee}<span className="ml-1 text-[10px] font-medium text-slate-400">/ visit</span></p><div className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"><button type="button" aria-label="Decrease consultation fee by 50 rupees" onClick={() => updateDoctorFee(doctor,-50)} className="grid h-7 w-8 place-items-center rounded-md text-sm font-black text-slate-700 hover:bg-rose-50 hover:text-rose-700">−</button><span className="px-1 text-[10px] font-bold text-slate-500">₹50</span><button type="button" aria-label="Increase consultation fee by 50 rupees" onClick={() => updateDoctorFee(doctor,50)} className="grid h-7 w-8 place-items-center rounded-md text-sm font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700">+</button></div><p className="mt-1 text-[9px] text-slate-400">Adjust future visit fee</p></div><button onClick={() => removeDoctor(doctor)} className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-rose-600 transition hover:bg-rose-50">Remove doctor</button></div>
                        {doctor.isActive ? <button className="mt-3 w-full rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100" onClick={async () => { const fromDate = window.prompt("Unavailable from date (YYYY-MM-DD)", new Date().toISOString().slice(0,10)); if (!fromDate) return; const toDate = window.prompt("Unavailable through date (YYYY-MM-DD, optional)", fromDate) || ""; try { const { data } = await api.post(`/doctors/${doctor._id}/unavailable`, { fromDate, toDate }); setNotice(data.message); await loadDashboard(); } catch (e) { setError(e.response?.data?.message || "Could not notify patients."); } }}>Mark unavailable & notify patients</button> : <button className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100" onClick={async () => { try { const { data } = await api.patch(`/doctors/${doctor._id}/availability-status`, { isActive: true }); setNotice(data.message); await loadDashboard(); await loadClinic(); } catch (e) { setError(e.response?.data?.message || "Could not reactivate doctor."); } }}>Reactivate doctor</button>}
                      </div>
                    </div>
                  </article>
                ))}
                {!adminDoctors.length && <div className="col-span-full rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center"><p className="font-semibold text-slate-700">No doctors added yet</p><p className="mt-1 text-sm text-slate-500">Add your clinic’s first doctor using the form.</p></div>}
              </div>
            </div>
          </section>

          <section data-clinic-panel="team" hidden={clinicView !== "team"} className="mt-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4"><h2 className="text-lg font-semibold text-slate-950">Doctor availability approvals</h2><p className="mt-1 text-sm text-slate-500">Review weekly schedules submitted by doctors before they are used for patient bookings.</p></div>
            <div className="space-y-3">
              {availabilityRequests.map((item) => <article key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div><p className="font-semibold text-slate-800">{item.doctorId?.name || "Doctor"} · { ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][item.dayOfWeek] }</p><p className="mt-1 text-xs text-slate-500">{item.startTime}–{item.endTime} · {item.slotMinutes}-minute slots</p></div><div className="flex items-center gap-2">{item.approved ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Approved</span> : <><button onClick={() => reviewAvailability(item._id, true)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white">Approve</button><button onClick={() => reviewAvailability(item._id, false)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">Reject</button></>}</div></article>)}
              {!availabilityRequests.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No doctor availability requests yet.</p>}
            </div>
          </section>
          <section data-clinic-panel="settings" hidden={clinicView !== "settings"} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-blue-700">Clinic settings</p><h2 className="mt-1 text-xl font-black text-slate-900">Practice profile & opening hours</h2><p className="mt-1 text-sm text-slate-500">Keep public clinic details and weekly schedule up to date.</p></div>
            <form onSubmit={saveClinicProfile} className="grid gap-4 md:grid-cols-2">
              {[[ "clinicName","Clinic name"],["adminName","Admin / contact person"],["email","Clinic email"],["phone","Clinic phone number"],["aiAgentName","AI assistant name"]].map(([key,label])=><label key={key} className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><input required={key!=="phone"} type={key==="email"?"email":key==="phone"?"tel":"text"} inputMode={key==="phone"?"tel":undefined} autoComplete={key==="phone"?"tel":undefined} maxLength={key==="aiAgentName"?50:key==="phone"?20:undefined} value={clinicProfileDraft[key] || ""} onChange={(e)=>setClinicProfileDraft((old)=>({...old,[key]:e.target.value}))} placeholder={key==="aiAgentName"?"e.g. MediCall Assistant":key==="phone"?"+91 98765 43210":"Enter "+label.toLowerCase()} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-blue-500"/>{key==="aiAgentName" && <span className="mt-1 block text-[11px] text-slate-500">This name is shown to patients when they chat with your clinic assistant.</span>}{key==="phone" && <span className="mt-1 block text-[11px] text-slate-500">Optional. Patients can use this number to contact your clinic.</span>}</label>)}
              <div className="md:col-span-2"><div className="mb-3"><h3 className="font-extrabold text-slate-900">Weekly opening hours</h3><p className="mt-1 text-xs font-semibold text-blue-700">Open {(clinicProfileDraft.businessHours || []).filter((item) => item.isOpen).length} days per week</p><p className="mt-1 text-xs text-slate-500">Select operating days and the opening / closing time.</p></div><div className="space-y-2">{(clinicProfileDraft.businessHours||[]).map((item,index)=><div key={item.dayOfWeek} className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><span className="text-xs font-bold text-slate-700">{clinicDays[item.dayOfWeek]}</span><label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={item.isOpen} onChange={(e)=>setClinicProfileDraft((old)=>({...old,businessHours:old.businessHours.map((h,i)=>i===index?{...h,isOpen:e.target.checked}:h)}))}/> Open</label><input type="time" disabled={!item.isOpen} value={item.openTime} onChange={(e)=>setClinicProfileDraft((old)=>({...old,businessHours:old.businessHours.map((h,i)=>i===index?{...h,openTime:e.target.value}:h)}))} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs disabled:opacity-40"/><input type="time" disabled={!item.isOpen} value={item.closeTime} onChange={(e)=>setClinicProfileDraft((old)=>({...old,businessHours:old.businessHours.map((h,i)=>i===index?{...h,closeTime:e.target.value}:h)}))} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs disabled:opacity-40"/></div>)}</div></div>
              <button className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-blue-800 md:col-span-2">Save clinic profile & hours</button>
            </form>
          </section>
          <details id="clinic-location" data-clinic-panel="settings" hidden={clinicView !== "settings"} open className="mt-8 scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <span><span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-500">Clinic settings · rarely changed</span><span className="mt-1 block text-base font-bold text-slate-800">Location and directions</span><span className="mt-1 block text-xs text-slate-500">{clinicLocationDraft.address || "Add your clinic address so patients can find you."}</span></span>
              <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">Edit location</span>
            </summary>
            <div className="mt-5 border-t border-slate-100 pt-5">
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
            </div>
          </details>
        </main>
      )}
      {page === "doctor-portal" && <DoctorPortal onExit={() => setPage("home")} />}

      {collectionModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCollectionModal(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="collection-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-[#123747] to-[#087e83] px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Icon name="check" size={22}/></span>
                <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-teal-100">Payment collection</p><h2 id="collection-title" className="mt-1 text-xl font-black">Record clinic payment</h2></div>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Patient</p>
                <p className="mt-1 font-bold text-slate-900">{collectionModal.patientName}</p>
                <p className="mt-2 text-xs text-slate-500">Doctor · {collectionModal.doctorId?.name || "Assigned doctor"}</p>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-200 pt-3">
                  <span className="text-sm font-semibold text-slate-600">Consultation fee received</span>
                  <strong className="text-2xl font-black text-slate-950">₹{Number(collectionModal.paymentAmount || collectionModal.doctorId?.fee || 0).toLocaleString("en-IN")}</strong>
                </div>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Payment method</span>
                <select value={collectionMethod} onChange={(event) => setCollectionMethod(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">This records the amount as received and adds it to collected clinic revenue. It does not transfer money to a bank account.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setCollectionModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                {collectionModal.status !== "Completed" && <button type="button" onClick={async () => { const saved = await updateAppointment(collectionModal._id, "Completed"); if (saved) setCollectionModal(null); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Complete as unpaid</button>}
                <button type="button" disabled={Number(collectionModal.paymentAmount || collectionModal.doctorId?.fee || 0) <= 0} onClick={confirmAppointmentCollection} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">{collectionModal.status === "Completed" ? "Confirm offline payment" : "Payment received · Complete"}</button>
              </div>
            </div>
          </section>
        </div>
      )}

      <footer className="border-t bg-white px-5 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} MediCall AI · Clinic-managed appointments
      </footer>

      {chatOpen && (
        <section className="fixed bottom-20 right-3 z-50 flex h-[min(720px,82dvh)] w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.35)] sm:bottom-24 sm:right-5">
          <header className="flex items-center justify-between border-b border-slate-100 bg-white p-4 text-slate-900">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon name="spark" size={21} /></span>
                <div><h2 className="font-semibold tracking-tight">{clinic?.aiAgentName || "MediCall AI"}</h2>
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
          <div className="border-b border-slate-100 bg-white px-3 py-2">
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500"><span className="shrink-0">Clinic context</span><select value={selectedClinicId} onChange={(e)=>chooseClinic(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700"><option value="">Select a clinic for AI recommendations</option>{clinics.map((item)=><option key={item._id} value={item._id}>{item.clinicName}</option>)}</select></label>
            {selectedClinicId && clinic?.id===selectedClinicId && clinic.location?.address && <p className="mt-1 truncate text-[10px] text-slate-500">📍 {clinic.location.address}</p>}
          </div>

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
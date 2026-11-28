import LoginHeader from "./LoginHeader.jsx";
import {EmailCode, ProfileFields, EditDoctor, JoinClinic} from "./DoctorMembership.jsx";
import PortalNavigation from "./PortalNavigation.jsx";
import VideoRequests from "./VideoRequests.jsx";
import PlatformReview from "./PlatformReview.jsx";
import AppointmentCalendar from "./AppointmentCalendar.jsx";
import { ChangePasswordPanel, ForgotPasswordPanel } from "./PasswordSecurity.jsx";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import consultationPhoto from "./assets/clinic-consultation.jpg";

const API = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;
const doctorSections = [["overview","Dashboard"],["appointments","Appointments"],["video","Video visits"],["availability","Availability"],["files","Patient files"],["settings","Settings"]];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50";
const btn = "doctor-primary-button rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50";

export default function DoctorPortal({ onExit, onSelectRole }) {
  const [token, setToken] = useState(() => localStorage.getItem("medicall_doctor_token") || "");
  const [doctor, setDoctor] = useState(null);
  const [register,setRegister]=useState(false);
  const [emailCode,setEmailCode]=useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [appointmentView, setAppointmentView] = useState("today");
  const [form, setForm] = useState({ dayOfWeek: "1", startTime: "09:00", endTime: "17:00", slotMinutes: "30" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [calendarMode, setCalendarMode] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [clinicalNote, setClinicalNote] = useState({ symptoms: "", diagnosis: "", treatmentPlan: "", doctorNotes: "", followUpDate: "", medicinesText: "" });
  const [previousVisits, setPreviousVisits] = useState([]);
  const [noteBusy, setNoteBusy] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const doctorApi = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${token}` } });

  const loadPortal = useCallback(async (authToken = token) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    const me=await axios.get(API+"/doctor/me",{headers});
    if (!me.data.doctor.clinicId) {setDoctor(me.data.doctor);setAppointments([]);setAvailability([]);return;}
    const [appts, slots] = await Promise.all([
      axios.get(`${API}/doctor/appointments`, { headers }),
      axios.get(`${API}/doctor/availability`, { headers }),
    ]);
    const profile = me.data.doctor;
    const clinicId = profile.clinicId?._id || profile.clinicId;
    let clinicName = profile.clinicName || profile.clinicId?.clinicName;
    if (!clinicName && clinicId) {
      try {
        const { data } = await axios.get(API + "/public/clinics", { params: { clinicId } });
        clinicName = data.clinics?.find(clinic => String(clinic._id) === String(clinicId))?.clinicName;
      } catch { /* A directory lookup failure should not end the doctor's session. */ }
    }
    setDoctor({ ...profile, clinicName });
    setAppointments(appts.data);
    setAvailability(slots.data);
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    Promise.resolve().then(() => loadPortal(token)).catch((err) => {
      if (!active) return;
      localStorage.removeItem("medicall_doctor_token"); setToken("");
      setError(err.response?.data?.message || "Doctor session expired. Please sign in again.");
    });
    return () => { active = false; };
  }, [token, loadPortal]);

  useEffect(() => {
    if (message !== "Doctor login successful.") return;
    const timer = setTimeout(() => setMessage(""), 10000);
    return () => clearTimeout(timer);
  }, [message]);

  async function login(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if(register){ const fields=Object.fromEntries(new FormData(e.currentTarget)); await axios.post(API+"/doctor-auth/register",{...fields,email,password,emailCode});setRegister(false);setMessage("Account created. Sign in to join a clinic.");return;}
      const { data } = await axios.post(`${API}/doctor-auth/login`, { email, password });
      localStorage.setItem("medicall_doctor_token", data.token); setToken(data.token); setDoctor(data.doctor); setForgotPasswordOpen(false); setMessage("Doctor login successful.");
    } catch (err) { setError(err.response?.data?.message || "Could not sign in."); }
    finally { setBusy(false); }
  }

  async function submitAvailability(e) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await doctorApi.post("/doctor/availability", { ...form, dayOfWeek: Number(form.dayOfWeek), slotMinutes: Number(form.slotMinutes) });
      setMessage(data.message); await loadPortal();
    } catch (err) { setError(err.response?.data?.message || "Could not submit availability."); }
    finally { setBusy(false); }
  }

  async function removeAvailability(id) {
    try { await doctorApi.delete(`/doctor/availability/${id}`); await loadPortal(); setMessage("Pending availability removed."); }
    catch (err) { setError(err.response?.data?.message || "Could not remove availability."); }
  }


  async function openPatientFile(appointment) {
    navigateToSection("files");
    setPreviousVisits([]); setSelectedAppointment(appointment); setNoteBusy(true); setError(""); setMessage("");
    setClinicalNote({ symptoms: "", diagnosis: "", treatmentPlan: "", doctorNotes: "", followUpDate: "", medicinesText: "" });
    try {
      const response = await doctorApi.get("/doctor/appointments/" + appointment._id + "/clinical-note");
      setPreviousVisits(response.data.previous || []);
      const note = response.data.note || {};
      setClinicalNote({
        symptoms: note.symptoms || "", diagnosis: note.diagnosis || "", treatmentPlan: note.treatmentPlan || "",
        doctorNotes: note.doctorNotes || "", followUpDate: note.followUpDate || "",
        medicinesText: (note.medicines || []).map((m) => [m.name, m.dosage, m.duration, m.instructions].join(" | ")).join("\n"),
      });
    } catch (err) { setError(err.response?.data?.message || "Could not load this patient file."); }
    finally { setNoteBusy(false); }
  }

  async function saveClinicalNote(e) {
    e.preventDefault(); if (!selectedAppointment) return;
    setNoteBusy(true); setError(""); setMessage("");
    const medicines = clinicalNote.medicinesText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return { name: parts[0] || "", dosage: parts[1] || "", duration: parts[2] || "", instructions: parts[3] || "" };
    });
    try {
      const response = await doctorApi.put("/doctor/appointments/" + selectedAppointment._id + "/clinical-note", {
        symptoms: clinicalNote.symptoms, diagnosis: clinicalNote.diagnosis, treatmentPlan: clinicalNote.treatmentPlan,
        doctorNotes: clinicalNote.doctorNotes, followUpDate: clinicalNote.followUpDate, medicines,
      });
      setMessage(response.data.message || "Consultation notes saved securely.");
    } catch (err) { setError(err.response?.data?.message || "Could not save the patient file."); }
    finally { setNoteBusy(false); }
  }

  function logout() {
    localStorage.removeItem("medicall_doctor_token"); setToken(""); setActiveSection("overview"); setSelectedAppointment(null); setDoctor(null); setAppointments([]); setAvailability([]);
  }

  function navigateToSection(section) {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const dateKey = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  };
  const todayKey = dateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKey(tomorrow);
  const todayAppointments = appointments.filter((item) => item.status === "Confirmed" && item.date === todayKey);
  const tomorrowAppointments = appointments.filter((item) => item.status === "Confirmed" && item.date === tomorrowKey);
  const scheduledLater = appointments.filter((item) => item.status === "Confirmed" && item.date > tomorrowKey);
  const completedAppointments = appointments.filter((item) => item.status === "Completed");
  const filteredAppointments = appointments.filter((item) => {
    if (appointmentView === "today") return item.status === "Confirmed" && item.date === todayKey;
    if (appointmentView === "tomorrow") return item.status === "Confirmed" && item.date === tomorrowKey;
    if (appointmentView === "later") return item.status === "Confirmed" && item.date > tomorrowKey;
    if (appointmentView === "completed") return item.status === "Completed";
    if (appointmentView === "cancelled") return item.status === "Cancelled";
    if (appointmentView === "all") return true;
    return item.status === "Confirmed" && item.date >= todayKey;
  });

  if (!token || !doctor) return (
    <main className="doctor-login-layout mx-auto grid min-h-[75vh] max-w-5xl items-center px-4 py-10 md:grid-cols-2 md:gap-10">
      <section className="doctor-signin-story">
        <img src={consultationPhoto} alt="Doctor discussing a care plan with a patient" loading="lazy"/>
        <div>
          <p className="doctor-signin-eyebrow">DOCTOR PORTAL · CLINIC TEAM</p>
          <h1>Your practice, in sync.</h1>
          <p>Use your clinic-provided account to manage your schedule and follow each assigned patient visit.</p>
          <ul className="doctor-signin-benefits"><li>Review your assigned appointments</li><li>Submit availability for clinic approval</li><li>Save consultation notes and prescriptions</li></ul>
        </div>
      </section>
      <div className="mx-auto w-full max-w-md space-y-4">
      <form onSubmit={login} className="care-login-card">
        <LoginHeader role="doctor" registering={register} onSelect={role => {
          if (role !== "doctor") onSelectRole?.(role);
        }} />
        <div className="care-login-fields">
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <label className="care-login-label">Email address<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="doctor@clinic.com" /></label>
        <label className="care-login-label">Password<span className="care-password-wrap"><input autoComplete={register ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /><button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Hide" : "Show"}</button></span></label>
        {message && <p role="status">{message}</p>}{register && <><ProfileFields/><EmailCode api={API} role="doctor" email={email} value={emailCode} onChange={setEmailCode}/></>}
        {!register && <div className="care-login-options"><button type="button" className="care-forgot-link" onClick={() => setForgotPasswordOpen(true)}>Forgot password?</button></div>}
        <button className="care-login-submit" disabled={busy}>{busy ? "Please wait." : register ? "Create account" : "Log in as Doctor"}</button>
        </div>
        <p className="care-login-switch">{register ? "Already have an account?" : "New to MediCall?"} <button type="button" onClick={()=>{setRegister(!register);setMessage("");setError("");setForgotPasswordOpen(false);}}>{register ? "Sign in" : "Create an account"}</button></p>
        <button type="button" onClick={onExit} className="care-plans-link">Back to patient website</button>
      </form>
      {forgotPasswordOpen && <ForgotPasswordPanel apiUrl={API} role="doctor" initialEmail={email} onBack={() => setForgotPasswordOpen(false)} />}
      </div>
    </main>
  );

  if (!doctor.clinicId) return <JoinClinic api={API} token={token} doctor={doctor} refresh={loadPortal} logout={logout}/>;
  return (
    <div className="doctor-portal-layout">
      <aside className="doctor-portal-sidebar" aria-label="Doctor portal navigation">
        <div className="doctor-sidebar-brand"><span className="doctor-sidebar-mark">+</span><span><strong>MediCall AI</strong><small>{doctor.clinicName || "DOCTOR PORTAL"}</small></span></div>
        <p className="doctor-sidebar-label">WORKSPACE</p>
        <nav className="doctor-sidebar-nav">
          {doctorSections.map(([key,label]) => <button key={key} type="button" aria-current={activeSection === key ? "page" : undefined} className={activeSection === key ? "is-active" : ""} onClick={() => navigateToSection(key)}>{label}</button>)}
        </nav>
        <div className="doctor-sidebar-profile"><span>{(doctor.name || "D").trim().charAt(0).toUpperCase()}</span><div><strong>{doctor.name}</strong><small>{doctor.specialization || "Doctor"}</small></div></div>
        <button type="button" className="doctor-sidebar-logout" onClick={logout}>↗ <span>Log out</span></button>
      </aside>
      <div className="doctor-portal-content">
        <PortalNavigation role="Doctor" value={activeSection} sections={doctorSections}
            onChange={navigateToSection} />
    <main className="doctor-dashboard mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {activeSection !== "overview" && <header className="doctor-page-heading"><p>{doctor.clinicName || "Doctor portal"}</p><h1>{doctorSections.find(([key]) => key === activeSection)[1]}</h1></header>}
      {activeSection === "overview" && <section id="doctor-overview" className="doctor-welcome">
        <div>{doctor.clinicName && <p className="doctor-welcome-clinic">{doctor.clinicName}</p>}
          <h1>Welcome, {doctor.name}</h1>
          <p>{[doctor.specialization, doctor.email].filter(Boolean).join(" · ")}</p>
        </div><div className="doctor-welcome-actions"><button type="button" onClick={() => loadPortal().catch((err) => setError(err.response?.data?.message || "Could not refresh your workspace."))}>Refresh</button><button type="button" onClick={logout}>Log out</button></div>
      </section>}
      {activeSection === "settings" && <div className="doctor-settings-stack"><section className="doctor-profile-card"><h2>Professional profile</h2><p>{doctor.name} · {doctor.specialization}</p>
      <EditDoctor api={API} profile={doctor} save={async fields=>{await doctorApi.patch("/doctor/profile",fields);await loadPortal();}}/>
      </section><details id="doctor-settings" className="doctor-password-settings mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-bold text-slate-800">Change my doctor portal password</summary>
        <div className="mt-4"><ChangePasswordPanel apiUrl={API} token={token} role="doctor" onChanged={() => { logout(); setError("Password changed. Sign in again using your new password."); }} /></div>
      </details></div>}
      {activeSection === "video" && <div id="doctor-video-visits" className="doctor-video-panel"><VideoRequests role="doctor" apiUrl={API} token={token} onBooked={()=>loadPortal()}/></div>}

      {message && <p role="status" className="portal-message">{message}</p>}
      {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {activeSection === "overview" && <><section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:"Today",value:todayAppointments.length,view:"today"},
          {label:"Tomorrow",value:tomorrowAppointments.length,view:"tomorrow"},
          {label:"Scheduled later",value:scheduledLater.length,view:"later"},
          {label:"Completed",value:completedAppointments.length,view:"completed"},
        ].map((x) => <button type="button" key={x.label} onClick={()=>{setAppointmentView(x.view); navigateToSection("appointments");}} className={`doctor-summary-card rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${appointmentView===x.view?"border-blue-400 ring-2 ring-blue-50":"border-slate-200"}`}><p className="text-xs font-semibold text-slate-500">{x.label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{x.value}</p></button>)}
      </section><PlatformReview api={API} role="doctor" token={token}/></>}
      {activeSection === "appointments" && <section id="doctor-appointments" className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">My patient appointments</h2><p className="mt-1 text-sm text-slate-500">Choose a schedule or visit status to focus on the right patients.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{filteredAppointments.length} shown · {appointments.length} total</span></div>
          <div className="mt-4 flex flex-wrap gap-2">{[["upcoming","Upcoming"],["today","Today"],["tomorrow","Tomorrow"],["later","Later"],["completed","Completed"],["cancelled","Cancelled"],["all","All"]].map(([value,label])=><button key={value} onClick={()=>setAppointmentView(value)} className={`rounded-full border px-3 py-2 text-xs font-bold ${appointmentView===value?"border-slate-700 bg-slate-800 text-white":"border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}</div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <div className="flex gap-2"><button type="button" onClick={() => setCalendarMode(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">List view</button><button type="button" onClick={() => setCalendarMode(true)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Calendar view</button></div>
        </div>
        {calendarMode && <AppointmentCalendar appointments={filteredAppointments} getTitle={(item) => item.patientName || "Patient"} onOpen={openPatientFile} />}
        {!calendarMode && <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Patient</th><th className="p-4">Phone</th><th className="p-4">Date</th><th className="p-4">Time</th><th className="p-4">Status</th><th className="p-4">Consultation</th><th className="p-4">Patient file</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredAppointments.map(a => <tr key={a._id}><td className="p-4 font-semibold">{a.patientName}</td><td className="p-4">{a.phone}</td><td className="p-4">{a.date}</td><td className="p-4">{a.time}</td><td className="p-4"><span className="visit-status" data-status={a.status}>{a.status}</span></td><td className="p-4">{a.status === "Confirmed" && a.videoRoomId ? <a href={"https://meet.jit.si/" + a.videoRoomId} target="_blank" rel="noreferrer" className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">Join video visit ↗</a> : <span className="text-xs text-slate-400">—</span>}</td><td className="p-4"><button type="button" onClick={() => openPatientFile(a)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Open file</button></td></tr>)}{!filteredAppointments.length && <tr><td colSpan="7" className="p-10 text-center text-slate-500">No appointments in this view. Try another schedule filter.</td></tr>}</tbody></table></div>}
      </section>}
      {activeSection === "files" && !selectedAppointment && <section className="doctor-profile-card"><h2>Patient files by appointment</h2>{appointments.map(a => <button className="doctor-file-row" key={a._id} onClick={() => openPatientFile(a)}><strong>{a.patientName}</strong><span>{a.date} · {a.time}</span></button>)}{!appointments.length && <p>Patient files appear here after an appointment is booked.</p>}</section>}
      {activeSection === "files" && selectedAppointment && <section id="doctor-patient-file" className="mb-7 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-teal-50 p-5">
          <div><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Patient file · {selectedAppointment.date} at {selectedAppointment.time}</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{selectedAppointment.patientName}</h2><p className="mt-1 text-sm text-slate-600">{selectedAppointment.patientEmail || "Email not provided"} · {selectedAppointment.phone}</p></div>
          <button type="button" onClick={() => setSelectedAppointment(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">Close</button>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[.8fr_1.2fr]">
          <div><h3 className="font-bold text-slate-900">Previous appointments in this doctor workspace</h3><p className="mt-1 text-xs text-slate-500">Only appointments visible to this doctor are shown.</p><div className="mt-3 space-y-2">{appointments.filter((a)=>a.patientEmail && a.patientEmail.toLowerCase()===String(selectedAppointment.patientEmail||"").toLowerCase() && a._id!==selectedAppointment._id).sort((a,b)=>b.date.localeCompare(a.date)).map((a)=><div key={a._id} className="rounded-xl border border-slate-100 p-3"><p className="text-sm font-semibold text-slate-800">{a.date} · {a.time}</p><p className="mt-1 text-xs text-slate-500">{a.reason || "No visit reason recorded"} · {a.status}</p></div>)}{!appointments.some((a)=>a.patientEmail && a.patientEmail.toLowerCase()===String(selectedAppointment.patientEmail||"").toLowerCase() && a._id!==selectedAppointment._id)&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No previous appointments found in this doctor workspace.</p>}</div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">This is appointment history only; it is not a verified medical history or allergy record.</p></div>
          <form onSubmit={saveClinicalNote} className="space-y-3">
            {previousVisits.length > 0 && <details><summary>Previous consultations with this patient</summary><ul>{previousVisits.map(v => <li key={v._id}>{new Date(v.updatedAt).toLocaleDateString()} · {v.diagnosis || "Consultation recorded"}</li>)}</ul></details>}
            <div><h3 className="font-bold text-slate-900">Consultation notes & prescription</h3><p className="mt-1 text-xs text-slate-500">Enter the clinical assessment and treatment prescribed by you.</p></div>
            {[[ "symptoms","Symptoms / patient concerns","Describe reported symptoms." ],[ "diagnosis","Clinical assessment / diagnosis","Doctor-entered assessment." ],[ "treatmentPlan","Treatment plan","Advice, tests or treatment plan." ],[ "doctorNotes","Doctor notes","Additional clinical workflow notes." ]].map(([key,label,placeholder])=><label key={key} className="block text-xs font-bold text-slate-600">{label}<textarea className={input+" mt-1 min-h-20"} value={clinicalNote[key]} onChange={(e)=>setClinicalNote({...clinicalNote,[key]:e.target.value})} placeholder={placeholder}/></label>)}
            <label className="block text-xs font-bold text-slate-600">Prescription medicines (one per line: Medicine | Dosage | Duration | Instructions)<textarea className={input+" mt-1 min-h-24"} value={clinicalNote.medicinesText} onChange={(e)=>setClinicalNote({...clinicalNote,medicinesText:e.target.value})} placeholder="Medicine name | 1 tablet | 5 days | After food"/></label>
            <label className="block text-xs font-bold text-slate-600">Follow-up date<input type="date" className={input+" mt-1"} value={clinicalNote.followUpDate} onChange={(e)=>setClinicalNote({...clinicalNote,followUpDate:e.target.value})}/></label>
            <div className="flex flex-wrap gap-2"><button disabled={noteBusy} className={btn}>{noteBusy?"Saving…":"Save consultation & prescription"}</button><button type="button" onClick={() => window.print()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">Print / Save PDF</button></div>
            <div className="doctor-prescription-print">
              <h1>MediCall AI · Prescription</h1>
              <p>Patient: {selectedAppointment.patientName}</p><p>Appointment: {selectedAppointment.date} · {selectedAppointment.time}</p>
              <p>Doctor: {doctor.name} · {doctor.specialization}</p>
              <hr/><h2>Clinical assessment</h2><p>{clinicalNote.diagnosis || "—"}</p>
              <h2>Treatment plan</h2><p>{clinicalNote.treatmentPlan || "—"}</p>
              <h2>Medicines</h2><pre>{clinicalNote.medicinesText || "No medicines entered"}</pre>
              <p>Follow-up: {clinicalNote.followUpDate || "As advised"}</p>
              <p className="print-disclaimer">This document is prepared from the information entered by the treating doctor. Verify details and sign before issuing to the patient.</p>
            </div>
            <p className="text-[11px] text-slate-400">Saved to this doctor's secure workspace. Verify clinical details before saving.</p>
          </form>
        </div>
      </section>}
      {activeSection === "availability" && <section id="doctor-availability" className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <form onSubmit={submitAvailability} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><h2 className="text-lg font-bold">Submit availability</h2><p className="mt-1 text-sm text-slate-500">Publishing replaces your hours for this weekday. Patients can book free slots within those hours while the clinic is open.</p></div>
          <label className="block text-sm font-semibold">Day<select className={`${input} mt-2`} value={form.dayOfWeek} onChange={e => setForm({...form,dayOfWeek:e.target.value})}>{DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Start time<input className={`${input} mt-2`} type="time" required value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></label><label className="text-sm font-semibold">End time<input className={`${input} mt-2`} type="time" required value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></label></div>
          <label className="block text-sm font-semibold">Appointment slot duration<select className={`${input} mt-2`} value={form.slotMinutes} onChange={e=>setForm({...form,slotMinutes:e.target.value})}><option value="15">15 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
          <button className={`${btn} w-full`} disabled={busy}>Publish availability</button>
        </form>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">My availability requests</h2><div className="mt-4 space-y-3">{availability.map(a=><div key={a._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div><p className="font-semibold">{DAYS[a.dayOfWeek]} · {a.startTime}–{a.endTime}</p><p className="mt-1 text-xs text-slate-500">{a.slotMinutes}-minute slots · {a.approved ? "Published" : "Awaiting clinic approval"}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{a.approved ? "Approved" : "Pending"}</span>{!a.approved && <button onClick={()=>removeAvailability(a._id)} className="text-xs font-semibold text-rose-600">Remove</button>}</div></div>)}{!availability.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No availability submitted yet.</p>}</div></div>
      </section>}
    </main>
      </div>
    </div>
  );
}

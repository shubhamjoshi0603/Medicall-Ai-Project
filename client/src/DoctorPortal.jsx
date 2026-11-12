import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-50";
const btn = "rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50";

export default function DoctorPortal({ onExit }) {
  const [token, setToken] = useState(() => localStorage.getItem("medicall_doctor_token") || "");
  const [doctor, setDoctor] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [form, setForm] = useState({ dayOfWeek: "1", startTime: "09:00", endTime: "17:00", slotMinutes: "30" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const doctorApi = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${token}` } });

  async function loadPortal(authToken = token) {
    const headers = { Authorization: `Bearer ${authToken}` };
    const [me, appts, slots] = await Promise.all([
      axios.get(`${API}/doctor/me`, { headers }),
      axios.get(`${API}/doctor/appointments`, { headers }),
      axios.get(`${API}/doctor/availability`, { headers }),
    ]);
    setDoctor(me.data.doctor);
    setAppointments(appts.data);
    setAvailability(slots.data);
  }

  useEffect(() => {
    if (!token) return;
    loadPortal().catch((err) => {
      localStorage.removeItem("medicall_doctor_token"); setToken("");
      setError(err.response?.data?.message || "Doctor session expired. Please sign in again.");
    });
  }, [token]);

  async function login(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const { data } = await axios.post(`${API}/doctor-auth/login`, { email, password });
      localStorage.setItem("medicall_doctor_token", data.token); setToken(data.token); setDoctor(data.doctor);
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

  function logout() {
    localStorage.removeItem("medicall_doctor_token"); setToken(""); setDoctor(null); setAppointments([]); setAvailability([]);
  }

  if (!token || !doctor) return (
    <main className="mx-auto grid min-h-[75vh] max-w-5xl items-center px-4 py-12 md:grid-cols-2 md:gap-10">
      <section className="hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-950 to-teal-700 p-10 text-white md:block">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-teal-200">MEDICALL AI · DOCTOR PORTAL</p>
        <h1 className="mt-5 text-4xl font-black">Your clinic. Your schedule. Your patients.</h1>
        <p className="mt-4 leading-7 text-teal-50/80">Sign in to view appointments assigned to you and submit your weekly availability to the clinic.</p>
      </section>
      <form onSubmit={login} className="mx-auto w-full max-w-md space-y-5 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl">
        <div><p className="text-xs font-extrabold uppercase tracking-widest text-teal-700">Doctor access</p><h2 className="mt-2 text-3xl font-black text-slate-950">Doctor login</h2><p className="mt-2 text-sm text-slate-500">Use the email and temporary password provided by your clinic admin.</p></div>
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <label className="block text-sm font-semibold">Email address<input className={`${input} mt-2`} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="doctor@clinic.com" /></label>
        <label className="block text-sm font-semibold">Password<input className={`${input} mt-2`} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /></label>
        <button className={`${btn} w-full`} disabled={busy}>{busy ? "Signing in…" : "Sign in to doctor portal"}</button>
        <button type="button" onClick={onExit} className="w-full text-sm font-semibold text-slate-500">← Back to patient website</button>
      </form>
    </main>
  );

  const upcoming = appointments.filter(a => a.status === "Confirmed");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Doctor workspace</p><h1 className="mt-1 text-3xl font-black text-slate-950">Welcome, {doctor.name}</h1><p className="mt-1 text-sm text-slate-500">{doctor.specialization} · {doctor.email}</p></div>
        <button onClick={logout} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Log out</button>
      </div>
      {message && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <section className="mb-7 grid gap-4 sm:grid-cols-3">
        {[{label:"Total appointments",value:appointments.length},{label:"Upcoming confirmed",value:upcoming.length},{label:"Availability requests",value:availability.length}].map(x => <article key={x.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{x.label}</p><p className="mt-2 text-4xl font-black">{x.value}</p></article>)}
      </section>
      <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-bold">My patient appointments</h2><p className="mt-1 text-sm text-slate-500">Only appointments assigned to your doctor account are shown.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Patient</th><th className="p-4">Phone</th><th className="p-4">Date</th><th className="p-4">Time</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{appointments.map(a => <tr key={a._id}><td className="p-4 font-semibold">{a.patientName}</td><td className="p-4">{a.phone}</td><td className="p-4">{a.date}</td><td className="p-4">{a.time}</td><td className="p-4">{a.status}</td></tr>)}{!appointments.length && <tr><td colSpan="5" className="p-10 text-center text-slate-500">No appointments assigned yet.</td></tr>}</tbody></table></div>
      </section>
      <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <form onSubmit={submitAvailability} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><h2 className="text-lg font-bold">Submit availability</h2><p className="mt-1 text-sm text-slate-500">Your clinic admin must approve a schedule before it is used for patient bookings.</p></div>
          <label className="block text-sm font-semibold">Day<select className={`${input} mt-2`} value={form.dayOfWeek} onChange={e => setForm({...form,dayOfWeek:e.target.value})}>{DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Start time<input className={`${input} mt-2`} type="time" required value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></label><label className="text-sm font-semibold">End time<input className={`${input} mt-2`} type="time" required value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></label></div>
          <label className="block text-sm font-semibold">Appointment slot duration<select className={`${input} mt-2`} value={form.slotMinutes} onChange={e=>setForm({...form,slotMinutes:e.target.value})}><option value="15">15 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
          <button className={`${btn} w-full`} disabled={busy}>Submit for clinic approval</button>
        </form>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">My availability requests</h2><div className="mt-4 space-y-3">{availability.map(a=><div key={a._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div><p className="font-semibold">{DAYS[a.dayOfWeek]} · {a.startTime}–{a.endTime}</p><p className="mt-1 text-xs text-slate-500">{a.slotMinutes}-minute slots · {a.approved ? "Approved by clinic" : "Awaiting clinic approval"}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{a.approved ? "Approved" : "Pending"}</span>{!a.approved && <button onClick={()=>removeAvailability(a._id)} className="text-xs font-semibold text-rose-600">Remove</button>}</div></div>)}{!availability.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No availability submitted yet.</p>}</div></div>
      </section>
    </main>
  );
}
import { useState } from "react";
import { SlotOptions } from "./SchedulingTools.jsx";

export default function OfflineBooking({ api, apiUrl, clinicId, doctors, today, onSaved }) {
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const field = "block w-full rounded-lg border p-2";

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setMessage("");
    try {
      const { data } = await api.post("/appointments/offline", values);
      form.reset();
      setDoctorId("");
      setDate(today);
      setMessage(data.message + " Booking ID: " + data.appointment.bookingReference);
      await onSaved();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not confirm the booking. Check the schedule before retrying.");
      setRevision(value => value + 1);
    } finally {
      setBusy(false);
    }
  }

  return <details className="border-b p-5">
    <summary className="cursor-pointer font-bold">Add offline appointment</summary>
    <form onSubmit={submit} className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <label>Patient name<input required name="patientName" className={field} /></label>
      <label>Phone<input required type="tel" name="phone" className={field} /></label>
      <label>Email (optional)<input type="email" name="patientEmail" className={field} /></label>
      <label>Doctor<select required name="doctorId" className={field} value={doctorId} onChange={e => setDoctorId(e.target.value)}>
        <option value="">Choose a doctor</option>
        {doctors.filter(d => d.isActive).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
      </select></label>
      <label>Date<input required type="date" min={today} name="date" className={field} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Time<select required name="time" className={field} key={[doctorId,date,revision].join("/")}>
        <SlotOptions apiUrl={apiUrl} clinicId={clinicId} doctorId={doctorId} date={date} />
      </select></label>
      <button disabled={busy} className="rounded-lg bg-blue-700 p-2 font-bold text-white">{busy ? "Saving…" : "Confirm offline booking"}</button>
    </form>
    <p role="status" className="mt-2 text-sm">{message}</p>
  </details>;
}

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

function displayDate(value, options = { dateStyle: "medium" }) {
  if (!value) return "Date not available";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Date not available" : date.toLocaleDateString("en-IN", options);
}

function saveBlob(response, filename) {
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "medical-document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CareTimeline({ apiUrl, token }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const config = { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal };
    Promise.all([
      axios.get(`${apiUrl}/patient/appointments`, config),
      axios.get(`${apiUrl}/patient/records`, config),
      axios.get(`${apiUrl}/patient/clinic-updates`, config),
      axios.get(`${apiUrl}/patient/prescriptions`, config),
    ]).then(([appointments, records, clinicUpdates, prescriptions]) => {
      setError("");
      setHistory({ appointments: appointments.data, records: records.data, clinicUpdates: clinicUpdates.data, prescriptions: prescriptions.data });
    }).catch((requestError) => {
      if (!controller.signal.aborted) setError(requestError.response?.data?.message || "Could not load your care history. Please try again.");
    });
    return () => controller.abort();
  }, [apiUrl, token, reloadKey]);

  const timeline = useMemo(() => {
    if (!history) return [];
    const appointments = (history.appointments || []).map((appointment) => ({
      kind: "appointment",
      id: `appointment-${appointment._id}`,
      date: appointment.date,
      time: appointment.time,
      appointment,
    }));
    const appointmentIds = new Set((history.appointments || []).map((item) => String(item._id)));
    const records = (history.records || []).filter((record) => !record.appointmentId || !appointmentIds.has(String(record.appointmentId._id || record.appointmentId)))
      .map((record) => ({ kind: "record", id: `record-${record._id}`, date: record.createdAt, record }));
    const updates = (history.clinicUpdates || []).filter((update) => !update.appointmentId || !appointmentIds.has(String(update.appointmentId._id || update.appointmentId)))
      .map((update) => ({ kind: "update", id: `update-${update._id}`, date: update.createdAt, update }));
    return [...appointments, ...records, ...updates].sort((a, b) => {
      const dateA = new Date(`${String(a.date || "").slice(0, 10)}T${a.time || "12:00"}`);
      const dateB = new Date(`${String(b.date || "").slice(0, 10)}T${b.time || "12:00"}`);
      return dateB - dateA;
    });
  }, [history]);

  async function download(kind, item) {
    const key = `${kind}-${item._id}`;
    setDownloading(key);
    try {
      const path = kind === "record" ? `patient/records/${item._id}/download` : `patient/clinic-updates/${item._id}/download`;
      const response = await axios.get(`${apiUrl}/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      saveBlob(response, item.fileName);
    } catch {
      setError("That document could not be downloaded. Please refresh and try again.");
    } finally {
      setDownloading("");
    }
  }

  function documentCard(kind, item, compact = false) {
    const clinicShared = kind === "update";
    const label = clinicShared ? item.category || "Clinic update" : item.category || "Medical record";
    return <article key={`${kind}-${item._id}`} className={`care-history-document ${compact ? "is-compact" : ""}`}>
      <div className="care-history-document-icon" aria-hidden="true">{clinicShared ? "C" : "R"}</div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-900">{item.title}</p>
        <p className="mt-1 text-xs text-slate-600">{label}{clinicShared ? ` · Shared by ${item.clinicId?.clinicName || "your clinic"}` : item.familyMemberId?.fullName ? ` · For ${item.familyMemberId.fullName}` : " · For you"}</p>
        {item.message && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.message}</p>}
      </div>
      {item.fileName && <button type="button" onClick={() => download(kind, item)} disabled={Boolean(downloading)} className="care-history-download">{downloading === `${kind}-${item._id}` ? "Downloading…" : "Download"}</button>}
    </article>;
  }

  if (!history && !error) return <section className="care-history-panel" aria-live="polite"><p>Loading your private care history…</p></section>;

  return <section className="care-history-panel" aria-labelledby="care-history-title">
    <div className="care-history-heading">
      <div><p className="care-history-eyebrow">YOUR CARE, IN ONE PLACE</p><h2 id="care-history-title">Follow-up history</h2><p>Visits, prescriptions, follow-up dates and reports connected to your care.</p></div>
      <div className="flex items-center gap-2"><div className="care-history-private"><span aria-hidden="true">✓</span> Private to your account</div><button type="button" className="care-history-refresh" onClick={() => { setHistory(null); setError(""); setReloadKey((value) => value + 1); }}>Refresh</button></div>
    </div>
    <div className="care-history-consent" role="note">Your uploaded files are private to your patient account. Clinic reports appear here only after a clinic shares them with your account.</div>
    {error && <p role="alert" className="care-history-error">{error} <button type="button" onClick={() => { setHistory(null); setError(""); setReloadKey((value) => value + 1); }}>Try again</button></p>}
    {!timeline.length && !error ? <div className="care-history-empty"><span aria-hidden="true">✦</span><h3>Your care history will build here</h3><p>Appointments, prescriptions, linked records and clinic-shared reports will appear together after your first visit.</p></div> : <div className="care-history-list">
      {timeline.map((entry) => {
        if (entry.kind === "record") return <div key={entry.id} className="care-history-entry"><div className="care-history-date">{displayDate(entry.date)}</div>{documentCard("record", entry.record)}</div>;
        if (entry.kind === "update") return <div key={entry.id} className="care-history-entry"><div className="care-history-date">{displayDate(entry.date)}</div>{documentCard("update", entry.update)}</div>;
        const appointment = entry.appointment;
        const note = (history.prescriptions || []).find((item) => String(item.appointmentId?._id || item.appointmentId || "") === String(appointment._id));
        const attachedRecords = (history.records || []).filter((item) => String(item.appointmentId?._id || item.appointmentId || "") === String(appointment._id));
        const attachedUpdates = (history.clinicUpdates || []).filter((item) => String(item.appointmentId?._id || item.appointmentId || "") === String(appointment._id));
        return <article key={entry.id} className="care-history-entry">
          <div className="care-history-date">{displayDate(appointment.date)}{appointment.time ? ` · ${appointment.time}` : ""}</div>
          <div className="care-history-visit">
            <div className="care-history-visit-top"><div><span className="care-history-visit-label">{appointment.status === "Completed" ? "Completed visit" : appointment.status === "Cancelled" ? "Cancelled visit" : "Appointment"}</span><h3>{appointment.doctorId?.name || "Clinic visit"}</h3><p>{appointment.doctorId?.specialization || "Care appointment"} · {appointment.clinicId?.clinicName || "Clinic"}</p></div><span className={`care-history-status status-${String(appointment.status || "").toLowerCase()}`}>{appointment.status}</span></div>
            {appointment.bookingReference && <p className="care-history-reference">Booking reference: {appointment.bookingReference}</p>}
            {note && <div className="care-history-note"><h4>Prescription & follow-up</h4>
              {note.medicines?.length > 0 && <div><strong>Prescription</strong><ul>{note.medicines.map((medicine) => <li key={medicine._id || medicine.name}><span className="font-semibold">{medicine.name}</span>{[medicine.dosage, medicine.duration, medicine.instructions].filter(Boolean).length > 0 && ` · ${[medicine.dosage, medicine.duration, medicine.instructions].filter(Boolean).join(" · ")}`}</li>)}</ul></div>}
              {note.followUpDate && <p className="care-history-followup">Follow-up suggested: {displayDate(note.followUpDate)}</p>}
            </div>}
            {!note && appointment.status === "Completed" && <p className="care-history-no-note">No prescription or follow-up has been added for this visit.</p>}
            {(attachedRecords.length > 0 || attachedUpdates.length > 0) && <div className="care-history-documents">{attachedRecords.map((item) => documentCard("record", item, true))}{attachedUpdates.map((item) => documentCard("update", item, true))}</div>}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}

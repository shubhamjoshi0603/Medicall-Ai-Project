import { useEffect, useState } from "react";
import axios from "axios";

export default function Prescriptions({ apiUrl, token }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    axios.get(apiUrl + "/patient/prescriptions", { headers: { Authorization: "Bearer " + token }, signal: controller.signal })
      .then(r => setRows(r.data)).catch(() => { if (!controller.signal.aborted) setError("Could not load prescriptions."); });
    return () => controller.abort();
  }, [apiUrl, token]);
  return <section className="workspace-panel"><h3>Digital prescriptions</h3>
    {error ? <p role="alert">{error}</p> : !rows ? <p>Loading prescriptions…</p> : !rows.length ? <p>Prescriptions from completed visits will appear here.</p> :
      rows.map(row => <article key={row._id}><h4>{row.doctorId?.name || "Doctor"} · {row.appointmentId?.date}</h4><p>{row.clinicId?.clinicName}</p>
        <ul>{row.medicines.map(m => <li key={m._id}><strong>{m.name}</strong><span>{[m.dosage,m.duration,m.instructions].filter(Boolean).join(" · ")}</span></li>)}</ul>
        {row.followUpDate && <p>Follow-up · {row.followUpDate}</p>}</article>)}</section>;
}

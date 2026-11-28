import { useState } from "react";

export default function ClinicInsights({ appointments, downloadCsv }) {
  const [days, setDays] = useState(7);
  const today = new Date();
  const since = new Date(today); since.setDate(today.getDate() - days + 1);
  const key = date => date.toLocaleDateString("en-CA");
  const period = appointments.filter(a => a.date >= key(since) && a.date <= key(today));
  const counts = new Map();
  for (const row of period) {
    const specialty = row.doctorId?.specialization || "Unspecified specialty";
    counts.set(specialty, (counts.get(specialty) || 0) + 1);
  }
  const metrics = [
    ["Visits", period.length],
    ["Patients", new Set(period.map(a => a.patientEmail?.toLowerCase()).filter(Boolean)).size],
    ["Cancellations", period.filter(a => a.status === "Cancelled").length],
    ["Collected for these visits (INR)", period.filter(a => a.paymentStatus === "Paid").reduce((n,a) => n + Number(a.paymentAmount || 0), 0)],
  ];
  return <section className="workspace-panel"><header><h3>Clinic activity report</h3><label>Period<select value={days} onChange={e => setDays(+e.target.value)}>
    <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></label></header>
    <div className="insight-tiles">{metrics.map(([name,value]) => <div key={name}><small>{name}</small><strong>{value.toLocaleString("en-IN")}</strong></div>)}</div>
    <h4>Visits by specialty</h4>{!period.length && <p>No visits in this period.</p>}
    {[...counts].sort((a,b) => b[1]-a[1]).map(([name,n]) => <label className="specialty-bar" key={name}>{name}<progress max={period.length} value={n} />{n}</label>)}
    <button onClick={() => downloadCsv("clinic-activity-" + days + "d.csv",[["Period start",key(since)],["Period end",key(today)],...metrics,["Specialty","Visits"],...[...counts]])}>Download report</button>
  </section>;
}

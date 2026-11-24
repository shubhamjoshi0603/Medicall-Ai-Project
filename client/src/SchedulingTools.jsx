import { useCallback, useEffect, useState } from "react";
import axios from "axios";

export function SlotOptions({ apiUrl, clinicId, doctorId, date }) {
  const [snapshot, setSnapshot] = useState(null);
  const key = [clinicId, doctorId, date].join("/");
  useEffect(() => {
    if (!clinicId || !doctorId || !date) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const { data } = await axios.get(apiUrl + "/public/slots", { params: { clinicId, doctorId, date }, signal: controller.signal });
        if (!controller.signal.aborted) setSnapshot({ key, data });
      } catch { if (!controller.signal.aborted) setSnapshot({ key, error: true }); }
    }
    refresh(); const timer = setInterval(refresh, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [apiUrl, clinicId, doctorId, date, key]);
  if (!clinicId || !doctorId || !date) return <option value="">Choose doctor and date first</option>;
  if (snapshot?.key !== key) return <option value="">Loading slots…</option>;
  if (snapshot.error) return <option value="">Availability unavailable</option>;
  return <><option value="">{snapshot.data.length ? "Choose a time" : "No available slots"}</option>
    {snapshot.data.map(time => <option key={time}>{time}</option>)}</>;
}

export function LeavePanel({ apiUrl, token, role }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = apiUrl + "/" + role + "/leave";
  const load = useCallback(async signal => {
    const { data } = await axios.get(url, { headers: { Authorization: "Bearer " + token }, signal });
    if (!signal?.aborted) setRows(data);
  }, [token, url]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => load(controller.signal)).catch(() => { if (!controller.signal.aborted) setError("Could not load leave requests."); });
    return () => controller.abort();
  }, [load]);
  async function mutate(id, body) {
    setBusy(true); setError("");
    try {
      await axios({ method: id ? "patch" : "post", url: id ? url + "/" + id : url, data: body, headers: { Authorization: "Bearer " + token } });
      await load(); return true;
    } catch (err) { setError(err.response?.data?.message || "Could not process leave request."); return false; }
    finally { setBusy(false); }
  }
  return <section className="workspace-panel"><h3>{role === "doctor" ? "My leave requests" : "Doctor leave approvals"}</h3>
    {role === "doctor" && <form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await mutate(null, Object.fromEntries(new FormData(form)))) form.reset(); }}>
      <label>From<input name="from" type="date" required /></label><label>Through<input name="through" type="date" required /></label>
      <label>Reason<input name="reason" required maxLength={200} /></label><button disabled={busy}>Request leave</button></form>}
    {error && <p role="alert">{error}</p>}
    {rows && !rows.length && <p>No leave requests.</p>}
    <ul>{rows?.map(r => <li key={r._id}><div><strong>{r.doctorId?.name || "Leave"} · {r.status}</strong><p>{r.from} to {r.through} · {r.reason}</p></div>
      {role === "clinic" && r.status === "Pending" && <footer>{["Approved","Declined"].map(status => <button key={status} disabled={busy} onClick={() => mutate(r._id,{ status })}>{status === "Approved" ? "Approve" : "Decline"}</button>)}</footer>}</li>)}</ul>
  </section>;
}

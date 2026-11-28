import { useCallback, useEffect, useState } from "react";
import axios from "axios";

function RequestStatus({ status }) {
  return <span className="visit-status" data-status={status}>{status}</span>;
}

export default function HomeLabs({ role, apiUrl, token, clinics = [], clinicId, phone }) {
  const patient = role === "patient";
  const url = apiUrl + "/" + role + "/home-labs";
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  function locate() {
    if (!navigator.geolocation) { setMessage("Location unavailable. Enter your collection address."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({coords}) => {
      setLocation({latitude:coords.latitude,longitude:coords.longitude}); setLocating(false); setMessage("");
    }, () => { setLocating(false); setMessage("Location unavailable. You can request collection using your address."); }, {timeout:10000});
  }
  const [busy, setBusy] = useState(false);
  const load = useCallback(async signal => {
    const response = await axios.get(url, {signal, headers:{Authorization:"Bearer " + token}});
    setData(response.data);
  }, [url, token]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => load(controller.signal)).catch(() => { if (!controller.signal.aborted) setMessage("Could not load requests. Select Refresh to retry."); });
    return () => controller.abort();
  }, [load]);
  async function save(event, id) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true); setMessage("");
    try {
      const headers = {Authorization:"Bearer " + token};
      const response = id ? await axios.patch(url + "/" + id, {...values, status:event.nativeEvent.submitter?.value}, {headers})
        : await axios.post(url,{...values,location},{headers});
      form.reset(); setLocation(null);
      setMessage(response.data.message);
      try { await load(); } catch { setMessage(response.data.message + " Refresh to update the list."); }
    } catch (err) { setMessage(err.response?.data?.message || "Could not save. Refresh to check the request."); }
    finally { setBusy(false); }
  }
  return <section className="workspace-panel lab-panel">
    <header><h2>Home lab tests</h2><button type="button" disabled={busy} onClick={() => load().catch(() => setMessage("Could not refresh requests."))}>Refresh</button></header>
    <p>{patient ? "Request a one-hour home collection window. Your clinic will confirm whether a collector is available." : "Review each request and confirm the collector’s availability before approving."}</p>
    {patient && data && <form onSubmit={save} className="lab-form">
      <label>Clinic<select required name="clinicId" defaultValue={clinicId || ""}><option value="">Choose clinic</option>{clinics.map(c => <option key={c._id} value={c._id}>{c.clinicName}</option>)}</select></label>
      <label>Test name<input name="test" list="lab-test-options" placeholder="Select or type a test" required maxLength={100}/><datalist id="lab-test-options">{data.tests.map(t => <option key={t} value={t}/>)}</datalist></label>
      <label>Preferred date<input type="date" required name="date" min={new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"})} /></label>
      <label>Collection start (IST)<select name="time" required><option value="">Choose time</option>{data.slots.map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Contact number<input type="tel" name="phone" defaultValue={phone} required maxLength={20} /></label>
      <label>Collection address<input name="address" autoComplete="street-address" required minLength={5} maxLength={400} /></label>
      <button type="button" disabled={busy || locating} onClick={location ? () => setLocation(null) : locate}>{location ? "Remove shared location" : locating ? "Finding location…" : "Share current location with clinic"}</button>
      <button disabled={busy || locating}>Request collection</button>
    </form>}
    <p role="status">{message}</p>
    <h3>{patient ? "Your requests" : "Collection requests"}</h3>
    {data && !data.rows.length && <p>No requests yet.</p>}
    {data?.rows.map(r => <article key={r._id} className="lab-request">
      <header><h4>{r.test}</h4><RequestStatus status={r.status}/></header>
      <p>{patient ? r.clinicId?.clinicName : r.patientId?.fullName} · {r.date} · {r.time} IST</p>
      <p>{r.address} · {r.phone}</p>
      {Number.isFinite(r.location?.latitude) && Number.isFinite(r.location?.longitude) && <a target="_blank" rel="noreferrer" href={"https://www.google.com/maps/search/?api=1&query="+r.location.latitude+","+r.location.longitude}>Open collection location</a>}
      {r.staff && <p>Assigned collector: {r.staff}</p>}{r.reason && <p>Clinic response: {r.reason}</p>}
      {!patient && r.status === "Requested" && <form onSubmit={event => save(event,r._id)}>
        <label>Available collector<input name="staff" maxLength={80} placeholder="Staff name for approval" /></label>
        <label>Reason for declining<input name="reason" maxLength={200} placeholder="Required to decline" /></label>
        <button value="Approved" disabled={busy}>Approve slot</button> <button value="Declined" disabled={busy}>Decline</button>
      </form>}
    </article>)}
  </section>;
}

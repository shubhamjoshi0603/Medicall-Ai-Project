import { useCallback, useEffect, useState } from "react";
import axios from "axios";

export default function LiveQueue({ apiUrl, token, role, onComplete }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const url = apiUrl + "/" + role + "/queue";
  const load = useCallback(async signal => {
    const result = await axios.get(url, { headers: { Authorization: "Bearer " + token }, signal });
    if (!signal?.aborted) setRows(result.data);
  }, [url, token]);
  useEffect(() => {
    const controller = new AbortController();
    async function poll() {
      try { await load(controller.signal); }
      catch { if (!controller.signal.aborted) setError("Queue unavailable. Retrying shortly."); }
    }
    poll();
    const interval = setInterval(poll, 15000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [load]);
  async function act(action, id) {
    setBusy(true); setError("");
    try {
      await axios.post(url, { action, id, reason }, { headers: { Authorization: "Bearer " + token } });
      setReason("");
      if (action === "complete") await onComplete?.();
    } catch (err) { setError(err.response?.data?.message || "Could not update the queue."); }
    finally { await load().catch(() => setError("Could not refresh the queue.")); setBusy(false); }
  }
  const current = rows?.find(row => ["Called", "Consulting"].includes(row.state));
  const next = rows?.find(row => row.state === "Waiting");
  return <section className="workspace-panel"><header><h3>Today's live queue</h3>
    {role === "doctor" && next && !current && <button disabled={busy} onClick={() => act("call", next.id)}>Call next · #{next.token}</button>}</header>
    {error && <p role="alert">{error}</p>}
    {rows === null ? <p>Loading queue…</p> : rows.length === 0 ? <p>No visits in your queue today.</p> :
      <ul>{rows.map(row => <li key={row.id || row.booking}><div><strong>#{row.token} · {row.name || row.time}</strong>
        <p>{row.state}{row.reason && " · " + row.reason}</p>
        {role === "patient" && <p>Serving {row.serving ? "#" + row.serving : "—"} · {row.ahead} ahead{row.estimate != null && " · About " + row.estimate + " min"}</p>}
      </div>{role === "doctor" && row.state === "Called" && <div><button disabled={busy} onClick={() => act("start", row.id)}>Start consultation</button>
        <label>Reason for skipping<input maxLength={200} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button disabled={busy || !reason.trim()} onClick={() => act("skip", row.id)}>Skip</button></div>}
      {role === "doctor" && row.state === "Consulting" && <button disabled={busy} onClick={() => act("complete", row.id)}>Complete visit</button>}</li>)}</ul>}
  </section>;
}

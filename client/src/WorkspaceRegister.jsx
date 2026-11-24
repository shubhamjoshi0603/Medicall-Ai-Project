import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const definitions = {
  staff: { title: "Staff directory", action: "staff member", route: "clinic/staff", fields: [
    ["name", "Full name"], ["role", "Staff role"], ["contact", "Contact", "text", false],
  ] },
  pharmacy: { title: "Pharmacy inventory", action: "batch", route: "clinic/pharmacy", fields: [
    ["medicine", "Medicine"], ["batch", "Batch number"], ["quantity", "Units in stock", "number"], ["expiry", "Expiry date", "date"],
  ] },
  history: { title: "Personal health history", action: "entry", route: "patient/history", fields: [
    ["category", "Category", ["Allergy", "Medication", "Vaccination", "Medical history"]], ["name", "Name or condition"],
    ["date", "Date", "date", false], ["note", "Details", "text", false],
  ] },
};

export default function WorkspaceRegister({ kind, apiUrl, token }) {
  const { title, action, route, fields } = definitions[kind];
  const blank = () => Object.fromEntries(fields.map(([key, , type]) => [key, Array.isArray(type) ? type[0] : ""]));
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const url = apiUrl + "/" + route;
  const load = useCallback(async (signal) => {
    const { data } = await axios.get(url, { headers: { Authorization: "Bearer " + token }, signal });
    if (!signal?.aborted) setRows(data);
  }, [url, token]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => load(controller.signal)).catch(() => { if (!controller.signal.aborted) setError("Could not load " + title.toLowerCase() + "."); });
    return () => controller.abort();
  }, [load, title]);
  async function save(event, remove = false) {
    event.preventDefault();
    if (busy || (remove && !window.confirm("Delete this " + action + "?"))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const config = { headers: { Authorization: "Bearer " + token } };
      if (remove) await axios.delete(url + "/" + draft._id, { ...config, params: { version: draft.__v } });
      else if (draft._id) await axios.put(url + "/" + draft._id, { ...draft, version: draft.__v }, config);
      else await axios.post(url, draft, config);
      setDraft(null); setNotice(remove ? "Record deleted." : "Changes saved.");
      await load();
    } catch (err) { setError(err.response?.data?.message || "Could not finish the request. Refresh to check your records."); }
    finally { setBusy(false); }
  }
  return <section className="workspace-panel">
    <header><h3>{title}</h3><button type="button" disabled={busy} onClick={() => { setDraft(blank()); setError(""); setNotice(""); }}>Add {action}</button></header>
    {error && <p role="alert">{error} <button onClick={() => load().then(() => setError("")).catch(() => setError("Refresh failed."))}>Refresh</button></p>}
    {notice && <p role="status">{notice}</p>}
    {draft && <form onSubmit={save}>
      {fields.map(([key, label, type = "text", required = true]) => <label key={key}>{label}
        {Array.isArray(type) ? <select value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })}>{type.map(x => <option key={x}>{x}</option>)}</select> :
          <input type={type} required={required} min={type === "number" ? 0 : undefined} max={type === "number" ? 10000000 : undefined}
            maxLength={key === "note" ? 1000 : 120} value={draft[key] ?? ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}
      </label>)}
      <footer><button disabled={busy}>Save</button><button type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
        {draft._id && <button type="button" disabled={busy} onClick={e => save(e, true)}>Delete</button>}</footer>
    </form>}
    {rows === null ? !error && <p role="status">Loading records…</p> : rows.length === 0 ? <p>No records yet.</p> :
      <ul>{rows.map(row => <li key={row._id}><div><strong>{row.name || row.medicine}</strong><p>{fields.filter(([key]) => !["name", "medicine"].includes(key) && row[key] !== "" && row[key] != null)
        .map(([key, label]) => label + ": " + row[key]).join(" · ")}</p></div><button disabled={busy} onClick={() => setDraft({ ...row })}>Edit</button></li>)}</ul>}
  </section>;
}

import { useState } from "react";
import axios from "axios";

export default function ReportReader({ apiUrl, records, token }) {
  const [id, setId] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [explainTerms, setExplainTerms] = useState(false);
  const [error, setError] = useState("");
  async function analyze(event) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await axios.post(apiUrl + "/patient/records/" + id + "/analysis", { explainTerms, ...(text.trim() && { reportText: text }) },
        { headers: { Authorization: "Bearer " + token } });
      setResult(response.data);
    } catch (err) { setError(err.response?.data?.message || "Could not analyze this report."); }
    finally { setBusy(false); }
  }
  function download() {
    const rows = result.rows.map(r => r.test + ": " + r.value + " " + r.unit + " | Reference " + r.lower + "–" + r.upper + " | " + r.flag);
    const blob = new Blob([[result.title, "Reported values", ...rows, "Check extracted numbers against the original document."].join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "report-summary.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="workspace-panel"><h3>Report analyzer</h3>
    <form onSubmit={analyze}><label>Uploaded document<select required disabled={busy} value={id} onChange={e => { setId(e.target.value); setResult(null); setText(""); }}>
      <option value="">Select a private report</option>{records.map(r => <option key={r._id} value={r._id}>{r.title}</option>)}</select></label>
      <details><summary>Use text copied from the report</summary><textarea aria-label="Report text" maxLength={50000} disabled={busy} value={text} onChange={e => setText(e.target.value)} /></details>
      <label><input type="checkbox" checked={explainTerms} onChange={e => setExplainTerms(e.target.checked)} />Send extracted test labels to the AI provider for terminology explanations</label>
      <button disabled={!id || busy}>{busy ? "Reading document…" : "Analyze report"}</button></form>
    {error && <p role="alert">{error}</p>}{result && <div><h4>Reported values</h4>
      <p>Each flag compares the extracted number with the limits printed on the same line. Check the numbers and units against the original report.</p>
      {result.rows.length ? <><ul>{result.rows.map((r,i) => <li key={i}><strong>{r.test}</strong><span>{r.value} {r.unit} · {r.flag} range ({r.lower}–{r.upper})</span></li>)}</ul>
        <button onClick={download}>Download summary</button></> : <p>No lines with a test, value, unit and numeric range could be matched.</p>}
      {result.glossary && <div><h4>AI glossary</h4><p className="whitespace-pre-wrap">{result.glossary}</p></div>}
      {result.glossaryError && <p role="status">{result.glossaryError}</p>}
      <details><summary>Review extracted text</summary><pre>{result.source}</pre></details></div>}
  </section>;
}

import { useState } from "react";
import axios from "axios";

export default function ReportReader({ apiUrl, records, token, onUploaded }) {
  const [id, setId] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summarize, setSummarize] = useState(false);
  const [explainTerms, setExplainTerms] = useState(false);
  const [error, setError] = useState("");
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setResult(null);
    if (file.size > 5 * 1024 * 1024) { setError("Choose a report smaller than 5 MB."); return; }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("title", file.name.slice(0, 120));
      body.append("category", "Lab report");
      const { data } = await axios.post(apiUrl + "/patient/records", body, { headers: { Authorization: "Bearer " + token } });
      onUploaded(data.record);
      setId(data.record._id);
      setText("");
      setResult(null);
      await readReport(data.record._id, "");
    } catch (err) { setError(err.response?.data?.message || "Could not upload the report."); }
    finally { setBusy(false); }
  }
  async function analyze(event) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try { await readReport(id, text); }
    finally { setBusy(false); }
  }
  async function readReport(recordId, content) {
    try {
      const response = await axios.post(apiUrl + "/patient/records/" + recordId + "/analysis", { explainTerms, summarize, ...(content.trim() && { reportText: content }) },
        { headers: { Authorization: "Bearer " + token } });
      setResult(response.data);
    } catch (err) { setError(err.response?.data?.message || "Could not analyze this report."); }
  }
  function download() {
    const rows = result.rows.map(r => r.test + ": " + r.value + " " + r.unit + " | Reference " + r.lower + "–" + r.upper + " | " + r.flag);
    const blob = new Blob([[result.title, result.summary || "", "Precautions and follow-up", ...(result.precautions?.length ? result.precautions : ["No specific precaution identified."]), "What to avoid", ...(result.avoid?.length ? result.avoid : ["No specific restriction identified."]), ...rows, "Check extracted numbers against the original document."].join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "report-summary.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="workspace-panel"><h3>Report analyzer</h3>
    <label><input type="checkbox" checked={summarize} disabled={busy} onChange={e => setSummarize(e.target.checked)} /> Include an AI plain-English summary (sends extracted report text to the AI provider).</label>
    <label className="block py-3 font-semibold">Upload report<input type="file" className="mt-2 block w-full file:mr-3 file:rounded-lg file:bg-teal-700 file:px-4 file:py-2 file:text-white" accept=".pdf,.jpg,.jpeg,.png" disabled={busy} onChange={upload} /><small>PDF, JPG or PNG up to 5 MB. Saved privately and analyzed immediately after upload.</small></label>
    <form onSubmit={analyze}><label>Uploaded document<select required disabled={busy} value={id} onChange={e => { setId(e.target.value); setResult(null); setText(""); }}>
      <option value="">Select a private report</option>{records.map(r => <option key={r._id} value={r._id}>{r.title}</option>)}</select></label>
      <details><summary>Use text copied from the report</summary><textarea aria-label="Report text" maxLength={50000} disabled={busy} value={text} onChange={e => setText(e.target.value)} /></details>

      <label><input type="checkbox" checked={explainTerms} onChange={e => setExplainTerms(e.target.checked)} />Send extracted test labels to the AI provider for terminology explanations</label>
      <button disabled={!id || busy}>{busy ? "Reading document…" : "Analyze report"}</button></form>
    {error && <p role="alert">{error}</p>}{result && <div>{result.summary && <section><h4>Report summary</h4><p className="whitespace-pre-wrap">{result.summary}</p><small>Check the summary against the original, especially if the report is handwritten.</small></section>}
      {result.summaryError && <p role="status">{result.summaryError}</p>}
      <h4>Precautions and follow-up</h4>
      {result.precautions?.length ? <ul>{result.precautions.map((line,i) => <li key={i}>{line}</li>)}</ul> : <p>No specific precaution was identified in the text. Ask your clinician what follow-up applies to you.</p>}
      <h4>What to avoid</h4>
      {result.avoid?.length ? <ul>{result.avoid.map((line,i) => <li key={i}>{line}</li>)}</ul> : <p>No specific restriction was identified. Confirm any medicine, activity or diet changes with your clinician.</p>}
      <h4>Reported values</h4>
      <p>Each flag compares the extracted number with the limits printed on the same line. Check the numbers and units against the original report.</p>
      {result.rows.length ? <><ul>{result.rows.map((r,i) => <li key={i}><strong>{r.test}</strong><span>{r.value} {r.unit} · {r.flag} range ({r.lower}–{r.upper})</span></li>)}</ul>
        </> : <p>No numeric lab ranges found.{!result.summary && !result.summaryError && " To summarize paragraphs, select the written report option and analyze again."}</p>}
      {(result.rows.length > 0 || result.summary) && <button onClick={download}>Download summary</button>}
      {result.glossary && <div><h4>AI glossary</h4><p className="whitespace-pre-wrap">{result.glossary}</p></div>}
      {result.glossaryError && <p role="status">{result.glossaryError}</p>}
      <details><summary>Review extracted text</summary><pre>{result.source}</pre></details></div>}
  </section>;
}

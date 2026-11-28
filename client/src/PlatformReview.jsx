import axios from "axios";
import { useEffect, useState } from "react";

const blank = { rating: "", comment: "", shared: false };

export function PublicReviews({ api }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    axios.get(api + "/platform-reviews/public", { signal: controller.signal })
      .then(({ data }) => setItems(data)).catch(() => {});
    return () => controller.abort();
  }, [api]);
  if (!items.length) return null;
  return <section className="care-community"><h2>What people say about MediCall</h2><div>{items.map(item =>
    <figure key={item._id}><strong>{item.rating} / 5</strong><blockquote>{item.comment}</blockquote><figcaption>{item.role} · Platform review</figcaption></figure>
  )}</div></section>;
}

function ReviewForm({ api, role, token }) {
  const url = api + "/platform-reviews/" + role + "/mine";
  const [draft, setDraft] = useState(blank);
  const [exists, setExists] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    axios.get(url, { headers: { Authorization: "Bearer " + token }, signal: controller.signal }).then(({ data }) => {
      setDraft(data || blank); setExists(Boolean(data)); setReady(true);
    }).catch(() => { if (!controller.signal.aborted) setMessage("Could not load your review. Reopen this panel to retry."); });
    return () => controller.abort();
  }, [url, token]);
  async function save(remove) {
    if (remove && !window.confirm("Delete your review?")) return;
    const config = { headers: { Authorization: "Bearer " + token } };
    setBusy(true);
    try {
      if (remove) { await axios.delete(url, config); setDraft(blank); }
      else await axios.put(url, draft, config);
      setExists(!remove);
      setMessage(remove ? "Review deleted." : draft.shared ? "Review shared on the home page." : "Your private review is saved.");
    } catch (error) { setMessage(error.response?.data?.message || "Could not save this change. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={e => { e.preventDefault(); save(false); }}><fieldset disabled={!ready || busy}>
    <legend>How was your experience using MediCall?</legend>
    <label>Platform rating<select required value={draft.rating} onChange={e => setDraft({ ...draft, rating: Number(e.target.value) })}><option value="">Choose a rating</option>{["Poor","Fair","Good","Very good","Excellent"].map((label,i) => <option key={label} value={i+1}>{i+1} — {label}</option>)}</select></label>
    <label>Your review<textarea required maxLength={600} rows={3} value={draft.comment} onChange={e => setDraft({ ...draft, comment: e.target.value })}/></label>
    <small>Leave out names, contact details and medical information.</small>
    <label><input type="checkbox" checked={draft.shared} onChange={e => setDraft({ ...draft, shared: e.target.checked })}/> Share on the home page under my role ({role})</label>
    <button disabled={!draft.comment.trim()}>Save review</button>{exists && <button type="button" onClick={() => save(true)}>Delete review</button>}
  </fieldset><p role="status">{message || (!ready && "Loading review…")}</p></form>;
}

export default function PlatformReview(props) {
  const [open, setOpen] = useState(false);
  return <section className="care-review"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Review MediCall <span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <ReviewForm {...props}/>}</section>;
}

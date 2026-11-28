import { useEffect, useState } from "react";
import axios from "axios";

const freeFeatures = [
  "Manage appointments and daily schedules",
  "Add doctors and clinic team accounts",
  "Patient records and visit history",
  "Record walk-in bookings and payments",
];
const proFeatures = [
  "Everything in the Free plan",
  "Download monthly appointment summary CSV",
  "Review completed visits and payments collected",
  "14-day Pro trial for eligible clinics",
];

function PlanCards({ plan, onChoose, busy, publicView = false }) {
  const price = plan?.price;
  const currentPlan = plan?.plan || "Free";
  return <div className="clinic-plan-grid">
    <article className={`clinic-plan-card ${!publicView && currentPlan === "Free" ? "is-current" : ""}`}>
      {!publicView && currentPlan === "Free" && <span className="clinic-plan-badge">Current plan</span>}
      <div className="clinic-plan-heading"><span className="clinic-plan-icon free">✦</span><div><p className="clinic-plan-eyebrow">For getting started</p><h3>Free</h3></div></div>
      <p className="clinic-plan-price">₹0 <span>forever</span></p>
      <p className="clinic-plan-description">The essentials to bring your clinic appointments and team into one workspace.</p>
      <ul>{freeFeatures.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
      {publicView ? <button type="button" className="clinic-plan-action secondary" onClick={onChoose}>Create a free clinic account</button> : <div className="clinic-plan-current">{currentPlan === "Free" ? "Your current plan" : "Included with Clinic Pro"}</div>}
    </article>
    <article className={`clinic-plan-card clinic-plan-pro ${currentPlan !== "Free" ? "is-current" : ""}`}>
      <span className="clinic-plan-badge pro-badge">More clinic insights</span>
      {currentPlan !== "Free" && <span className="clinic-plan-current-tag">{currentPlan === "Trial" ? "Trial active" : "Active"}</span>}
      <div className="clinic-plan-heading"><span className="clinic-plan-icon pro">✦</span><div><p className="clinic-plan-eyebrow">For growing clinics</p><h3>Clinic Pro</h3></div></div>
      <p className="clinic-plan-price">{price ? `₹${Number(price).toLocaleString("en-IN")}` : "Price unavailable"} <span>/ 30 days</span></p>
      <p className="clinic-plan-description">Get a monthly view of clinic activity and export your operational summary.</p>
      <ul>{proFeatures.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
      {publicView ? <button type="button" className="clinic-plan-action primary" onClick={onChoose}>Create account to choose Pro <span aria-hidden="true">→</span></button> : currentPlan === "Pro" || currentPlan === "Trial" ? <div className="clinic-plan-current">{currentPlan === "Trial" ? "Your 14-day Pro trial is active" : "Clinic Pro is active"}{plan?.until ? ` until ${new Date(plan.until).toLocaleDateString("en-IN")}` : ""}</div> : <button type="button" className="clinic-plan-action primary" disabled={busy || (plan?.trialUsed && !price)} onClick={() => onChoose(plan?.trialUsed ? "order" : "trial")}>{!plan?.trialUsed ? "Try Pro free for 14 days" : `Upgrade for ₹${Number(price || 0).toLocaleString("en-IN")}`} <span aria-hidden="true">→</span></button>}
      {!publicView && plan?.pending && <button type="button" className="clinic-plan-action secondary" disabled={busy} onClick={() => onChoose("confirm")}>Check payment</button>}
    </article>
  </div>;
}

export function PublicClinicPlans({ onCreateAccount, price = 499 }) {
  return <main className="clinic-subscriptions-public">
    <header className="clinic-subscriptions-hero"><span>MEDICALL AI · CLINIC PLANS</span><h1>A plan for the way your clinic works.</h1><p>Start with the essentials for free. Upgrade when you want monthly clinic summaries and payment reporting.</p></header>
    <section className="clinic-subscriptions-content" aria-label="Clinic subscription plans">
      <PlanCards publicView onChoose={onCreateAccount} plan={{ plan: "Free", price }} />
      <p className="clinic-plan-footnote">Clinic subscriptions are for clinic accounts only. Patients can create and use an account for free. Doctors sign in with accounts created by their clinic.</p>
    </section>
  </main>;
}

export default function ClinicBilling({ api, token }) {
  const [plan, setPlan] = useState(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [revision, refresh] = useState(0);
  const url = api + "/clinic/billing";
  useEffect(() => {
    const controller = new AbortController();
    axios.get(url, { headers: { Authorization: "Bearer " + token }, signal: controller.signal }).then((r) => setPlan(r.data)).catch(() => { if (!controller.signal.aborted) setMessage("Could not load your clinic plan."); });
    return () => controller.abort();
  }, [url, token, revision]);

  async function act(action) {
    const config = { headers: { Authorization: "Bearer " + token } };
    setBusy(true); setMessage("");
    try {
      if (action === "export") {
        const { data } = await axios.get(url + "/monthly-summary", { ...config, responseType: "blob" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(data); link.download = "clinic-monthly-summary.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); return;
      }
      const { data } = await axios.post(url + "/" + action, {}, config);
      if (action === "order") {
        if (!window.Razorpay) await new Promise((ok, fail) => { const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = ok; script.onerror = fail; document.head.appendChild(script); });
        new window.Razorpay({ ...data, name: "MediCall AI", description: "30 days of Clinic Pro", handler: () => act("confirm"), theme: { color: "#087a78" } }).open();
      } else setMessage(data.message);
    } catch (error) { setMessage(error.response?.data?.message || "Could not complete this action. Please retry."); }
    finally { setBusy(false); refresh((value) => value + 1); }
  }

  return <section className="clinic-subscription-panel">
    <header className="clinic-subscription-heading"><div><span className="clinic-plan-eyebrow">SIMPLE, TRANSPARENT PRICING</span><h2>Your clinic subscription</h2><p>Choose the tools that fit your clinic. Your plan applies only to this clinic workspace.</p></div><button type="button" className="clinic-plan-refresh" onClick={() => refresh((value) => value + 1)}>↻ <span>Refresh</span></button></header>
    {plan && <><div className="clinic-current-plan"><span className="clinic-current-dot"/><span>Current plan: <strong>{plan.plan}</strong></span>{plan.until && <span>· Valid until {new Date(plan.until).toLocaleDateString("en-IN")}</span>}</div><PlanCards plan={plan} busy={busy} onChoose={act}/>{plan.plan !== "Free" && <div className="clinic-plan-export"><div><strong>Monthly clinic summary</strong><p>Export appointment totals, completed visits and collected payments as a CSV file.</p></div><button type="button" disabled={busy} onClick={() => act("export")}>Download monthly summary ↓</button></div>}</>}
    {message && <p role="status" className="clinic-billing-message">{message}</p>}
  </section>;
}

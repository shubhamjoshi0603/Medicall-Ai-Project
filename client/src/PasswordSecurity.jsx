import { useState } from "react";
import axios from "axios";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100";
const primaryClass = "rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60";
const roleLabel = { clinic: "clinic", patient: "patient", doctor: "doctor" };

export function ForgotPasswordPanel({ apiUrl, role, initialEmail = "", onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestReset(event) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    try {
      const { data } = await axios.post(`${apiUrl}/password/forgot`, { email, role });
      setMessage(data.message || "If an account matches this email, a reset link will be sent shortly.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not request a reset link. Please try again.");
    } finally { setBusy(false); }
  }

  return <section className="password-security-card mx-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-9">
    <p className="text-xs font-extrabold uppercase tracking-[.18em] text-teal-700">{roleLabel[role]} account recovery</p>
    <h2 className="mt-2 text-2xl font-black text-slate-950">Forgot your password?</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Enter the email on your {roleLabel[role]} account. If it matches, we’ll send a secure reset link that expires in 20 minutes.</p>
    <form onSubmit={requestReset} className="mt-5 space-y-4">
      <label className="block text-sm font-semibold text-slate-700">Account email<input className={`${inputClass} mt-1.5`} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button className={`${primaryClass} w-full`} disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
      <button type="button" onClick={onBack} className="w-full py-2 text-sm font-bold text-slate-600 hover:text-teal-800">Back to sign in</button>
    </form>
    <p className="mt-3 text-xs leading-5 text-slate-500">For doctor accounts, only the doctor can request and complete their own reset.</p>
  </section>;
}

export function ResetPasswordPanel({ apiUrl, token, role, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resetPassword(event) {
    event.preventDefault(); setError(""); setMessage("");
    if (password !== confirm) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${apiUrl}/password/reset`, { token, role, password });
      setMessage(data.message || "Your password has been reset.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "This reset link is invalid or expired. Request a new one.");
    } finally { setBusy(false); }
  }

  return <main className="password-security-page mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-10">
    <section className="password-security-card w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-9">
      <p className="text-xs font-extrabold uppercase tracking-[.18em] text-teal-700">Secure {roleLabel[role] || "account"} recovery</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950">Set a new password</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Choose a password with at least 8 characters. This reset link can be used once and expires after 20 minutes.</p>
      {message ? <div className="mt-5 space-y-4"><p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message} All existing sessions have been signed out.</p><button className={primaryClass} onClick={onComplete}>Continue to sign in</button></div> : <form onSubmit={resetPassword} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-slate-700">New password<input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="block text-sm font-semibold text-slate-700">Confirm new password<input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button className={`${primaryClass} w-full`} disabled={busy}>{busy ? "Updating…" : "Reset password"}</button>
      </form>}
    </section>
  </main>;
}

export function ChangePasswordPanel({ apiUrl, token, role, onChanged }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function changePassword(event) {
    event.preventDefault(); setMessage(""); setError("");
    if (password !== confirm) { setError("The new passwords do not match."); return; }
    if (currentPassword === password) { setError("Choose a new password that is different from your current one."); return; }
    setBusy(true);
    try {
      const { data } = await axios.patch(`${apiUrl}/${role === "clinic" ? "auth" : `${role}-auth`}/password`, { currentPassword, password }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage(data.message || "Password updated. Please sign in again.");
      onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not change your password. Please try again.");
    } finally { setBusy(false); }
  }

  return <section className="password-security-card rounded-2xl border border-slate-200 bg-white p-5">
    <div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-teal-700">Account security</p><h3 className="mt-1 text-lg font-black text-slate-900">Change password</h3><p className="mt-1 text-sm text-slate-600">Enter your current password to set a new one. You’ll need to sign in again afterward.</p></div>
    <form onSubmit={changePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-slate-700 sm:col-span-2">Current password<input className={`${inputClass} mt-1.5`} type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <label className="text-xs font-bold text-slate-700">New password<input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label className="text-xs font-bold text-slate-700">Confirm new password<input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:col-span-2">{message}</p>}
      <button className={`${primaryClass} sm:col-span-2`} disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>
  </section>;
}

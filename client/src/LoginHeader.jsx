const roles = [
  ["Patient", <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>],
  ["Doctor", <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v5a5 5 0 0 0 10 0V3M5 3h4M15 3h4M12 13v2a5 5 0 0 0 10 0v-1M20 11v3"/></svg>],
  ["Clinic", <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V5.5L12 2l8 3.5V21M9 21v-5h6v5M12 7v5M9.5 9.5h5"/></svg>],
];

export default function LoginHeader({ role, registering, onSelect }) {
  return <>
    <header className="care-login-heading">
      <p className="care-login-brand">MEDICALL AI <span>·</span> CARE, CONNECTED</p>
      <h1>{registering ? "Create your account" : "Welcome back"}</h1>
      <p>{registering ? "Choose your account type to get started." : "Choose your account type to sign in."}</p>
    </header>
    <div className="care-role-selector" role="group" aria-label="Account type">
      {roles.map(([label, icon]) => {
        const key = label.toLowerCase();
        return <button key={key} type="button" aria-pressed={role === key}
          className={role === key ? "is-active" : ""} onClick={() => onSelect(key)}>
          {icon}<span>{label}</span>
        </button>;
      })}
    </div>
  </>;
}

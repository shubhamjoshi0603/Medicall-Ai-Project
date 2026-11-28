export default function PortalNavigation({ role, sections, value, onChange }) {
  const id = role.toLowerCase() + "-navigation";
  return (
    <nav className="portal-switcher" aria-label={role + " portal navigation"}>
      <label htmlFor={id}>{role} portal</label>
      <select id={id} value={value} onChange={event => onChange(event.target.value)}>
        {sections.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </nav>
  );
}

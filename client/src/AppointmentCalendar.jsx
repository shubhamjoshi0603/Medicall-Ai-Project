import { useState } from "react";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("en-IN", { dateStyle: "full" });

function dateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0")).join("-");
}

export default function AppointmentCalendar({ appointments, getTitle, onOpen }) {
  const [selected, setSelected] = useState(() => new Date());
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const offset = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const today = dateKey(new Date());
  const selectedKey = dateKey(selected);
  const byDate = new Map();
  for (const appointment of appointments) {
    const day = byDate.get(appointment.date) ?? [];
    day.push(appointment);
    byDate.set(appointment.date, day);
  }
  const agenda = (byDate.get(selectedKey) ?? []).sort((a, b) =>
    String(a.time ?? "").localeCompare(String(b.time ?? ""), "en", { numeric: true })
  );

  return (
    <section className="schedule-calendar" aria-label="Appointment calendar">
      <header className="schedule-calendar-header">
        <h3 aria-live="polite">{monthLabel.format(selected)}</h3>
        <div>
          <button type="button" onClick={() => setSelected(new Date(year, month - 1, 1))} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => setSelected(new Date())}>Today</button>
          <button type="button" onClick={() => setSelected(new Date(year, month + 1, 1))} aria-label="Next month">›</button>
        </div>
      </header>
      <div className="schedule-calendar-body">
        <div className="schedule-calendar-grid">
          {weekdays.map((day) => <span key={day} className="schedule-weekday">{day}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={index} aria-hidden="true" />)}
          {Array.from({ length: count }, (_, index) => {
            const date = new Date(year, month, index + 1);
            const key = dateKey(date);
            const total = byDate.get(key)?.length ?? 0;
            return (
              <button key={key} type="button" aria-pressed={key === selectedKey}
                aria-current={key === today ? "date" : undefined}
                aria-label={`${dayLabel.format(date)}, ${total} appointments`}
                onClick={() => setSelected(date)}>
                {index + 1}{total > 0 && <small>{total}</small>}
              </button>
            );
          })}
        </div>
        <div className="schedule-agenda">
          <h4>{dayLabel.format(selected)}</h4>
          {agenda.length === 0 && <p>No appointments scheduled for this day.</p>}
          {agenda.map((appointment) => (
            <article key={appointment._id}>
              <div><strong>{getTitle(appointment)}</strong><p>{appointment.time} · {appointment.status}</p></div>
              {onOpen && <button type="button" onClick={() => onOpen(appointment)}>Open file</button>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

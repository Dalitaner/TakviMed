import Calendar from "../components/Calendar";
import { getDayItems, todayKey } from "../services/medicationService";

export default function CalendarView({ medications, checked, selectedDate, onSelectDate, onToggleTaken }) {
  const date = selectedDate || todayKey();
  const items = getDayItems(medications, date);

  return (
    <main className="view-shell">
      <Calendar medications={medications} checked={checked} selectedDate={date} onSelectDate={onSelectDate} />
      <section className="section-block">
        <div className="section-heading">
          <h2>{new Date(`${date}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</h2>
          <span>{items.filter((item) => checked[date]?.[item.key]).length}/{items.length}</span>
        </div>
        {items.length ? (
          <div className="dose-list">
            {items.map((item) => {
              const taken = !!checked[date]?.[item.key];
              return (
                <button className={`dose-item ${taken ? "taken just-taken" : ""}`} key={item.key} type="button" onClick={() => onToggleTaken(date, item.key)}>
                  <time>{item.time}</time>
                  <span><strong>{item.med.name}</strong><small>{item.med.dose}</small></span>
                  <i><span>{taken ? "✓" : ""}</span></i>
                </button>
              );
            })}
          </div>
        ) : <div className="empty-state compact">Bu gün için doz yok.</div>}
      </section>
    </main>
  );
}

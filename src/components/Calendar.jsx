import { useMemo, useState } from "react";
import { getDayItems, todayKey } from "../services/medicationService";

const days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export default function Calendar({ medications, checked, selectedDate, onSelectDate }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const list = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= count; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const items = getDayItems(medications, key);
      const done = items.filter((item) => checked[key]?.[item.key]).length;
      list.push({ day, key, total: items.length, done });
    }
    return list;
  }, [checked, cursor, medications]);

  const monthLabel = cursor.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  return (
    <section className="calendar-card">
      <div className="calendar-header">
        <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Önceki ay">‹</button>
        <strong>{monthLabel}</strong>
        <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Sonraki ay">›</button>
      </div>
      <div className="calendar-grid">
        {days.map((day) => <span className="dow" key={day}>{day}</span>)}
        {cells.map((cell, index) =>
          cell ? (
            <button
              key={cell.key}
              className={`day-cell ${cell.key === todayKey() ? "today" : ""} ${cell.key === selectedDate ? "selected" : ""} ${
                cell.total && cell.done === cell.total ? "complete" : cell.done ? "partial" : ""
              }`}
              type="button"
              onClick={() => onSelectDate(cell.key)}
            >
              <span>{cell.day}</span>
              {cell.total ? <small>{cell.done}/{cell.total}</small> : null}
            </button>
          ) : (
            <span className="day-cell empty" key={`empty-${index}`} />
          ),
        )}
      </div>
    </section>
  );
}

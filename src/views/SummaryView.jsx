import { useState } from "react";
import { summaryFor } from "../services/medicationService";

export default function SummaryView({ medications, checked }) {
  const [days, setDays] = useState(7);
  const summary = summaryFor(medications, checked, days);

  return (
    <main className="view-shell">
      <div className="section-heading">
        <h1>Özet</h1>
        <span>Uyum ve takip</span>
      </div>
      <div className="segment-control">
        <button className={days === 7 ? "active" : ""} type="button" onClick={() => setDays(7)}>7 gün</button>
        <button className={days === 30 ? "active" : ""} type="button" onClick={() => setDays(30)}>30 gün</button>
      </div>
      <section className="summary-grid">
        <div className="summary-main">
          <span>Genel uyum</span>
          <strong>{summary.rate}%</strong>
        </div>
        <div><strong>{summary.takenDose}</strong><span>Alınan doz</span></div>
        <div><strong>{summary.missedDose}</strong><span>Atlanan doz</span></div>
        <div><strong>{summary.perfectDays}</strong><span>Mükemmel gün</span></div>
      </section>
      <section className="chart-card">
        {summary.rows.map((row) => {
          const pct = row.total ? Math.round((row.taken / row.total) * 100) : 0;
          return (
            <div className="bar-col" key={row.date}>
              <div><span style={{ height: `${Math.max(5, pct)}%` }} /></div>
              <small>{new Date(`${row.date}T12:00:00`).toLocaleDateString("tr-TR", { weekday: "short" })}</small>
            </div>
          );
        })}
      </section>
    </main>
  );
}

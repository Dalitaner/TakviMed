import { useState } from "react";
import { summaryFor } from "../services/medicationService";

const weekDays = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export default function SummaryView({ medications, checked }) {
  const [days, setDays] = useState(7);
  const summary = summaryFor(medications, checked, days);
  const chartRows = buildWeekdayRows(summary.rows);

  if (medications.length === 0) {
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
        <EmptySummary />
      </main>
    );
  }

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
        {chartRows.map((row) => {
          return (
            <div className="bar-col" key={row.label}>
              <strong>{row.label}</strong>
              <div className="weekly-bar">
                <span style={{ height: `${row.percent}%` }} />
              </div>
              <small>{row.percent}%</small>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function buildWeekdayRows(rows) {
  const grouped = weekDays.map((label) => ({ label, taken: 0, total: 0 }));
  rows.forEach((row) => {
    const dayIndex = new Date(`${row.date}T12:00:00`).getDay();
    grouped[dayIndex].taken += row.taken;
    grouped[dayIndex].total += row.total;
  });
  return grouped.map((row) => ({
    ...row,
    percent: row.total ? Math.round((row.taken / row.total) * 100) : 0,
  }));
}

function EmptySummary() {
  return (
    <section className="designed-empty-state">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <rect x="24" y="62" width="14" height="30" rx="7" />
        <rect x="52" y="42" width="14" height="50" rx="7" />
        <rect x="80" y="26" width="14" height="66" rx="7" />
        <path d="M22 94h76" />
      </svg>
      <h2>Henüz ilaç kaydınız yok</h2>
      <p>İlaç ekledikten sonra uyum istatistiklerinizi burada görebilirsiniz.</p>
    </section>
  );
}

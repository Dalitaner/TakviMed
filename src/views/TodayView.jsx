import { buildAlerts, getDayItems, todayKey } from "../services/medicationService";

export default function TodayView({ medications, checked, onToggleTaken }) {
  const date = todayKey();
  const items = getDayItems(medications, date);
  const done = items.filter((item) => checked[date]?.[item.key]).length;
  const progress = items.length ? Math.round((done / items.length) * 100) : 0;
  const alerts = buildAlerts(medications, checked);

  return (
    <main className="view-shell">
      <section className="hero-band">
        <div>
          <span>Bugünkü plan</span>
          <h1>{progress}% tamamlandı</h1>
          <p>{done}/{items.length} doz işaretlendi</p>
        </div>
        <div className="progress-ring" style={{ "--value": `${progress}%` }}>{progress}</div>
      </section>

      {alerts.length ? (
        <section className="alert-list">
          {alerts.map((alert, index) => (
            <div className={`alert-card ${alert.level}`} key={`${alert.title}-${index}`}>
              <strong>{alert.title}</strong>
              <span>{alert.detail}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="section-block">
        <div className="section-heading">
          <h2>Sıradaki dozlar</h2>
          <span>{new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        {items.length === 0 ? (
          <div className="empty-state">Bugün için kayıtlı ilaç yok. İlk ilacınızı ekleyerek başlayın.</div>
        ) : (
          <div className="dose-list">
            {items.map((item) => {
              const taken = !!checked[date]?.[item.key];
              return (
                <button className={`dose-item ${taken ? "taken just-taken" : ""}`} key={item.key} type="button" onClick={() => onToggleTaken(date, item.key)}>
                  <time>{item.time}</time>
                  <span>
                    <strong>{item.med.name}</strong>
                    <small>{item.med.dose} · {item.med.foodTiming}</small>
                  </span>
                  <i aria-hidden="true"><span>{taken ? "✓" : ""}</span></i>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

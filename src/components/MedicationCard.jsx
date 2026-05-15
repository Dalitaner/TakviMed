import { calculateStockDays, daysUntil } from "../services/medicationService";

export default function MedicationCard({ medication, onEdit, onDelete, onStockChange, onExpiryChange }) {
  const stockDays = calculateStockDays(medication);
  const expiryDays = daysUntil(medication.expiryDate);
  const stockStatus = stockDays === null ? "" : stockDays <= 3 ? "danger" : stockDays <= 7 ? "warning" : "good";
  const expiryStatus = expiryDays === null ? "" : expiryDays < 0 || expiryDays <= 3 ? "danger" : expiryDays <= 7 ? "warning" : "good";

  return (
    <article className="med-card entrance-card">
      <div className="med-card-top">
        <div>
          <h3>{medication.name}</h3>
          <p>{medication.dose} · {medication.foodTiming}</p>
        </div>
        <div className="time-stack">
          {medication.times.map((time) => (
            <span key={time}>{time}</span>
          ))}
        </div>
      </div>

      {medication.notes ? <p className="note-line">{medication.notes}</p> : null}

      <div className="tracking-grid">
        <label>
          Stok
          <input
            inputMode="numeric"
            type="number"
            min="0"
            value={medication.stock}
            onChange={(event) => onStockChange(medication.id, event.target.value)}
          />
        </label>
        <label>
          SKT
          <input type="date" value={medication.expiryDate || ""} onChange={(event) => onExpiryChange(medication.id, event.target.value)} />
        </label>
      </div>

      <div className="status-row">
        {stockDays !== null ? <span className={`status-pill ${stockStatus}`}>{stockDays} gün stok</span> : <span className="status-pill">Stok girilmedi</span>}
        {expiryDays !== null ? (
          <span className={`status-pill ${expiryStatus}`}>{expiryDays < 0 ? "Son kullanma tarihi geçmiş" : `${expiryDays} gün sonra bitiyor`}</span>
        ) : (
          <span className="status-pill">Son kullanma tarihi yok</span>
        )}
      </div>

      <div className="button-row">
        <button className="ghost-button" type="button" onClick={() => onEdit(medication)}>
          Düzenle
        </button>
        <button className="danger-button" type="button" onClick={() => onDelete(medication.id)}>
          Sil
        </button>
      </div>
    </article>
  );
}

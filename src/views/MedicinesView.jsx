import MedicationCard from "../components/MedicationCard";

export default function MedicinesView({ medications, archive, onEdit, onDelete, onRestore, onStockChange, onExpiryChange }) {
  return (
    <main className="view-shell">
      <div className="section-heading">
        <h1>İlaçlarım</h1>
        <span>{medications.length} aktif kayıt</span>
      </div>
      {medications.length === 0 ? (
        <div className="empty-state">Henüz ilaç eklenmedi.</div>
      ) : (
        <div className="card-stack">
          {medications.map((med) => (
            <MedicationCard
              key={med.id}
              medication={med}
              onEdit={onEdit}
              onDelete={onDelete}
              onStockChange={onStockChange}
              onExpiryChange={onExpiryChange}
            />
          ))}
        </div>
      )}

      {archive.length ? (
        <section className="section-block">
          <div className="section-heading">
            <h2>Arşiv</h2>
            <span>{archive.length} kayıt</span>
          </div>
          {archive.map((med) => (
            <div className="archive-row" key={med.id}>
              <span>{med.name}</span>
              <button type="button" onClick={() => onRestore(med.id)}>Geri al</button>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}

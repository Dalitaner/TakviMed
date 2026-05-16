import MedicationCard from "../components/MedicationCard";
import { daysUntil } from "../services/medicationService";
import { useState } from "react";

export default function MedicinesView({ medications, archive, onEdit, onDelete, onRestore, onStockChange, onExpiryChange, onNavigateScan, onArchiveExpired, onDeleteExpired }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const expired = medications.filter((med) => daysUntil(med.expiryDate) !== null && daysUntil(med.expiryDate) < 0);

  return (
    <main className="view-shell">
      <div className="section-heading">
        <h1>İlaçlarım</h1>
        <span>{medications.length} aktif kayıt</span>
      </div>
      {expired.length ? (
        <section className="expiry-action-card">
          <div>
            <strong>Son kullanma tarihi geçmiş ilaçlarınız var.</strong>
            <p>Bunları arşivlemek veya silmek ister misiniz?</p>
          </div>
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={() => onArchiveExpired(expired.map((med) => med.id))}>Arşivle</button>
            <button className="danger-button" type="button" onClick={() => onDeleteExpired(expired.map((med) => med.id))}>Sil</button>
          </div>
        </section>
      ) : null}
      {medications.length === 0 ? (
        <section className="designed-empty-state">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <rect x="42" y="18" width="36" height="84" rx="18" />
            <path d="M42 60h36" />
          </svg>
          <h2>İlaç listeniz boş</h2>
          <p>Reçetenizi taratarak veya manuel ekleyerek başlayın</p>
          <button className="primary-button" type="button" onClick={onNavigateScan}>İlaç Ekle</button>
        </section>
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
            <button className="archive-toggle" type="button" onClick={() => setArchiveOpen((value) => !value)}>
              {archiveOpen ? "Gizle" : `${archive.length} kayıt göster`}
            </button>
          </div>
          {archiveOpen ? archive.map((med) => (
              <div className="archive-row" key={med.id}>
                <span>{med.name}</span>
                <button type="button" onClick={() => onRestore(med.id)}>Geri al</button>
              </div>
            )) : null}
        </section>
      ) : null}
    </main>
  );
}

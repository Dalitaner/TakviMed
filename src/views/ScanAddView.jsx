import { useMemo, useState } from "react";
import NavIcon from "../components/NavIcon";
import AddMedicineView from "./AddMedicineView";

const sampleMedicine = {
  name: "IBURAMIN ZERO",
  dose: "1 flakon",
  foodTiming: "aç veya tok karnına",
  times: ["08:00", "13:00", "20:00"],
  duration: "reçeteye göre",
  stock: 24,
  initialStock: 24,
  expiryDate: "2019-02-12",
  reminderMinutes: 0,
  notes: "Grip / soğuk algınlığında. Hafif uyku sersemliği yapabilir, dikkat ediniz.",
};

export default function ScanAddView({ onSave }) {
  const [mode, setMode] = useState("scan");
  const [preview, setPreview] = useState("");
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);

  const helperText = useMemo(() => {
    if (loading) return "Reçete etiketi okunuyor...";
    if (parsed) return "Bilgileri kontrol edip ilacı ekleyebilirsiniz.";
    return "Reçete etiketi veya ilaç kutusunun fotoğrafını yükleyin.";
  }, [loading, parsed]);

  function useSample() {
    setParsed(sampleMedicine);
    setPreview("");
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setParsed(null);

    if (typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result || ""));
      reader.readAsDataURL(file);
    }

    try {
      const body = new FormData();
      body.append("image", file);
      const response = await fetch("/api/scan-prescription", { method: "POST", body });
      if (response.ok) {
        const data = await response.json();
        setParsed({ ...sampleMedicine, ...data });
        return;
      }
    } catch {
      // Development fallback below keeps the UI usable until OCR backend exists.
    } finally {
      setLoading(false);
    }
    setParsed(sampleMedicine);
  }

  if (mode === "manual") {
    return <AddMedicineView onSave={onSave} onCancel={() => setMode("scan")} />;
  }

  return (
    <main className="view-shell">
      <div className="section-heading">
        <h1>Tara / Ekle</h1>
        <span>Reçeteden otomatik doldur</span>
      </div>
      <section className="scan-panel">
        <div className="scan-hero">
          <div className="scan-icon"><NavIcon id="scan" /></div>
          <h2>Reçete Etiketi Tara</h2>
          <p>{helperText}</p>
        </div>
        {preview ? (
          <div className="upload-zone preview-zone">
            <img src={preview} alt="Yüklenen reçete önizlemesi" />
          </div>
        ) : (
          <div className="scan-actions">
            <label className="scan-action-card">
              <span className="scan-action-icon"><PhotoIcon /></span>
              <strong>Fotoğraf Seç</strong>
              <small>Galeriden reçete veya ilaç etiketi yükleyin.</small>
              <input type="file" accept="image/*" onChange={handleFile} />
            </label>
            <label className="scan-action-card">
              <span className="scan-action-icon"><CameraIcon /></span>
              <strong>Kamera ile Çek</strong>
              <small>Reçete etiketini net şekilde fotoğraflayın.</small>
              <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
            </label>
          </div>
        )}
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={useSample}>Örnek reçeteyi kullan</button>
          <button className="ghost-button" type="button" onClick={() => setMode("manual")}>Manuel ekle</button>
        </div>
      </section>

      {parsed ? (
        <section className="section-block parsed-card">
          <div className="section-heading">
            <h2>Okunan bilgiler</h2>
            <span>Kontrol gerekli</span>
          </div>
          <AddMedicineView
            initialMedication={parsed}
            onSave={(payload) => {
              onSave(payload);
              setParsed(null);
              setPreview("");
            }}
            onCancel={() => setParsed(null)}
          />
        </section>
      ) : null}
    </main>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <rect x="5" y="7" width="18" height="15" rx="3" />
      <circle cx="11" cy="12" r="2" />
      <path d="m7 20 5.5-5 3.5 3 2.5-2.5L23 20" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M9 9 11 6h6l2 3h2.5A2.5 2.5 0 0 1 24 11.5v8A2.5 2.5 0 0 1 21.5 22h-15A2.5 2.5 0 0 1 4 19.5v-8A2.5 2.5 0 0 1 6.5 9H9Z" />
      <circle cx="14" cy="15.5" r="4" />
      <path d="M20.5 12h.1" />
    </svg>
  );
}

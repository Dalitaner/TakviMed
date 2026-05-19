import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { useMemo, useState } from "react";
import NavIcon from "../components/NavIcon";
import AddMedicineView from "./AddMedicineView";
import { scanPrescriptionImage } from "../services/assistantService";

function dataUrlToFile(dataUrl, filename = "prescription.jpg") {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = /data:([^;]+);/.exec(meta);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

const sampleMedications = [
  {
    name: "Lansor",
    dose: "30 mg, 1 kapsül",
    foodTiming: "aç karna",
    times: ["08:00"],
    duration: "reçeteye göre",
    expiryDate: "",
    notes: "Yemekten önce, mide koruyucu",
  },
  {
    name: "Parafon",
    dose: "500 mg, 1 tablet",
    foodTiming: "önemli değil",
    times: ["08:00", "20:00"],
    duration: "reçeteye göre",
    expiryDate: "",
    notes: "1 bardak su ile yutunuz",
  },
];

function withDefaults(med) {
  return {
    name: "",
    dose: "1 tablet",
    foodTiming: "önemli değil",
    times: ["08:00"],
    duration: "reçeteye göre",
    stock: 30,
    initialStock: 30,
    expiryDate: "",
    reminderMinutes: 0,
    notes: "",
    ...med,
  };
}

export default function ScanAddView({ onSave }) {
  const [mode, setMode] = useState("scan");
  const [preview, setPreview] = useState("");
  const [medications, setMedications] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState("");

  const helperText = useMemo(() => {
    if (loading) return "Reçete okunuyor, lütfen bekleyin...";
    if (scanError) return scanError;
    if (medications.length > 1) return `${medications.length} ilaç bulundu. Düzenlemek istediğinize dokunun veya hepsini birden ekleyin.`;
    if (medications.length === 1) return "Bilgileri kontrol edip ilacı ekleyebilirsiniz.";
    return "Reçete etiketi veya ilaç kutusunun fotoğrafını yükleyin.";
  }, [loading, medications.length, scanError]);

  function useSample() {
    setMedications(sampleMedications);
    setSelectedIndex(null);
    setPreview("");
    setScanError("");
  }

  async function processFile(file) {
    if (!file) return;
    setLoading(true);
    setMedications([]);
    setSelectedIndex(null);
    setScanError("");

    try {
      const { medications: meds, preview: previewUrl } = await scanPrescriptionImage(file);
      setPreview(previewUrl);
      setMedications(meds);
      if (meds.length === 1) setSelectedIndex(0);
    } catch (error) {
      setScanError(error.message || "Reçete okunamadı.");
      setPreview("");
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    await processFile(file);
  }

  async function pickFromNativeCamera(source) {
    try {
      const photo = await Camera.getPhoto({
        source,
        resultType: CameraResultType.DataUrl,
        quality: 85,
        allowEditing: false,
        promptLabelHeader: "Reçete",
        promptLabelCancel: "Vazgeç",
      });
      if (!photo?.dataUrl) return;
      const file = dataUrlToFile(photo.dataUrl);
      await processFile(file);
    } catch (err) {
      if (String(err?.message || "").toLowerCase().includes("cancel")) return;
      console.error("[ScanAddView.native]", err);
      setScanError(source === CameraSource.Camera
        ? "Kamera açılamadı. Ayarlar'dan TakviMed'e kamera izni verdiğinizden emin olun."
        : "Galeri açılamadı. Ayarlar'dan TakviMed'e fotoğraf izni verdiğinizden emin olun.");
    }
  }

  function saveSelected(payload) {
    onSave(payload);
    setMedications((current) => current.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
  }

  function addAll() {
    medications.forEach((med) => onSave(withDefaults(med)));
    setMedications([]);
    setSelectedIndex(null);
    setPreview("");
  }

  function clearAll() {
    setMedications([]);
    setSelectedIndex(null);
    setPreview("");
    setScanError("");
  }

  if (mode === "manual") {
    return <AddMedicineView onSave={onSave} onCancel={() => setMode("scan")} />;
  }

  const showForm = selectedIndex !== null && medications[selectedIndex];
  const isNative = Capacitor.isNativePlatform();

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
            {isNative ? (
              <button type="button" className="scan-action-card scan-action-button" onClick={() => pickFromNativeCamera(CameraSource.Photos)}>
                <span className="scan-action-icon"><PhotoIcon /></span>
                <strong>Fotoğraf Seç</strong>
                <small>Galeriden reçete veya ilaç etiketi yükleyin.</small>
              </button>
            ) : (
              <label className="scan-action-card">
                <span className="scan-action-icon"><PhotoIcon /></span>
                <strong>Fotoğraf Seç</strong>
                <small>Galeriden reçete veya ilaç etiketi yükleyin.</small>
                <input type="file" accept="image/*" onChange={handleFile} />
              </label>
            )}
            {isNative ? (
              <button type="button" className="scan-action-card scan-action-button" onClick={() => pickFromNativeCamera(CameraSource.Camera)}>
                <span className="scan-action-icon"><CameraIcon /></span>
                <strong>Kamera ile Çek</strong>
                <small>Reçete etiketini net şekilde fotoğraflayın.</small>
              </button>
            ) : (
              <label className="scan-action-card">
                <span className="scan-action-icon"><CameraIcon /></span>
                <strong>Kamera ile Çek</strong>
                <small>Reçete etiketini net şekilde fotoğraflayın.</small>
                <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
              </label>
            )}
          </div>
        )}
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={useSample}>Örnek reçeteyi kullan</button>
          <button className="ghost-button" type="button" onClick={() => setMode("manual")}>Manuel ekle</button>
        </div>
      </section>

      {medications.length > 1 && !showForm ? (
        <section className="section-block parsed-card">
          <div className="section-heading">
            <h2>Bulunan ilaçlar ({medications.length})</h2>
            <span>Tek tek düzenle veya hepsini ekle</span>
          </div>
          <ul className="scan-result-list">
            {medications.map((med, index) => (
              <li key={`${med.name}-${index}`}>
                <button type="button" className="scan-result-item" onClick={() => setSelectedIndex(index)}>
                  <div className="scan-result-main">
                    <strong>{med.name || "İsim okunamadı"}</strong>
                    <span>{med.dose || "Doz belirsiz"}</span>
                  </div>
                  <div className="scan-result-meta">
                    {med.times?.length ? <span>{med.times.join(" · ")}</span> : null}
                    {med.foodTiming && med.foodTiming !== "önemli değil" ? <span>{med.foodTiming}</span> : null}
                  </div>
                  <span className="chevron">›</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={addAll}>Hepsini ekle</button>
            <button className="ghost-button" type="button" onClick={clearAll}>Vazgeç</button>
          </div>
        </section>
      ) : null}

      {showForm ? (
        <section className="section-block parsed-card">
          <div className="section-heading">
            <h2>{medications.length > 1 ? `İlaç ${selectedIndex + 1}/${medications.length}` : "Okunan bilgiler"}</h2>
            <span>Kontrol gerekli</span>
          </div>
          <AddMedicineView
            initialMedication={withDefaults(medications[selectedIndex])}
            onSave={saveSelected}
            onCancel={() => (medications.length > 1 ? setSelectedIndex(null) : clearAll())}
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

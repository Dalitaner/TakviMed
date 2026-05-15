import { useEffect, useState } from "react";

const blank = {
  name: "",
  dose: "1 tablet",
  foodTiming: "önemli değil",
  times: ["08:00"],
  duration: "süresiz",
  stock: "",
  expiryDate: "",
  reminderMinutes: 0,
  notes: "",
};

export default function AddMedicineView({ initialMedication, onSave, onCancel }) {
  const [form, setForm] = useState(blank);

  useEffect(() => {
    setForm(initialMedication || blank);
  }, [initialMedication]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateTime(index, value) {
    setForm((current) => ({ ...current, times: current.times.map((time, i) => (i === index ? value : time)) }));
  }

  function submit(event) {
    event.preventDefault();
    const times = form.times.filter(Boolean).sort();
    if (!form.name.trim() || !times.length) return;
    onSave({ ...form, name: form.name.trim(), times });
    if (!initialMedication) setForm(blank);
  }

  return (
    <main className="view-shell">
      <div className="section-heading">
        <h1>{initialMedication ? "İlacı düzenle" : "İlaç ekle"}</h1>
        <span>Hatırlatma bilgileri</span>
      </div>

      <form className="form-card" onSubmit={submit}>
        <label className="field-label">
          İlaç adı
          <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Örn. D vitamini" required />
        </label>
        <div className="two-col">
          <label className="field-label">
            Doz
            <input value={form.dose} onChange={(event) => update("dose", event.target.value)} />
          </label>
          <label className="field-label">
            Kullanım
            <select value={form.foodTiming} onChange={(event) => update("foodTiming", event.target.value)}>
              <option>önemli değil</option>
              <option>aç karnına</option>
              <option>tok karnına</option>
              <option>yemekle</option>
            </select>
          </label>
        </div>

        <label className="field-label">Saatler</label>
        <div className="time-editor">
          {form.times.map((time, index) => (
            <input key={`${index}-${time}`} type="time" value={time} onChange={(event) => updateTime(index, event.target.value)} />
          ))}
          <button type="button" onClick={() => update("times", [...form.times, "12:00"])}>+ Saat</button>
          {form.times.length > 1 ? <button type="button" onClick={() => update("times", form.times.slice(0, -1))}>Azalt</button> : null}
        </div>

        <div className="two-col">
          <label className="field-label">
            Stok
            <input inputMode="numeric" type="number" min="0" value={form.stock} onChange={(event) => update("stock", event.target.value)} />
          </label>
          <label className="field-label">
            Son kullanma
            <input type="date" value={form.expiryDate || ""} onChange={(event) => update("expiryDate", event.target.value)} />
          </label>
        </div>

        <div className="two-col">
          <label className="field-label">
            Süre
            <input value={form.duration} onChange={(event) => update("duration", event.target.value)} />
          </label>
          <label className="field-label">
            Hatırlatıcı
            <select value={form.reminderMinutes} onChange={(event) => update("reminderMinutes", Number(event.target.value))}>
              <option value="0">Tam saatinde</option>
              <option value="5">5 dk önce</option>
              <option value="15">15 dk önce</option>
              <option value="30">30 dk önce</option>
            </select>
          </label>
        </div>

        <label className="field-label">
          Not
          <textarea value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} placeholder="Özel uyarı veya doktor notu" />
        </label>

        <div className="button-row">
          {initialMedication ? <button className="ghost-button" type="button" onClick={onCancel}>Vazgeç</button> : null}
          <button className="primary-button" type="submit">{initialMedication ? "Kaydet" : "İlaç ekle"}</button>
        </div>
      </form>
    </main>
  );
}

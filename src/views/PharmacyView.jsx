import { useMemo, useState } from "react";

const samplePharmacies = [
  { name: "TakviMed Eczanesi", address: "Merkez Mah. Sağlık Cad. No:12", distance: "450 m", lat: 41.0082, lng: 28.9784, phone: "0212 000 00 01" },
  { name: "Yeşil Eczane", address: "Cumhuriyet Sok. No:8", distance: "780 m", lat: 41.0101, lng: 28.982, phone: "0212 000 00 02" },
  { name: "Mavi Eczane", address: "Atatürk Bulvarı No:34", distance: "1.2 km", lat: 41.006, lng: 28.973, phone: "0212 000 00 03" },
];

export default function PharmacyView() {
  const [pharmacies, setPharmacies] = useState(samplePharmacies);
  const [selected, setSelected] = useState(samplePharmacies[0]);
  const [status, setStatus] = useState("Konum izni verirseniz liste bulunduğunuz bölgeye göre yenilenir.");
  const mapUrl = useMemo(() => `https://maps.google.com/maps?q=${selected.lat},${selected.lng}&z=15&output=embed`, [selected]);

  function useLocation() {
    if (!navigator.geolocation) {
      setStatus("Bu cihazda konum desteği bulunamadı.");
      return;
    }
    setStatus("Konum alınıyor...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`/api/pharmacies?lat=${latitude}&lng=${longitude}`);
          if (response.ok) {
            const data = await response.json();
            const list = Array.isArray(data.pharmacies) ? data.pharmacies : data;
            if (Array.isArray(list) && list.length) {
              setPharmacies(list);
              setSelected(list[0]);
              setStatus("Yakındaki eczaneler güncellendi.");
              return;
            }
          }
        } catch {
          // Local fallback below.
        }
        const nearby = samplePharmacies.map((item, index) => ({
          ...item,
          lat: latitude + (index - 1) * 0.004,
          lng: longitude + (index - 1) * 0.004,
        }));
        setPharmacies(nearby);
        setSelected(nearby[0]);
        setStatus("Backend bağlı olmadığı için örnek eczane kartları konumunuza yaklaştırıldı.");
      },
      () => setStatus("Konum izni alınamadı. Örnek eczane listesi gösteriliyor."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <main className="view-shell">
      <div className="section-heading">
        <h1>Yakındaki Eczaneler</h1>
        <span>Harita görünümü</span>
      </div>
      <section className="location-strip">
        <span>{status}</span>
        <button type="button" onClick={useLocation}>Konumla yenile</button>
      </section>
      <section className="map-card">
        <iframe title={`${selected.name} haritası`} src={mapUrl} loading="lazy" />
      </section>
      <div className="pharmacy-list">
        {pharmacies.map((pharmacy) => (
          <article className={`pharmacy-card ${selected.name === pharmacy.name ? "active" : ""}`} key={pharmacy.name}>
            <div>
              <h2>{pharmacy.name}</h2>
              <p>{pharmacy.address}</p>
              <span>{pharmacy.distance} · {pharmacy.phone}</span>
            </div>
            <button type="button" onClick={() => setSelected(pharmacy)}>Haritada göster</button>
          </article>
        ))}
      </div>
    </main>
  );
}

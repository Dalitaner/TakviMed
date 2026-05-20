import { useEffect, useMemo, useState } from "react";
import { distanceKm, fetchOnDutyPharmacies } from "../services/pharmacyService";

function formatDistance(km) {
  if (km == null) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Bu cihazda konum desteği bulunamadı."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("Konum izni alınamadı. Eczaneleri görmek için konum gerekli.")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

const ON_DUTY_CACHE_KEY = "takvimed:onDutyCache";

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Bugüne ait önbellek varsa onu döndürür; yoksa null.
function readOnDutyCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ON_DUTY_CACHE_KEY) || "null");
    if (parsed && parsed.date === todayStamp() && Array.isArray(parsed.pharmacies)) {
      return parsed.pharmacies;
    }
  } catch {
    // bozuk önbellek - yoksay
  }
  return null;
}

function writeOnDutyCache(pharmacies) {
  try {
    localStorage.setItem(ON_DUTY_CACHE_KEY, JSON.stringify({ date: todayStamp(), pharmacies }));
  } catch {
    // depolama erişilemez - yoksay
  }
}

export default function PharmacyView() {
  const [screen, setScreen] = useState("home"); // "home" | "onDuty"
  const [userCoords, setUserCoords] = useState(null);
  const [locationError, setLocationError] = useState("");

  const [pharmacies, setPharmacies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("Konumuna en yakın açık eczaneler.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Eczane ana sayfası açılınca çevre eczane haritası için konumu al.
  useEffect(() => {
    let active = true;
    getCurrentLocation()
      .then((coords) => active && setUserCoords(coords))
      .catch((err) => active && setLocationError(err.message));
    return () => {
      active = false;
    };
  }, []);

  // Nöbetçi ekranına ilk geçişte listeyi otomatik getir.
  useEffect(() => {
    if (screen === "onDuty" && pharmacies.length === 0 && !loading && !error) {
      loadOnDuty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const nearbyMapUrl = useMemo(
    () =>
      userCoords
        ? `https://maps.google.com/maps?q=eczane&ll=${userCoords.lat},${userCoords.lng}&z=14&output=embed`
        : "",
    [userCoords],
  );

  const selectedMapUrl = useMemo(
    () =>
      selected && selected.latitude && selected.longitude
        ? `https://maps.google.com/maps?q=${selected.latitude},${selected.longitude}&z=15&output=embed`
        : "",
    [selected],
  );

  async function loadOnDuty() {
    if (loading) return;

    // Bugünün verisi önbellekte varsa onu kullan — NosyAPI kredisi harcama.
    // Sadece bugün hiç veri alınmadıysa (ilk giriş veya hata sonrası) sorgu yapılır.
    const cached = readOnDutyCache();
    if (cached) {
      setPharmacies(cached);
      setSelected(cached[0] || null);
      setError("");
      setStatus(
        cached.length
          ? `${cached.length} nöbetçi eczane · bugün güncellendi`
          : "Bugün yakınında nöbetçi eczane bulunamadı.",
      );
      return;
    }

    setError("");
    setLoading(true);
    setStatus("Konum alınıyor...");
    try {
      const coords = userCoords || (await getCurrentLocation());
      setUserCoords(coords);
      setStatus("Nöbetçi eczaneler aranıyor...");
      const { pharmacies: list } = await fetchOnDutyPharmacies({
        latitude: coords.lat,
        longitude: coords.lng,
      });
      const sorted = list
        .map((item) => ({
          ...item,
          distance:
            item.latitude && item.longitude
              ? distanceKm(coords.lat, coords.lng, item.latitude, item.longitude)
              : null,
        }))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      setPharmacies(sorted);
      setSelected(sorted[0] || null);
      writeOnDutyCache(sorted);
      setStatus(
        sorted.length
          ? `${sorted.length} nöbetçi eczane bulundu.`
          : "Yakınında nöbetçi eczane bulunamadı.",
      );
    } catch (err) {
      setError(err.message);
      setStatus("Nöbetçi eczaneler getirilemedi.");
    } finally {
      setLoading(false);
    }
  }

  function retryLocation() {
    setLocationError("");
    getCurrentLocation()
      .then(setUserCoords)
      .catch((err) => setLocationError(err.message));
  }

  if (screen === "onDuty") {
    return (
      <main className="view-shell">
        <button type="button" className="pharmacy-back" onClick={() => setScreen("home")}>
          ← Eczane sayfası
        </button>

        <div className="section-heading">
          <h1>Nöbetçi Eczaneler</h1>
          <span>Konumuna en yakın açık eczaneler</span>
        </div>

        <section className="location-strip">
          <span>{status}</span>
          <button type="button" onClick={() => loadOnDuty()} disabled={loading}>
            {loading ? "Aranıyor..." : "Yenile"}
          </button>
        </section>

        {error ? <p className="settings-error">{error}</p> : null}

        {selected && selectedMapUrl ? (
          <section className="map-card">
            <iframe title={`${selected.name} haritası`} src={selectedMapUrl} loading="lazy" />
          </section>
        ) : null}

        <div className="pharmacy-list">
          {pharmacies.map((pharmacy) => {
            const isActive =
              selected && selected.name === pharmacy.name && selected.address === pharmacy.address;
            return (
              <article
                className={`pharmacy-card ${isActive ? "active" : ""}`}
                key={`${pharmacy.name}-${pharmacy.address}`}
              >
                <div>
                  <h2>{pharmacy.name}</h2>
                  <p>{pharmacy.address}</p>
                  <span>
                    {[pharmacy.district, formatDistance(pharmacy.distance), pharmacy.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {pharmacy.dutyStart || pharmacy.dutyEnd ? (
                    <span className="pharmacy-duty">
                      🕒 Nöbet: {pharmacy.dutyStart || "?"} – {pharmacy.dutyEnd || "?"}
                    </span>
                  ) : null}
                </div>
                <button type="button" onClick={() => setSelected(pharmacy)}>
                  Haritada göster
                </button>
              </article>
            );
          })}
          {!loading && pharmacies.length === 0 ? (
            <div className="empty-state compact">
              {error ? "Tekrar denemek için Yenile'ye dokun." : "Nöbetçi eczane bulunamadı."}
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="view-shell">
      <div className="section-heading">
        <h1>Eczane</h1>
        <span>Nöbetçi ve çevre eczaneler</span>
      </div>

      <button type="button" className="pharmacy-cta" onClick={() => setScreen("onDuty")}>
        <span className="pharmacy-cta-icon">🚑</span>
        <span className="pharmacy-cta-text">
          <strong>Nöbetçi Eczaneleri Gör</strong>
          <small>Konumuna en yakın açık eczaneler</small>
        </span>
        <span className="pharmacy-cta-arrow">›</span>
      </button>

      <div className="section-heading">
        <h2>Çevredeki Eczaneler</h2>
        <span>Konumuna yakın tüm eczaneler</span>
      </div>

      {nearbyMapUrl ? (
        <section className="map-card">
          <iframe title="Çevredeki eczaneler haritası" src={nearbyMapUrl} loading="lazy" />
        </section>
      ) : (
        <div className="empty-state compact">
          {locationError ? (
            <span>
              {locationError}{" "}
              <button type="button" className="pharmacy-back" onClick={retryLocation}>
                Tekrar dene
              </button>
            </span>
          ) : (
            "Harita için konum alınıyor..."
          )}
        </div>
      )}
    </main>
  );
}

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const onDutyCallable = httpsCallable(functions, "onDutyPharmacies");

// Konuma en yakın nöbetçi eczaneleri Cloud Function üzerinden getirir.
export async function fetchOnDutyPharmacies({ latitude, longitude }) {
  try {
    const result = await onDutyCallable({ latitude, longitude });
    const pharmacies = Array.isArray(result?.data?.pharmacies) ? result.data.pharmacies : [];
    return { pharmacies };
  } catch (error) {
    throw new Error(translateError(error));
  }
}

function translateError(error) {
  const code = error?.code || "";
  if (code === "functions/unauthenticated") return "Nöbetçi eczaneleri görmek için giriş yapın.";
  if (code === "functions/resource-exhausted") return error.message || "Sorgu limiti doldu, biraz sonra tekrar deneyin.";
  if (code === "functions/invalid-argument") return error.message || "Konum bilgisi geçersiz.";
  if (code === "functions/unavailable") return "Nöbetçi eczane servisine ulaşılamadı. İnternet bağlantınızı kontrol edin.";
  return error?.message || "Nöbetçi eczaneler alınamadı.";
}

// İki koordinat arasındaki kuş uçuşu mesafe (km) — Haversine formülü.
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

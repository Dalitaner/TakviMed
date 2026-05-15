export const STORAGE_KEYS = {
  medications: "takvimed:medications",
  checked: "takvimed:checked",
  archive: "takvimed:archive",
  settings: "takvimed:settings",
};

export function todayKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `med_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readJson(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeMedicine(med = {}) {
  const times = Array.isArray(med.times) ? med.times : Array.isArray(med.saatler) ? med.saatler : ["08:00"];
  const stock = med.stock ?? med.stok ?? "";
  const initialStock = med.initialStock ?? med.stok_baslangic ?? stock;
  return {
    id: String(med.id || uid()),
    name: med.name || med.ilac_adi || "",
    dose: med.dose || med.doz || "1 tablet",
    foodTiming: med.foodTiming || med.yemek_durumu || "önemli değil",
    times: times.filter(Boolean).sort(),
    duration: med.duration || med.sure || "süresiz",
    stock: stock === "" || stock === null ? "" : Number(stock),
    initialStock: initialStock === "" || initialStock === null ? "" : Number(initialStock),
    expiryDate: med.expiryDate || med.bitis_tarihi || "",
    reminderMinutes: Number(med.reminderMinutes ?? med.hatirlatma_dk ?? 0),
    notes: med.notes || med.ozel_uyarilar || "",
    createdAt: med.createdAt || med.addedAt || new Date().toISOString(),
    updatedAt: med.updatedAt || med.createdAt || med.addedAt || new Date().toISOString(),
  };
}

function toLegacyMedicine(med) {
  return {
    id: med.id,
    ilac_adi: med.name,
    doz: med.dose,
    yemek_durumu: med.foodTiming,
    saatler: med.times,
    sure: med.duration,
    stok: med.stock === "" ? null : med.stock,
    stok_baslangic: med.initialStock === "" ? null : med.initialStock,
    bitis_tarihi: med.expiryDate || null,
    hatirlatma_dk: med.reminderMinutes || 0,
    ozel_uyarilar: med.notes || "",
    addedAt: med.createdAt,
  };
}

export function migrateLegacyData() {
  const existing = readJson(STORAGE_KEYS.medications, null);
  const legacyMeds = readJson("meds", []);
  const legacyChecked = readJson("checked", {});
  const legacyArchive = readJson("meds_archive", []);

  const medications = Array.isArray(existing) && existing.length ? existing.map(normalizeMedicine) : legacyMeds.map(normalizeMedicine);
  const checked = readJson(STORAGE_KEYS.checked, null) || legacyChecked || {};
  const archive = readJson(STORAGE_KEYS.archive, null) || legacyArchive.map(normalizeMedicine);

  persistAll({ medications, checked, archive });
  return { medications, checked, archive };
}

export function persistAll({ medications, checked, archive }) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.medications, JSON.stringify(medications));
  localStorage.setItem(STORAGE_KEYS.checked, JSON.stringify(checked));
  localStorage.setItem(STORAGE_KEYS.archive, JSON.stringify(archive));
  localStorage.setItem("meds", JSON.stringify(medications.map(toLegacyMedicine)));
  localStorage.setItem("checked", JSON.stringify(checked));
  localStorage.setItem("meds_archive", JSON.stringify(archive.map(toLegacyMedicine)));
}

export function createMedication(payload) {
  const normalized = normalizeMedicine(payload);
  return {
    ...normalized,
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function updateMedication(med, patch) {
  return normalizeMedicine({ ...med, ...patch, updatedAt: new Date().toISOString() });
}

export function getDayItems(medications, dateKey = todayKey()) {
  return medications
    .filter((med) => !med.createdAt || med.createdAt.slice(0, 10) <= dateKey)
    .flatMap((med) =>
      (med.times || []).map((time) => ({
        med,
        time,
        key: `${med.id}_${time}`,
      })),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function calculateStockDays(med) {
  if (med.stock === "" || med.stock === null || Number.isNaN(Number(med.stock))) return null;
  const doses = Math.max(1, med.times?.length || 1);
  return Math.floor(Number(med.stock) / doses);
}

export function daysUntil(dateString) {
  if (!dateString) return null;
  const end = new Date(`${dateString}T12:00:00`);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.ceil((end - now) / 86400000);
}

export function buildAlerts(medications, checked) {
  const today = todayKey();
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  const alerts = [];

  medications.forEach((med) => {
    [yesterday, today].forEach((day) => {
      getDayItems([med], day).forEach((item) => {
        const isPast = day < today || (day === today && item.time < nowTime);
        if (isPast && !checked[day]?.[item.key]) {
          alerts.push({
            level: "danger",
            title: `${med.name} alınmadı`,
            detail: `${day === today ? "Bugün" : "Dün"} saat ${item.time}`,
          });
        }
      });
    });

    const stockDays = calculateStockDays(med);
    if (stockDays !== null && stockDays <= 7) {
      alerts.push({
        level: stockDays <= 3 ? "danger" : "warning",
        title: `${med.name} stoğu azalıyor`,
        detail: `${stockDays} gün yetecek stok kaldı`,
      });
    }

    const expiry = daysUntil(med.expiryDate);
    if (expiry !== null && expiry <= 7) {
      alerts.push({
        level: expiry < 0 || expiry <= 3 ? "danger" : "warning",
        title: `${med.name} SKT uyarısı`,
        detail: expiry < 0 ? "Son kullanma tarihi geçti" : `${expiry} gün kaldı`,
      });
    }
  });

  return alerts.slice(0, 6);
}

export function summaryFor(medications, checked, days = 7) {
  const rows = [];
  let totalDose = 0;
  let takenDose = 0;
  let perfectDays = 0;

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = todayKey(date);
    const items = getDayItems(medications, key);
    const taken = items.filter((item) => checked[key]?.[item.key]).length;
    if (items.length && taken === items.length) perfectDays += 1;
    totalDose += items.length;
    takenDose += taken;
    rows.push({ date: key, total: items.length, taken });
  }

  return {
    rows,
    totalDose,
    takenDose,
    missedDose: Math.max(0, totalDose - takenDose),
    perfectDays,
    rate: totalDose ? Math.round((takenDose / totalDose) * 100) : 0,
  };
}

export function syncReminderWorker(medications, checked) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({ type: "SCHEDULE", medications, checked });
    })
    .catch(() => {});
}

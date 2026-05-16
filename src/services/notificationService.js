const notifiedStockKey = "takvimed:lowStockNotified";

function readNotified() {
  try {
    return JSON.parse(localStorage.getItem(notifiedStockKey) || "{}");
  } catch {
    return {};
  }
}

function writeNotified(value) {
  localStorage.setItem(notifiedStockKey, JSON.stringify(value));
}

export async function notifyLowStock(medication, remainingStock) {
  if (!medication || remainingStock >= 5 || remainingStock < 0) return;
  const notified = readNotified();
  const signature = `${medication.id}:${remainingStock}`;
  if (notified[signature]) return;

  const body = `${medication.name} için stoğunuz azalıyor, yalnızca ${remainingStock} adet kaldı. Eczaneye gitme vakti olabilir.`;
  notified[signature] = Date.now();
  writeNotified(notified);

  if (typeof Notification === "undefined") return;
  try {
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("TakviMed stok uyarısı", {
        body,
        tag: `low-stock-${medication.id}`,
        renotify: true,
        icon: "/icon.svg",
      });
    }
  } catch {
    // Notification permission/browser support is best-effort in the web shell.
  }
}

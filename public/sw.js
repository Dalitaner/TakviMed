const CACHE = "takvimed-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = event.request.url;
  if (url.endsWith("/") || url.includes(".html") || url === self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "SCHEDULE") return;
  clearInterval(self._takvimedTimer);
  self._takvimedData = event.data;
  self._takvimedTimer = setInterval(() => {
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const today = new Date().toISOString().slice(0, 10);
    const checked = self._takvimedData.checked || {};
    (self._takvimedData.medications || []).forEach((med) => {
      (med.times || []).forEach((time) => {
        const early = med.reminderMinutes || 0;
        let notifyAt = time;
        if (early > 0) {
          const [h, m] = time.split(":").map(Number);
          const d = new Date();
          d.setHours(h, m - early, 0, 0);
          notifyAt = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        }
        const key = `${med.id}_${time}`;
        if (notifyAt === currentTime && !checked[today]?.[key]) {
          self.registration.showNotification(early ? `${early} dk sonra: ${med.name}` : `İlaç zamanı: ${time}`, {
            body: `${med.name} - ${med.dose || "1 doz"}${med.foodTiming ? ` · ${med.foodTiming}` : ""}`,
            requireInteraction: true,
            tag: `${key}_takvimed`,
            renotify: true,
          });
        }
      });
    });
  }, 60000);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(self.location.origin));
});

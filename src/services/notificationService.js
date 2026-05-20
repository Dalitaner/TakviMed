import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const notifiedStockKey = "takvimed:lowStockNotified";
const MEDICATION_ACTION_TYPE_ID = "TAKVIMED_MED_REMINDER";

let actionTypesRegistered = false;

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

function hashNotificationId(seed) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2147483646 + 1;
}

function shiftClockTime(time, leadMinutes) {
  const [hours, minutes] = String(time).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const total = hours * 60 + minutes - Math.max(0, Number(leadMinutes) || 0);
  const wrapped = ((total % 1440) + 1440) % 1440;
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60 };
}

export function isNativeRuntime() {
  return Capacitor.isNativePlatform();
}

export async function ensureNotificationPermissions() {
  if (isNativeRuntime()) {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") return true;
    if (status.display === "denied") return false;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === "granted";
  }
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function registerMedicationNotificationActions() {
  if (!isNativeRuntime() || actionTypesRegistered) return;
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: MEDICATION_ACTION_TYPE_ID,
        actions: [
          { id: "TAKE", title: "Aldım" },
          { id: "SNOOZE", title: "5 dk ertele" },
        ],
      },
    ],
  });
  actionTypesRegistered = true;
}

export async function syncMedicationReminders(medications, settings) {
  if (!isNativeRuntime()) return;

  const pending = await LocalNotifications.getPending();
  const managedIds = pending.notifications
    .filter((n) => n.extra && n.extra.source === "takvimed-medication")
    .map((n) => ({ id: n.id }));
  if (managedIds.length) {
    await LocalNotifications.cancel({ notifications: managedIds });
  }

  if (settings && settings.reminderNotifications === false) return;

  const globalLead = Number(settings?.reminderLeadMinutes ?? 0);
  const toSchedule = [];

  (medications || []).forEach((med) => {
    if (!med?.id || med.archivedAt) return;
    const lead = Number.isFinite(Number(med.reminderMinutes)) && Number(med.reminderMinutes) > 0
      ? Number(med.reminderMinutes)
      : globalLead;

    (med.times || []).forEach((time) => {
      const slot = shiftClockTime(time, lead);
      if (!slot) return;
      toSchedule.push({
        id: hashNotificationId(`${med.id}__${time}`),
        title: `İlaç zamanı: ${med.name || "İlaç"}`,
        body: [med.dose || "1 doz", med.foodTiming, lead ? `Saat ${time}` : null]
          .filter(Boolean)
          .join(" · "),
        actionTypeId: MEDICATION_ACTION_TYPE_ID,
        sound: undefined,
        smallIcon: "ic_stat_icon_config_sample",
        extra: {
          source: "takvimed-medication",
          medicationId: med.id,
          scheduledTime: time,
        },
        schedule: { on: slot, allowWhileIdle: true },
      });
    });
  });

  if (toSchedule.length) {
    await LocalNotifications.schedule({ notifications: toSchedule });
  }
}

export async function syncFamilyReminders(members, settings) {
  if (!isNativeRuntime()) return;

  const pending = await LocalNotifications.getPending();
  const managedIds = pending.notifications
    .filter((n) => n.extra && n.extra.source === "takvimed-family")
    .map((n) => ({ id: n.id }));
  if (managedIds.length) {
    await LocalNotifications.cancel({ notifications: managedIds });
  }

  if (settings && settings.reminderNotifications === false) return;

  const toSchedule = [];

  (members || []).forEach((member) => {
    if (!member?.uid) return;
    (member.medications || []).forEach((med) => {
      if (!med?.id || med.archivedAt) return;
      (med.times || []).forEach((time) => {
        const slot = shiftClockTime(time, 0);
        if (!slot) return;
        toSchedule.push({
          id: hashNotificationId(`family__${member.uid}__${med.id}__${time}`),
          title: `${member.name || "Yakınınız"} — ilaç saati`,
          body: [med.name || "İlaç", med.dose, `Saat ${time}`].filter(Boolean).join(" · "),
          sound: undefined,
          smallIcon: "ic_stat_icon_config_sample",
          extra: {
            source: "takvimed-family",
            memberUid: member.uid,
          },
          schedule: { on: slot, allowWhileIdle: true },
        });
      });
    });
  });

  if (toSchedule.length) {
    await LocalNotifications.schedule({ notifications: toSchedule });
  }
}

export async function snoozeMedicationReminder({ medication, scheduledTime, minutes = 5 }) {
  if (!isNativeRuntime() || !medication) return;
  const at = new Date(Date.now() + Math.max(1, minutes) * 60_000);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: hashNotificationId(`${medication.id}__snooze__${at.getTime()}`),
        title: `Ertelendi: ${medication.name}`,
        body: [medication.dose || "1 doz", medication.foodTiming, `Asıl saat ${scheduledTime}`]
          .filter(Boolean)
          .join(" · "),
        actionTypeId: MEDICATION_ACTION_TYPE_ID,
        extra: {
          source: "takvimed-medication-snooze",
          medicationId: medication.id,
          scheduledTime,
        },
        schedule: { at, allowWhileIdle: true },
      },
    ],
  });
}

export function subscribeMedicationNotificationActions(handler) {
  if (!isNativeRuntime()) return () => {};
  const pending = LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const actionId = event.actionId;
    const extra = event.notification?.extra || {};
    handler({
      actionId,
      medicationId: extra.medicationId,
      scheduledTime: extra.scheduledTime,
    });
  });
  return () => {
    pending.then((listener) => listener.remove()).catch(() => {});
  };
}

export async function notifyLowStock(medication, remainingStock) {
  if (!medication || remainingStock >= 5 || remainingStock < 0) return;
  const notified = readNotified();
  const signature = `${medication.id}:${remainingStock}`;
  if (notified[signature]) return;

  const body = `${medication.name} için stoğunuz azalıyor, yalnızca ${remainingStock} adet kaldı. Eczaneye gitme vakti olabilir.`;
  notified[signature] = Date.now();
  writeNotified(notified);

  if (isNativeRuntime()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashNotificationId(`lowstock__${signature}`),
            title: "TakviMed stok uyarısı",
            body,
            extra: { source: "takvimed-lowstock", medicationId: medication.id },
            schedule: { at: new Date(Date.now() + 1000) },
          },
        ],
      });
    } catch {
      // best effort
    }
    return;
  }

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

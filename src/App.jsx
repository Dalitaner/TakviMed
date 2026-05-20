import { useEffect, useMemo, useState } from "react";
import AssistantChat from "./components/AssistantChat";
import BottomNav from "./components/BottomNav";
import Header from "./components/Header";
import MascotButton from "./components/MascotButton";
import Modal from "./components/Modal";
import Onboarding from "./components/Onboarding";
import PasswordField from "./components/PasswordField";
import SideMenu from "./components/SideMenu";
import Toast from "./components/Toast";
import Tutorial from "./components/Tutorial";
import { useFamily, useFollowedMembersMedications } from "./hooks/useFamily";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useMedications } from "./hooks/useMedications";
import AddMedicineView from "./views/AddMedicineView";
import AuthView from "./views/AuthView";
import CalendarView from "./views/CalendarView";
import FamilyView from "./views/FamilyView";
import MedicinesView from "./views/MedicinesView";
import PharmacyView from "./views/PharmacyView";
import ScanAddView from "./views/ScanAddView";
import SettingsView from "./views/SettingsView";
import SummaryView from "./views/SummaryView";
import TodayView from "./views/TodayView";
import { todayKey } from "./services/medicationService";
import {
  ensureNotificationPermissions,
  notifyLowStock,
  registerMedicationNotificationActions,
  snoozeMedicationReminder,
  subscribeMedicationNotificationActions,
  syncFamilyReminders,
  syncMedicationReminders,
} from "./services/notificationService";
import {
  loginLocalUser,
  registerLocalUser,
  resetLocalPassword,
  sanitizePin,
  validatePin,
  verifyPin,
  createPinCredential,
  recordFailedAttempt,
  getRateLimit,
  clearRateLimit,
  updateLocalUserPinCredential,
} from "./services/authService";

const defaultSettings = {
  largeText: typeof localStorage !== "undefined" && localStorage.getItem("largeText") === "1",
  pinEnabled: false,
  pinCredential: null,
  darkMode: false,
  reminderNotifications: true,
  reminderLeadMinutes: 10,
  quietStart: "22:00",
  quietEnd: "07:00",
  biometricLock: false,
  language: "Türkçe",
  weeklyEmailReport: false,
};

export default function App() {
  const [settings, setSettings] = useLocalStorage("takvimed:settings", defaultSettings);
  const [profile, setProfile] = useLocalStorage("takvimed:profile", null);
  const meds = useMedications(profile?.uid);
  const [activeView, setActiveView] = useState("calendar");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const family = useFamily({ myUid: profile?.uid, myName: profile?.name });
  const followedMembersMeds = useFollowedMembersMedications(family.following);
  const [pinInput, setPinInput] = useState("");
  const [showLockPin, setShowLockPin] = useState(false);
  const [unlocked, setUnlocked] = useState(() => !settings.pinEnabled || !settings.pinCredential);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem("takvimed:onboardingDone") === "1");
  const [authMessage, setAuthMessage] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("large-text", Boolean(settings.largeText));
    document.documentElement.classList.toggle("dark-mode", Boolean(settings.darkMode));
    localStorage.setItem("largeText", settings.largeText ? "1" : "0");
  }, [settings.largeText, settings.darkMode]);

  useEffect(() => {
    if (!settings.pin || settings.pinCredential) return;
    createPinCredential(settings.pin).then((result) => {
      setSettings((current) => ({ ...current, pinCredential: result.ok ? result.pinCredential : null, pin: "" }));
    });
  }, [settings.pin, settings.pinCredential, setSettings]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (profile && onboardingDone && localStorage.getItem("takvimed:tutorialDone") !== "1") {
      setShowTutorial(true);
    }
  }, [profile, onboardingDone]);

  useEffect(() => {
    ensureNotificationPermissions().catch(() => {});
    registerMedicationNotificationActions().catch(() => {});
  }, []);

  useEffect(() => {
    syncMedicationReminders(meds.medications, {
      reminderNotifications: settings.reminderNotifications,
      reminderLeadMinutes: settings.reminderLeadMinutes,
    }).catch(() => {});
  }, [meds.medications, settings.reminderNotifications, settings.reminderLeadMinutes]);

  useEffect(() => {
    syncFamilyReminders(followedMembersMeds, {
      reminderNotifications: settings.reminderNotifications,
    }).catch(() => {});
  }, [followedMembersMeds, settings.reminderNotifications]);

  useEffect(() => {
    const cleanup = subscribeMedicationNotificationActions(({ actionId, medicationId, scheduledTime }) => {
      if (!medicationId || !scheduledTime) return;
      const medication = meds.medications.find((m) => m.id === medicationId);
      if (!medication) return;
      if (actionId === "TAKE") {
        meds.toggleTaken(todayKey(), `${medicationId}_${scheduledTime}`);
        showToast(`${medication.name} alındı olarak işaretlendi.`);
      } else if (actionId === "SNOOZE") {
        snoozeMedicationReminder({ medication, scheduledTime, minutes: 5 }).catch(() => {});
        showToast(`${medication.name} 5 dakika ertelendi.`);
      }
    });
    return cleanup;
  }, [meds.medications, meds.toggleTaken]);

  const locked = Boolean(profile && settings.pinEnabled && settings.pinCredential && !unlocked);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function saveMedicine(payload) {
    if (editing) {
      meds.editMedication(editing.id, payload);
      setEditing(null);
      setActiveView("medicines");
      showToast("İlaç güncellendi.");
    } else {
      meds.addMedication(payload);
      setActiveView("calendar");
      showToast("İlaç eklendi.");
    }
  }

  function deleteMedicine(id) {
    if (!window.confirm("Bu ilacı silmek istediğinize emin misiniz?")) return;
    meds.deleteMedication(id);
    showToast("İlaç arşive taşındı.");
  }

  const title = useMemo(() => {
    const map = {
      today: "TakviMed",
      medicines: "İlaçlarım",
      add: editing ? "Düzenle" : "İlaç Ekle",
      calendar: "Takvim",
      scan: "Tara / Ekle",
      family: "Aile Takip",
      summary: "Özet",
      assistant: "Asistan",
      pharmacy: "Eczane",
      settings: "Ayarlar",
    };
    return map[activeView] || "TakviMed";
  }, [activeView, editing]);

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  async function register({ username, email, pin, pinConfirm }) {
    if (!username || !email || !pin || !pinConfirm) {
      showToast("Kullanıcı adı, e-posta ve PIN gerekli.");
      return;
    }
    if (pin !== pinConfirm) {
      showToast("PIN alanları eşleşmiyor.");
      return;
    }
    const validation = validatePin(pin);
    if (!validation.valid) {
      showToast(validation.message);
      return;
    }
    const code = generateCode();
    const result = await registerLocalUser({ username, email, pin, code });
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    const user = result.user;
    const nextProfile = { uid: user.uid, name: user.username, email: user.email, emailVerified: user.emailVerified, code, createdAt: user.createdAt };
    setProfile(nextProfile);
    setSettings((current) => ({ ...current, pinEnabled: true, pinCredential: user.pinCredential, pin: "" }));
    setUnlocked(true);
    localStorage.setItem(`takvimed:user:${nextProfile.code}`, JSON.stringify(nextProfile));
    setAuthMessage("Doğrulama e-postası gönderildi. Gelen kutunuzu kontrol edin — gelmediyse Spam / Önemsiz / Promosyon klasörlerine de bakın ve göndereni güvenilir olarak işaretleyin.");
    showToast("Hesap oluşturuldu. E-postanızı doğrulayın (spam klasörüne de bakın).");
  }

  async function login({ username, pin }) {
    const result = await loginLocalUser({ username, pin });
    if (!result.ok) {
      showToast(result.error || "Kullanıcı adı veya PIN hatalı.");
      return;
    }
    const user = result.user;
    setProfile({ uid: user.uid, name: user.username, email: user.email, emailVerified: user.emailVerified, code: user.code, createdAt: user.createdAt });
    setSettings((current) => ({ ...current, pinEnabled: true, pinCredential: user.pinCredential, pin: "" }));
    setUnlocked(true);
    showToast("Giriş yapıldı.");
  }

  async function forgotPassword({ username }) {
    const email = window.prompt("PIN/hesap sıfırlama bağlantısı için e-posta adresinizi girin:", username || "");
    if (!email) {
      showToast("E-posta gerekli.");
      return;
    }
    const result = await resetLocalPassword({ email });
    showToast(result.ok ? "Firebase sıfırlama bağlantısı gönderildiyse gelen kutusu ve spam klasörünüzde görünecek." : result.error);
  }

  function copyCode() {
    const code = profile?.code || "";
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).catch(() => {});
    showToast(`${code} kodu kopyalandı.`);
  }

  function updateSettings(patch) {
    if (patch.pinCredential && profile?.name) updateLocalUserPinCredential(profile.name, patch.pinCredential);
    setSettings((current) => ({ ...current, ...patch }));
  }

  async function followFamily(codeValue) {
    const result = await family.follow(codeValue);
    if (!result?.ok) {
      showToast(result?.error || "Takip eklenemedi.");
      return;
    }
    showToast(`${result.followedName} takip ediliyor.`);
  }

  async function unfollowFamilyMember(theirUid, theirName) {
    await family.unfollow(theirUid);
    showToast(`${theirName || "Yakın"} takipten çıkarıldı.`);
  }

  async function removeFamilyFollower(followerUid, followerName) {
    await family.removeFollower(followerUid);
    showToast(`${followerName || "Takipçi"} kaldırıldı.`);
  }

  async function sendFamilyReminder({ targetUid, targetName, message }) {
    const result = await family.sendReminder({ targetUid, message });
    if (!result?.ok) {
      showToast(result?.error || "Hatırlatma gönderilemedi.");
      return;
    }
    showToast(`${targetName || "Yakın"} hatırlatıldı.`);
  }

  async function dismissFamilyReminder(reminderId) {
    await family.dismissReminder(reminderId);
  }

  function handleToggleTaken(date, key) {
    const day = meds.checked[date] || {};
    const wasTaken = Boolean(day[key]);
    const medId = key.slice(0, key.lastIndexOf("_"));
    const medication = meds.medications.find((med) => med.id === medId);
    const nextStock = medication && medication.stock !== "" && medication.stock !== null ? Math.max(0, Number(medication.stock) + (wasTaken ? 1 : -1)) : null;
    meds.toggleTaken(date, key);
    if (!wasTaken) {
      showToast("İlaç alındı olarak işaretlendi");
      if (nextStock !== null && nextStock < 5) notifyLowStock(medication, nextStock);
    }
  }

  function logout() {
    setProfile(null);
    setDrawerOpen(false);
    setUnlocked(true);
    showToast("Çıkış yapıldı.");
  }

  if (!onboardingDone) {
    return (
      <div className="app-frame">
        <Onboarding
          onDone={() => {
            localStorage.setItem("takvimed:onboardingDone", "1");
            setOnboardingDone(true);
          }}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app-frame">
        <AuthView onRegister={register} onLogin={login} onForgotPassword={forgotPassword} verificationMessage={authMessage} />
        <Toast toast={toast} />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="app-frame lock-frame">
        <section className="pin-card">
          <div className="brand-mark large"><img src="/icon.svg" alt="" /></div>
          <h1>TakviMed</h1>
          <p>Devam etmek için 6 haneli PIN'inizi girin.</p>
          <PasswordField
            autoFocus
            value={pinInput}
            onChange={(event) => setPinInput(sanitizePin(event.target.value))}
            visible={showLockPin}
            onToggle={() => setShowLockPin((value) => !value)}
            placeholder="6 rakam"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength="6"
          />
          <button
            className="primary-button"
            type="button"
            onClick={async () => {
              const limit = getRateLimit("app-lock");
              if (limit.cooldownUntil > Date.now()) {
                const seconds = Math.max(1, Math.ceil((limit.cooldownUntil - Date.now()) / 1000));
                showToast(seconds >= 60 ? `${Math.ceil(seconds / 60)} dakika sonra tekrar deneyin.` : `${seconds} saniye sonra tekrar deneyin.`);
                return;
              }
              if (await verifyPin(pinInput, settings.pinCredential)) {
                clearRateLimit("app-lock");
                setUnlocked(true);
              }
              else {
                setPinInput("");
                showToast(recordFailedAttempt("app-lock").message);
              }
            }}
          >
            Aç
          </button>
          <button
            className="ghost-link"
            type="button"
            onClick={() => {
              if (!window.confirm("PIN'i sıfırlamak için çıkış yapılacak. İlaçlarınız ve aile bağlantılarınız Firestore'da güvende. Devam edilsin mi?")) return;
              setProfile(null);
              setSettings((current) => ({ ...current, pinEnabled: false, pinCredential: null, pin: "" }));
              setPinInput("");
              setUnlocked(true);
              clearRateLimit("app-lock");
            }}
          >
            PIN'imi unuttum / hesap değiştir
          </button>
        </section>
        <Toast toast={toast} />
      </div>
    );
  }

  return (
    <div className="app-frame">
      <Header
        title={title}
        onMenu={() => setDrawerOpen(true)}
      />
      <div className="app-content">
        {activeView === "today" ? <TodayView medications={meds.medications} checked={meds.checked} onToggleTaken={handleToggleTaken} /> : null}
        {activeView === "medicines" ? (
          <MedicinesView
            medications={meds.medications}
            archive={meds.archive}
            onEdit={(med) => {
              setEditing(med);
              setActiveView("add");
            }}
            onDelete={deleteMedicine}
            onNavigateScan={() => setActiveView("scan")}
            onArchiveExpired={(ids) => {
              meds.archiveMedications(ids);
              showToast("Süresi geçmiş ilaçlar arşivlendi.");
            }}
            onDeleteExpired={(ids) => {
              meds.removeMedications(ids);
              showToast("Süresi geçmiş ilaçlar silindi.");
            }}
            onRestore={(id) => {
              meds.restoreMedication(id);
              showToast("İlaç geri alındı.");
            }}
            onStockChange={meds.updateStock}
            onExpiryChange={meds.updateExpiry}
          />
        ) : null}
        {activeView === "scan" ? <ScanAddView onSave={saveMedicine} /> : null}
        {activeView === "add" ? (
          <AddMedicineView initialMedication={editing} onSave={saveMedicine} onCancel={() => { setEditing(null); setActiveView("medicines"); }} />
        ) : null}
        {activeView === "calendar" ? (
          <CalendarView
            medications={meds.medications}
            checked={meds.checked}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onToggleTaken={handleToggleTaken}
          />
        ) : null}
        {activeView === "summary" ? <SummaryView medications={meds.medications} checked={meds.checked} /> : null}
        {activeView === "family" ? (
          <FamilyView
            profile={profile}
            medications={meds.medications}
            checked={meds.checked}
            family={family}
            onFollow={followFamily}
            onUnfollow={unfollowFamilyMember}
            onRemoveFollower={removeFamilyFollower}
            onSendReminder={sendFamilyReminder}
            onDismissReminder={dismissFamilyReminder}
            onCopyCode={copyCode}
          />
        ) : null}
        {activeView === "pharmacy" ? <PharmacyView /> : null}
        {activeView === "assistant" ? (
          <main className="view-shell">
            <div className="section-heading">
              <h1>TakviMed Asistan</h1>
            </div>
            <AssistantChat medications={meds.medications} />
          </main>
        ) : null}
        {activeView === "settings" ? (
          <SettingsView
            settings={settings}
            onChange={updateSettings}
            onLogout={logout}
          />
        ) : null}
      </div>
      <BottomNav activeView={activeView} onChange={(view) => { if (view !== "add") setEditing(null); setActiveView(view); }} />
      <SideMenu
        open={drawerOpen}
        profile={profile}
        activeView={activeView}
        onClose={() => setDrawerOpen(false)}
        onNavigate={setActiveView}
        onCopyCode={copyCode}
        darkMode={settings.darkMode}
        onToggleDark={() => setSettings((current) => ({ ...current, darkMode: !current.darkMode }))}
        onLogout={logout}
      />
      <Modal open={false} title="" onClose={() => {}} />
      {activeView !== "assistant" && !showTutorial ? (
        <MascotButton onClick={() => setActiveView("assistant")} />
      ) : null}
      <Tutorial
        open={showTutorial}
        onNavigate={setActiveView}
        onDrawer={setDrawerOpen}
        onClose={() => {
          localStorage.setItem("takvimed:tutorialDone", "1");
          setDrawerOpen(false);
          setActiveView("calendar");
          setShowTutorial(false);
        }}
      />
      <Toast toast={toast} />
    </div>
  );
}

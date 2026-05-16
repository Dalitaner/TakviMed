import { useEffect, useMemo, useState } from "react";
import AssistantChat from "./components/AssistantChat";
import BottomNav from "./components/BottomNav";
import Header from "./components/Header";
import Modal from "./components/Modal";
import Onboarding from "./components/Onboarding";
import PasswordField from "./components/PasswordField";
import SideMenu from "./components/SideMenu";
import SplashScreen from "./components/SplashScreen";
import Toast from "./components/Toast";
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
import { notifyLowStock } from "./services/notificationService";
import {
  loginLocalUser,
  registerLocalUser,
  requestEmailVerification,
  requestPasswordReset,
  resetLocalPassword,
  sanitizePin,
  validatePin,
  verifyPin,
  createPinCredential,
  recordFailedAttempt,
  getRateLimit,
  clearRateLimit,
  updateLocalUserPinCredential,
  verifyLocalEmail,
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
  const meds = useMedications();
  const [activeView, setActiveView] = useState("calendar");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useLocalStorage("takvimed:settings", defaultSettings);
  const [profile, setProfile] = useLocalStorage("takvimed:profile", null);
  const [family, setFamily] = useLocalStorage("takvimed:family", { following: [], followers: [], reminders: [] });
  const [showSplash, setShowSplash] = useState(() => typeof localStorage === "undefined" || localStorage.getItem("takvimed:splashSeen") !== "1");
  const [pinInput, setPinInput] = useState("");
  const [showLockPin, setShowLockPin] = useState(false);
  const [unlocked, setUnlocked] = useState(() => !settings.pinEnabled || !settings.pinCredential);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem("takvimed:onboardingDone") === "1");
  const [authMessage, setAuthMessage] = useState("");
  const [notificationPreview, setNotificationPreview] = useState(null);

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
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("token");
    if (window.location.pathname.includes("verify-email") && verifyToken) {
      const data = JSON.parse(localStorage.getItem(`takvimed:verify:${verifyToken}`) || "null");
      if (data?.username) {
        const user = verifyLocalEmail(data.username);
        if (profile?.name === data.username) setProfile((current) => ({ ...current, emailVerified: true }));
        setAuthMessage(user ? "E-posta adresiniz doğrulandı." : "Doğrulama bağlantısı geçersiz.");
      }
      window.history.replaceState({}, "", "/");
    }
  }, [profile?.name, setProfile]);

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
    const nextProfile = { name: user.username, email: user.email, emailVerified: user.emailVerified, code, createdAt: user.createdAt };
    setProfile(nextProfile);
    setSettings((current) => ({ ...current, pinEnabled: true, pinCredential: user.pinCredential, pin: "" }));
    setUnlocked(true);
    localStorage.setItem(`takvimed:user:${nextProfile.code}`, JSON.stringify(nextProfile));
    const { verificationLink } = await requestEmailVerification({ username, email });
    setAuthMessage(`Doğrulama e-postası gönderildi. Dev ortamı bağlantısı: ${verificationLink}`);
    showToast("Hesap oluşturuldu. E-postanızı doğrulayın.");
  }

  async function login({ username, pin }) {
    const result = await loginLocalUser({ username, pin });
    if (!result.ok) {
      showToast(result.error || "Kullanıcı adı veya PIN hatalı.");
      return;
    }
    const user = result.user;
    setProfile({ name: user.username, email: user.email, emailVerified: user.emailVerified, code: user.code, createdAt: user.createdAt });
    setSettings((current) => ({ ...current, pinEnabled: true, pinCredential: user.pinCredential, pin: "" }));
    setUnlocked(true);
    showToast("Giriş yapıldı.");
  }

  async function forgotPassword({ username }) {
    const email = window.prompt("PIN sıfırlama için e-posta adresinizi girin:");
    if (!username || !email) {
      showToast("Kullanıcı adı ve e-posta gerekli.");
      return;
    }
    const { resetLink } = await requestPasswordReset({ username, email });
    const nextPin = sanitizePin(window.prompt(`Dev ortamında e-posta linki: ${resetLink}\nYeni 6 haneli PIN'inizi belirleyin:`) || "");
    if (nextPin) {
      const result = await resetLocalPassword({ username, email, pin: nextPin });
      if (result.ok && profile?.name === username) {
        setSettings((current) => ({ ...current, pinCredential: result.user.pinCredential, pin: "" }));
      }
      showToast(result.ok ? "PIN güncellendi." : result.error);
    }
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

  function followFamily(codeValue) {
    const code = String(codeValue || "").trim().toUpperCase();
    if (!code || code === profile.code) {
      showToast("Geçerli bir yakın kodu girin.");
      return;
    }
    setFamily((current) => {
      if (current.following.some((item) => item.code === code)) return current;
      return { ...current, following: [...current.following, { code, name: `Yakın ${code}`, addedAt: new Date().toISOString() }] };
    });
    showToast("Takip isteği yerel olarak eklendi.");
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

  function previewMedicationNotification() {
    const nextItem = meds.todayItems[0];
    if (!nextItem) {
      setNotificationPreview({ title: "TakviMed hatırlatma", body: "İlaç saatiniz geldiğinde bildirim burada böyle görünecek." });
      return;
    }
    setNotificationPreview({
      title: `İlaç zamanı: ${nextItem.time}`,
      body: `${nextItem.med.name} - ${nextItem.med.dose || "1 doz"}${nextItem.med.foodTiming ? ` · ${nextItem.med.foodTiming}` : ""}`,
    });
    window.setTimeout(() => setNotificationPreview(null), 5000);
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
        </section>
        <Toast toast={toast} />
      </div>
    );
  }

  return (
    <div className="app-frame">
      <SplashScreen
        visible={showSplash}
        onDone={() => {
          localStorage.setItem("takvimed:splashSeen", "1");
          localStorage.setItem("splash_seen", "1");
          setShowSplash(false);
        }}
      />
      <Header
        title={title}
        onMenu={() => setDrawerOpen(true)}
      />
      {notificationPreview ? (
        <div className="notification-preview">
          <img src="/icon.svg" alt="" />
          <div>
            <strong>{notificationPreview.title}</strong>
            <span>{notificationPreview.body}</span>
          </div>
        </div>
      ) : null}
      <button className="notification-demo-button" type="button" onClick={previewMedicationNotification}>Bildirim önizle</button>
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
            onCopyCode={copyCode}
            onNudge={() => showToast("Hatırlatma taslağı oluşturuldu. Backend bağlanınca gönderilecek.")}
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
      <Toast toast={toast} />
    </div>
  );
}

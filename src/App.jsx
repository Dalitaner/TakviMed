import { useEffect, useMemo, useState } from "react";
import AssistantChat from "./components/AssistantChat";
import BottomNav from "./components/BottomNav";
import Header from "./components/Header";
import Modal from "./components/Modal";
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

const defaultSettings = {
  largeText: typeof localStorage !== "undefined" && localStorage.getItem("largeText") === "1",
  pinEnabled: false,
  pin: "",
  darkMode: false,
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
  const [unlocked, setUnlocked] = useState(() => !settings.pinEnabled || !settings.pin);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("large-text", Boolean(settings.largeText));
    document.documentElement.classList.toggle("dark-mode", Boolean(settings.darkMode));
    localStorage.setItem("largeText", settings.largeText ? "1" : "0");
  }, [settings.largeText, settings.darkMode]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const locked = Boolean(profile && settings.pinEnabled && settings.pin && !unlocked);

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

  function register({ name, pin }) {
    const nextProfile = { name, code: generateCode(), createdAt: new Date().toISOString() };
    setProfile(nextProfile);
    setSettings((current) => ({ ...current, pinEnabled: Boolean(pin), pin }));
    setUnlocked(true);
    localStorage.setItem(`takvimed:user:${nextProfile.code}`, JSON.stringify(nextProfile));
    showToast("Hoş geldiniz.");
  }

  function login({ code, pin }) {
    const stored = localStorage.getItem(`takvimed:user:${code}`);
    if (!stored) {
      showToast("Bu cihazda kayıtlı kullanıcı bulunamadı.");
      return;
    }
    if (settings.pin && pin !== settings.pin) {
      showToast("PIN hatalı.");
      return;
    }
    setProfile(JSON.parse(stored));
    setUnlocked(true);
    showToast("Giriş yapıldı.");
  }

  function copyCode() {
    const code = profile?.code || "";
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).catch(() => {});
    showToast(`${code} kodu kopyalandı.`);
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

  if (!profile) {
    return (
      <div className="app-frame">
        <AuthView onRegister={register} onLogin={login} />
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
          <p>Devam etmek için PIN girin.</p>
          <span className="password-field">
            <input
              autoFocus
              type={showLockPin ? "text" : "password"}
              inputMode="numeric"
              maxLength="4"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
            />
            <button type="button" onClick={() => setShowLockPin((value) => !value)} aria-label={showLockPin ? "PIN'i gizle" : "PIN'i göster"}>
              {showLockPin ? "○" : "◉"}
            </button>
          </span>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              if (pinInput === settings.pin) setUnlocked(true);
              else {
                setPinInput("");
                showToast("PIN hatalı.");
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
        onAssistant={() => {
          setEditing(null);
          setActiveView("assistant");
        }}
        onSettings={() => setActiveView("settings")}
      />
      <div className="app-content">
        {activeView === "today" ? <TodayView medications={meds.medications} checked={meds.checked} onToggleTaken={meds.toggleTaken} /> : null}
        {activeView === "medicines" ? (
          <MedicinesView
            medications={meds.medications}
            archive={meds.archive}
            onEdit={(med) => {
              setEditing(med);
              setActiveView("add");
            }}
            onDelete={deleteMedicine}
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
            onToggleTaken={meds.toggleTaken}
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
              <span>Gemini backend hazır</span>
            </div>
            <AssistantChat medications={meds.medications} />
          </main>
        ) : null}
        {activeView === "settings" ? (
          <SettingsView
            settings={settings}
            onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
            onResetSplash={() => {
              localStorage.removeItem("takvimed:splashSeen");
              setShowSplash(true);
            }}
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
        onLogout={() => {
          setProfile(null);
          setDrawerOpen(false);
          setUnlocked(true);
        }}
      />
      <Modal open={false} title="" onClose={() => {}} />
      <Toast toast={toast} />
    </div>
  );
}

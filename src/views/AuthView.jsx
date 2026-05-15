import { useState } from "react";

export default function AuthView({ onRegister, onLogin }) {
  const [mode, setMode] = useState("register");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (mode === "register") onRegister({ name: name.trim() || "TakviMed Kullanıcısı", pin });
    else onLogin({ code: code.trim().toUpperCase(), pin });
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand-mark large"><img src="/icon.svg" alt="TakviMed" /></div>
        <p>İlaçlarınızı ve sevdiklerinizin takibini güvenle yönetin.</p>
        <div className="segment-control">
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>Kaydol</button>
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>Giriş yap</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <label className="field-label">
              Adınız
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Derya" />
            </label>
          ) : (
            <label className="field-label">
              Kullanıcı kodu
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Örn. MQ1TB5" />
            </label>
          )}
          <label className="field-label">
            PIN
            <span className="password-field">
              <input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength="4"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4 haneli"
              />
              <button type="button" onClick={() => setShowPin((value) => !value)} aria-label={showPin ? "PIN'i gizle" : "PIN'i göster"}>
                {showPin ? "○" : "◉"}
              </button>
            </span>
          </label>
          <button className="primary-button" type="submit">{mode === "register" ? "Hesap oluştur" : "Giriş yap"}</button>
        </form>
      </section>
    </main>
  );
}

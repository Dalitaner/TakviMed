import { useState } from "react";
import PasswordField from "../components/PasswordField";
import { sanitizePin } from "../services/authService";

export default function AuthView({ onRegister, onLogin, onForgotPassword, verificationMessage }) {
  const [mode, setMode] = useState("register");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (mode === "register") onRegister({ username: username.trim(), email: email.trim(), pin, pinConfirm });
    else onLogin({ username: username.trim(), pin });
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand-mark large"><img src="/icon.svg" alt="TakviMed" /></div>
        <h1 className="auth-brand-title">TakviMed</h1>
        <p>İlaçlarınızı ve sevdiklerinizin takibini güvenle yönetin.</p>
        <div className="segment-control">
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>Kaydol</button>
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>Giriş yap</button>
        </div>
        {verificationMessage ? <div className="auth-info-box">{verificationMessage}</div> : null}
        <form className="auth-form" onSubmit={submit}>
          <label className="field-label">
            {mode === "register" ? "Kullanıcı adı" : "E-posta"}
            <input
              type={mode === "login" ? "email" : "text"}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          {mode === "register" ? (
            <label className="field-label">
              E-posta
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@mail.com" required />
            </label>
          ) : null}
          <label className="field-label">
            6 haneli PIN
            <PasswordField
              value={pin}
              onChange={(event) => setPin(sanitizePin(event.target.value))}
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              placeholder="6 rakam"
              inputMode="numeric"
              pattern="[0-9]*"
              minLength="6"
              maxLength="6"
              required
            />
          </label>
          {mode === "register" ? (
            <label className="field-label">
              PIN tekrar
              <PasswordField
                value={pinConfirm}
                onChange={(event) => setPinConfirm(sanitizePin(event.target.value))}
                visible={showPinConfirm}
                onToggle={() => setShowPinConfirm((value) => !value)}
                placeholder="PIN'i tekrar girin"
                inputMode="numeric"
                pattern="[0-9]*"
                minLength="6"
                maxLength="6"
                required
              />
            </label>
          ) : null}
          {mode === "login" ? (
            <button className="link-button" type="button" onClick={() => onForgotPassword({ username: username.trim() })}>PIN'ini mi unuttun?</button>
          ) : (
            <p className="auth-note">Kaydolduğunuzda e-posta adresinize hesabınızı doğrulamanız için bir onay bağlantısı gönderilir. Bu işlem hesap güvenliği ve KVKK uyumlu açık kimlik doğrulama amacıyla yapılır.</p>
          )}
          <button className="primary-button" type="submit">{mode === "register" ? "Hesap oluştur" : "Giriş yap"}</button>
        </form>
      </section>
    </main>
  );
}

export default function PasswordField({
  value,
  onChange,
  visible,
  onToggle,
  placeholder = "Şifreniz",
  autoFocus = false,
  minLength,
  maxLength,
  inputMode,
  pattern,
  required = false,
  autoComplete = "off",
}) {
  return (
    <span className="password-field">
      <input
        autoFocus={autoFocus}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={maxLength}
        inputMode={inputMode}
        pattern={pattern}
        required={required}
        autoComplete={autoComplete}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      <button type="button" onClick={onToggle} aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}>
        {visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </span>
  );
}

function EyeIcon() {
  return (
    <svg className="eye-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.4 12s3.6-6 9.6-6 9.6 6 9.6 6-3.6 6-9.6 6-9.6-6-9.6-6Z" />
      <circle cx="12" cy="12" r="3.15" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="eye-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.4 12s3.6-6 9.6-6 9.6 6 9.6 6-3.6 6-9.6 6-9.6-6-9.6-6Z" />
      <circle cx="12" cy="12" r="3.15" />
      <path className="eye-slash" d="M4 20 20 4" />
    </svg>
  );
}

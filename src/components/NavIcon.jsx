export default function NavIcon({ id }) {
  if (id === "calendar") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <rect x="5" y="7" width="18" height="16" rx="4" />
        <path d="M9 5v5M19 5v5M5 12h18M10 17h.1M14 17h.1M18 17h.1" />
      </svg>
    );
  }
  if (id === "scan") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M7 11V8a1 1 0 0 1 1-1h3M17 7h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M11 21H8a1 1 0 0 1-1-1v-3M14 10v8M10 14h8" />
      </svg>
    );
  }
  if (id === "medicines") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <rect x="9" y="4" width="10" height="20" rx="5" />
        <path d="M9 14h10" />
      </svg>
    );
  }
  if (id === "family") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="11" cy="10" r="3" />
        <circle cx="18.5" cy="9" r="2.5" />
        <path d="M5.5 22c.8-4 2.8-6 5.5-6s4.7 2 5.5 6M15.5 16.5c2.7.2 4.5 2 5 5.5" />
      </svg>
    );
  }
  if (id === "summary") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M6 8h10M6 14h13M6 20h8" />
        <circle cx="20" cy="20" r="4" />
        <path d="m18.5 20 1 1 2-2" />
      </svg>
    );
  }
  if (id === "assistant") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M9 17.5c-2 0-3.5-1.5-3.5-3.5S7 10.5 9 10.5h.4C10 8 12 6.5 14.5 6.5c2.8 0 5 2.1 5.2 4.8 1.7.4 2.8 1.8 2.8 3.5 0 2-1.6 3.7-3.7 3.7H18" />
        <path d="M11 20h6M12 23h4M14 12v5M11.5 14.5h5" />
      </svg>
    );
  }
  if (id === "settings") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M5 8h10M19 8h4M5 14h4M13 14h10M5 20h12M21 20h2" />
        <circle cx="17" cy="8" r="2" />
        <circle cx="11" cy="14" r="2" />
        <circle cx="19" cy="20" r="2" />
      </svg>
    );
  }
  if (id === "copy") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <rect x="10" y="8" width="12" height="15" rx="3" />
        <path d="M6 18V7a2 2 0 0 1 2-2h10" />
      </svg>
    );
  }
  if (id === "light") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="4.5" />
        <path d="M14 3.5v3M14 21.5v3M3.5 14h3M21.5 14h3M6.6 6.6l2.1 2.1M19.3 19.3l2.1 2.1M6.6 21.4l2.1-2.1M19.3 8.7l2.1-2.1" />
      </svg>
    );
  }
  if (id === "dark") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M20.5 18.5A8 8 0 0 1 9.5 7.5 8.5 8.5 0 1 0 20.5 18.5Z" />
      </svg>
    );
  }
  if (id === "logout") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M12 5H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
        <path d="M16 9l5 5-5 5M21 14H10" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M6 23V10l8-5 8 5v13H6Z" />
      <path d="M14 10v8M10 14h8M11 23v-4h6v4" />
    </svg>
  );
}

import { useState } from "react";

const slides = [
  {
    title: "İlaçlarını Asla Unutma",
    subtitle: "Reçeteni tarat, alarmlarını otomatik kur.",
    type: "bell",
  },
  {
    title: "Reçeteni Tarat",
    subtitle: "Kamera ile reçeteni çek, yapay zeka ilaçlarını tanısın.",
    type: "scan",
  },
  {
    title: "Ailenle Takip Et",
    subtitle: "Yakınlarının ilaçlarını anlık olarak takip edebilirsin.",
    type: "family",
  },
  {
    title: "Asistanına Sor",
    subtitle: "İlaçların hakkında merak ettiğin her şeyi asistana sor.",
    type: "assistant",
  },
];

export default function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0);
  const [startX, setStartX] = useState(null);
  const slide = slides[index];

  function next() {
    if (index === slides.length - 1) onDone();
    else setIndex((current) => current + 1);
  }

  function onTouchEnd(event) {
    if (startX === null) return;
    const delta = event.changedTouches[0].clientX - startX;
    if (delta < -40 && index < slides.length - 1) setIndex(index + 1);
    if (delta > 40 && index > 0) setIndex(index - 1);
    setStartX(null);
  }

  return (
    <main
      className="onboarding-screen"
      onTouchStart={(event) => setStartX(event.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      <button className="onboarding-skip" type="button" onClick={onDone}>Atla</button>
      <section className="onboarding-slide">
        <OnboardingArt type={slide.type} />
        <h1>{slide.title}</h1>
        <p>{slide.subtitle}</p>
      </section>
      <div className="onboarding-footer">
        <div className="onboarding-dots">
          {slides.map((item, dotIndex) => <span className={dotIndex === index ? "active" : ""} key={item.title} />)}
        </div>
        <button className="primary-button" type="button" onClick={next}>{index === slides.length - 1 ? "Başla" : "Devam"}</button>
      </div>
    </main>
  );
}

function OnboardingArt({ type }) {
  return (
    <svg className="onboarding-art" viewBox="0 0 180 180" aria-hidden="true">
      <defs>
        <linearGradient id={`ob-${type}`} x1="30" x2="150" y1="30" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E88C8" />
          <stop offset="1" stopColor="#58C66B" />
        </linearGradient>
      </defs>
      <circle cx="90" cy="90" r="76" fill="rgba(255,255,255,.18)" />
      {type === "bell" ? (
        <>
          <path d="M58 113h64M69 113V82c0-18 12-31 21-31s21 13 21 31v31" stroke={`url(#ob-${type})`} strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M78 125c5 8 19 8 24 0" stroke="white" strokeWidth="8" strokeLinecap="round" />
        </>
      ) : null}
      {type === "scan" ? (
        <>
          <path d="M52 76V55h21M107 55h21v21M128 104v21h-21M73 125H52v-21" stroke={`url(#ob-${type})`} strokeWidth="9" strokeLinecap="round" fill="none" />
          <rect x="73" y="72" width="35" height="62" rx="17" fill={`url(#ob-${type})`} />
          <path d="M73 103h35" stroke="white" strokeWidth="7" />
        </>
      ) : null}
      {type === "family" ? (
        <>
          <circle cx="74" cy="75" r="18" fill={`url(#ob-${type})`} />
          <circle cx="113" cy="80" r="15" fill="rgba(255,255,255,.78)" />
          <path d="M45 132c5-25 17-37 31-37s26 12 31 37M95 130c4-20 14-30 28-30 10 0 19 8 24 25" stroke="white" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M132 54v24M120 66h24" stroke="#58C66B" strokeWidth="8" strokeLinecap="round" />
        </>
      ) : null}
      {type === "assistant" ? (
        <>
          <path d="M55 105c-12 0-21-9-21-21s9-21 21-21h2c4-16 17-25 33-25 18 0 32 13 34 30 12 3 20 13 20 25 0 14-11 26-26 26h-8" stroke="white" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M75 127h34M82 143h20M91 72v36M73 90h36" stroke={`url(#ob-${type})`} strokeWidth="9" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}

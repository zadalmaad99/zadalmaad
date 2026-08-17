import { useState } from "react";

const DISMISS_KEY = "braveBannerDismissed";

const LINKS = [
  {
    label: "أندرويد",
    url: "https://play.google.com/store/apps/details?id=com.brave.browser",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 20.5V3.5a1 1 0 0 1 1.53-.85l13.4 8.5a1 1 0 0 1 0 1.7l-13.4 8.5A1 1 0 0 1 3 20.5Z" />
      </svg>
    ),
  },
  {
    label: "آيفون",
    url: "https://apps.apple.com/iq/app/brave-browser-private-web/id1052879175",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.7 1.5c.1 1.1-.3 2.2-1 3-.7.9-1.9 1.6-3 1.5-.1-1.1.4-2.2 1.1-3 .7-.8 2-1.4 2.9-1.5ZM20.8 17c-.5 1.2-.8 1.7-1.5 2.7-1 1.4-2.4 3.2-4.1 3.2-1.5 0-1.9-1-3.9-1-2 0-2.5 1-3.9.9-1.7 0-3-1.6-4-3-2.7-3.9-3-8.4-1.3-10.8 1.2-1.7 3-2.7 4.7-2.7 1.7 0 2.8 1 4.2 1 1.4 0 2.2-1 4.2-1 1.5 0 3.1.8 4.3 2.3-3.8 2.1-3.2 7.5.3 9Z" />
      </svg>
    ),
  },
  {
    label: "الحاسوب",
    url: "https://brave.com/download/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
];

export default function BraveBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="brave-card-wrap">
      <div className="brave-card">
        <button type="button" className="brave-card-close" onClick={handleDismiss} aria-label="إغلاق">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="brave-card-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4Zm0 2.2 7 3.1v4.7c0 4.6-3 8.8-7 9.9-4-1.1-7-5.3-7-9.9V6.3l7-3.1Z" />
            <path d="M12 6.5 8 8.6v3.2c0 2.9 1.7 5.5 4 6.2 2.3-.7 4-3.3 4-6.2V8.6L12 6.5Z" opacity="0.55" />
          </svg>
        </div>

        <div className="brave-card-body">
          <p className="brave-card-title">لمنع الإعلانات المزعجة على يوتيوب</p>
          <p className="brave-card-desc">
            استخدم متصفح <strong>Brave</strong> — يحظر الإعلانات تلقائيًا ويجعل مشاهدة الدروس أسرع وأنظف. حمّله مجانًا من الرابط المناسب لجهازك:
          </p>
          <div className="brave-card-links">
            {LINKS.map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="brave-card-link">
                {l.icon}
                <span>{l.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

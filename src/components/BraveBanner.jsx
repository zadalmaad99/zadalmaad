import { useEffect, useState } from "react";

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
  // Closing it only hides it for the current visit — a refresh brings the
  // reminder back, since the point is to keep nudging until the reader
  // actually switches. The one thing that retires it for good is opening
  // the app in Brave, which is exactly what it's asking for.
  const [dismissed, setDismissed] = useState(false);
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    // Clear the old permanent flag so anyone who dismissed it back when
    // that was forever starts seeing the reminder again.
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      // storage unavailable — nothing to clean up
    }
    let cancelled = false;
    navigator.brave
      ?.isBrave?.()
      .then((v) => {
        if (!cancelled) setIsBrave(!!v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || isBrave) return null;

  function handleDismiss() {
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
          {/* Stylized lion-shield mark, in the spirit of Brave's own logo */}
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1 3 4.5v6.3c0 5.9 3.8 10.9 9 12.2 5.2-1.3 9-6.3 9-12.2V4.5L12 1Z" />
            <path
              d="M12 5.3 6.7 7.4v3.4c0 4 2.4 7.5 5.3 8.6 2.9-1.1 5.3-4.6 5.3-8.6V7.4L12 5.3Z"
              fill="#fff"
              opacity="0.9"
            />
            <path d="M9 10.2c1 .6 2 1.7 3 1.7s2-1.1 3-1.7c-.7 2.3-1.7 5-3 6.6-1.3-1.6-2.3-4.3-3-6.6Z" fill="currentColor" />
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
          <p className="brave-card-note">
            بعض الأحيان لا تفتح الروابط مباشرة — في هذه الحالة ابحث بنفسك في متجر التطبيقات عن اسم التطبيق:{" "}
            <strong dir="ltr">Brave</strong> — عبر <strong dir="ltr">Google Play</strong> (أندرويد) أو{" "}
            <strong dir="ltr">App Store</strong> (آيفون).
          </p>
        </div>
      </div>
    </div>
  );
}

const PHONE_DOMAIN = "phone.quran-tracker.app";

export function toLoginEmail(input) {
  const trimmed = input.trim();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, "");
  return `${digits}@${PHONE_DOMAIN}`;
}

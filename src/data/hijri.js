const ISLAMIC_EPOCH = 1948440;

export const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

function gregorianToJD(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdToGregorian(jd) {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function civilToJD(year, month, day) {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    ISLAMIC_EPOCH -
    1
  );
}

function jdToCivil(jd) {
  const year = Math.floor((30 * (jd - ISLAMIC_EPOCH) + 10646) / 10631);
  const month = Math.min(
    12,
    Math.ceil((jd - (29 + civilToJD(year, 1, 1))) / 29.5) + 1
  );
  const day = jd - civilToJD(year, month, 1) + 1;
  return { year, month, day };
}

export function gregorianToHijri(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const jd = gregorianToJD(y, m, d);
  return jdToCivil(jd);
}

export function hijriToGregorian(year, month, day) {
  const jd = civilToJD(year, month, day);
  const { year: gy, month: gm, day: gd } = jdToGregorian(jd);
  return `${gy.toString().padStart(4, "0")}-${gm.toString().padStart(2, "0")}-${gd
    .toString()
    .padStart(2, "0")}`;
}

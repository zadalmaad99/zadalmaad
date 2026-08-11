import {
  ARAB_COUNTRIES,
  ISLAMIC_COUNTRIES,
  OTHER_COUNTRIES,
  splitPhone,
} from "../data/countries";

export default function PhoneInput({ value, onChange }) {
  const { dial, local } = splitPhone(value);

  function handleDialChange(e) {
    onChange(`${e.target.value}${local}`);
  }

  function handleLocalChange(e) {
    const cleaned = e.target.value.replace(/[^\d]/g, "");
    onChange(`${dial}${cleaned}`);
  }

  return (
    <div className="phone-input">
      <select value={dial} onChange={handleDialChange} className="phone-dial">
        <optgroup label="الدول العربية">
          {ARAB_COUNTRIES.map((c) => (
            <option key={`ar-${c.dial}-${c.name}`} value={c.dial}>
              {c.flag} +{c.dial} {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="دول إسلامية أخرى">
          {ISLAMIC_COUNTRIES.map((c) => (
            <option key={`is-${c.dial}-${c.name}`} value={c.dial}>
              {c.flag} +{c.dial} {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="دول أخرى">
          {OTHER_COUNTRIES.map((c) => (
            <option key={`ot-${c.dial}-${c.name}`} value={c.dial}>
              {c.flag} +{c.dial} {c.name}
            </option>
          ))}
        </optgroup>
      </select>
      <input
        type="tel"
        className="phone-local"
        placeholder="رقم الهاتف"
        value={local}
        onChange={handleLocalChange}
      />
    </div>
  );
}

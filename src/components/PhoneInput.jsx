import {
  ARAB_COUNTRIES,
  ISLAMIC_COUNTRIES,
  CONTINENTS,
  splitPhone,
} from "../data/countries";

export default function PhoneInput({ value, onChange }) {
  const { dial, local } = splitPhone(value);

  function handleDialChange(e) {
    onChange(`${e.target.value}${local}`);
  }

  function handleLocalChange(e) {
    const cleaned = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
    onChange(`${dial}${cleaned}`);
  }

  return (
    <div className="phone-input">
      <select value={dial} onChange={handleDialChange} className="phone-dial">
        <optgroup label="الدول العربية">
          {ARAB_COUNTRIES.map((c) => (
            <option key={`ar-${c.dial}-${c.name}`} value={c.dial}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </optgroup>
        <optgroup label="دول إسلامية أخرى">
          {ISLAMIC_COUNTRIES.map((c) => (
            <option key={`is-${c.dial}-${c.name}`} value={c.dial}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </optgroup>
        {Object.entries(CONTINENTS).map(([continent, countries]) => (
          <optgroup key={continent} label={continent}>
            {countries.map((c) => (
              <option key={`${continent}-${c.dial}-${c.name}`} value={c.dial}>
                {c.flag} +{c.dial}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        className="phone-local"
        placeholder="رقم الهاتف"
        value={local}
        onChange={handleLocalChange}
        maxLength={11}
      />
    </div>
  );
}

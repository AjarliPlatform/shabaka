// Translation, plural rules and number formatting. Locale files call I18n.add().
(function (root) {
  const locales = {};
  const fallback = "en";
  let lang = fallback;

  function add(code, data) { locales[code] = data; }
  function supported() { return Object.keys(locales); }
  function current() { return lang; }
  function meta(code = lang) { return locales[code].meta; }

  function detect(saved, preferred) {
    const wanted = [saved, ...(preferred || [])].filter(Boolean).map(code => code.toLowerCase());
    for (const code of wanted) {
      if (locales[code]) return code;
      const base = code.split("-")[0];
      if (locales[base]) return base;
    }
    return fallback;
  }

  function set(code) {
    lang = locales[code] ? code : fallback;
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = meta().dir;
    }
    return lang;
  }

  const numberFormat = options => new Intl.NumberFormat(meta().numberLocale || lang, options);
  const number = value => numberFormat().format(value);
  function time(seconds) {
    const two = numberFormat({ minimumIntegerDigits: 2, useGrouping: false });
    return `${two.format(seconds / 60 | 0)}:${two.format(seconds % 60)}`;
  }

  function lookup(key) {
    const own = locales[lang] && locales[lang].strings[key];
    if (own !== undefined) return own;
    const base = locales[fallback] && locales[fallback].strings[key];
    return base !== undefined ? base : key;
  }

  function t(key, params = {}) {
    let text = lookup(key);
    if (typeof text === "object") {
      const category = new Intl.PluralRules(lang).select(params.count);
      text = text[category] !== undefined ? text[category] : text.other;
    }
    return text.replace(/\{(\w+)\}/g, (match, name) => {
      if (!(name in params)) return match;
      return typeof params[name] === "number" ? number(params[name]) : params[name];
    });
  }

  root.I18n = { add, supported, current, meta, detect, set, number, time, t };
})(typeof window !== "undefined" ? window : globalThis);

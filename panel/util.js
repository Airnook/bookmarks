// Мелочи общего назначения без DOM и состояния панели.

export const ignore = () => {};
export const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

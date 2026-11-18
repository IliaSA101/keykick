/** Номер версии `X.Y.Z` (цифры до 4 знаков): одна проверка для раздела `seen` и «Что нового» (063 Т11). */
export const VERSION_RE = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

export const isVersion = (v: unknown): v is string => typeof v === 'string' && VERSION_RE.test(v);

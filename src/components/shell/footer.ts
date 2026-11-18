/** Строка низа: чистые куски — урезание имени и адрес старой версии. */

/** Имя в строке низа: длиннее `max` знаков — урезаем по знакам с многоточием (css-многоточие рубило после пробела). */
export function clipName(name: string, max = 20): string {
  return name.length > max ? `${name.slice(0, max).trimEnd()}…` : name;
}

/**
 * Адрес старой версии от адреса сборки: `/keykick/` и `/keykick/next/` → `/keykick/v1/`; корень (dev) → `/v1/`
 * (v1 заморожена в своей папке, 059-В2: хранилище то же, достижения целы).
 */
export function oldVersionUrl(base: string): string {
  return `${base.replace(/(?:next\/)?$/, '')}v1/`;
}

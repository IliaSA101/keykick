// Замер мелкого на живом экране (065-Р184): текст мельче порога и точки уроков мельче порога — в px итоговой сцены.
// collectScreen крутится внутри страницы (playwright evaluate): ничего не берёт снаружи, отдаёт простые данные.
// findSmall и formatSmall — чистые: по данным замера и порогам решают, что мелко, и печатают итог.

/** Порог 065-Р184 (б): на 1024 текст ≥ 12 px, точки уроков ≥ 8 px. */
export const MIN_TEXT = 12
export const MIN_DOT = 8
/** Точки уроков: `.pip` на Карте, `.dots > i` в плашках места и шкале ступеней. */
export const DOT_SELECTOR = '.pip, .dots > i'

/** В странице: видимые текстовые узлы (размер шрифта × масштаб сцены) и точки (меньшая сторона рамки, px). */
export function collectScreen(dotSelector) {
  const scale = Math.min(innerWidth / 1024, innerHeight / 640)
  const visible = (el, r) => {
    if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return false
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
    }
    return true
  }
  const path = (el) => {
    const parts = []
    for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement) {
      parts.unshift(e.tagName.toLowerCase() + [...e.classList].slice(0, 2).map((c) => '.' + c).join(''))
    }
    return parts.join(' > ')
  }
  const text = []
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.textContent.replace(/\s+/g, ' ').trim()
    const el = n.parentElement
    if (!s || !el || seen.has(el) || ['SCRIPT', 'STYLE', 'TITLE'].includes(el.tagName)) continue
    const range = document.createRange()
    range.selectNodeContents(n)
    const r = range.getBoundingClientRect()
    if (!visible(el, r)) continue
    seen.add(el)
    const own = parseFloat(getComputedStyle(el).fontSize)
    // SVG-текст: размер в единицах viewBox, итог — через матрицу экрана; HTML — через масштаб сцены (zoom).
    const px = el instanceof SVGElement && el.getScreenCTM ? own * (el.getScreenCTM()?.a ?? 1) : own * scale
    text.push({ text: s.slice(0, 40), px: Math.round(px * 100) / 100, where: path(el) })
  }
  const dots = []
  for (const el of document.querySelectorAll(dotSelector)) {
    const r = el.getBoundingClientRect()
    if (!visible(el, r)) continue
    dots.push({ px: Math.round(Math.min(r.width, r.height) * 100) / 100, where: path(el) })
  }
  return { scale, text, dots }
}

/** Что мельче порогов. Равный порогу — не мелко (12 px при пороге 12 — норма). Допуск 0,05 px на округление. */
export function findSmall(scan, { minText = MIN_TEXT, minDot = MIN_DOT } = {}) {
  const eps = 0.05
  return {
    text: scan.text.filter((t) => t.px < minText - eps),
    dots: scan.dots.filter((d) => d.px < minDot - eps),
  }
}

/** Строки итога: «код · мельче 12: N узлов · точек мельче 8: M» и список по строке на узел. */
export function formatSmall(code, small, { minText = MIN_TEXT, minDot = MIN_DOT, seen = null } = {}) {
  const all = seen ? ` · просмотрено: ${seen.text.length} текстовых, ${seen.dots.length} точек` : ''
  const head = `${code} · мельче ${minText}: ${small.text.length} узлов · точек мельче ${minDot}: ${small.dots.length}${all}`
  const rows = [
    ...small.text.map((t) => `    «${t.text}» ${t.px} px · ${t.where}`),
    ...small.dots.map((d) => `    точка ${d.px} px · ${d.where}`),
  ]
  return [head, ...rows].join('\n')
}

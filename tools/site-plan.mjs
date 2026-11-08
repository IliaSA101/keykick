// План сборки сайта по site.json (спека 013, design.md §2): чистая функция, без файлов и git.
// Ошибка в указателе — исключение: build-site падает целиком и ничего не выкладывается.

const SITE = '/keykick/';
const VERSION_KEY = /^v([0-9]+)$/;
const TAG = /^v([0-9]+)\.([0-9]+)\.([0-9]+)$/;
// Заморожена: код живого сайта сына, ТЗ-12.1.
const FROZEN = { v1: 'v0.10.1' };

/**
 * @param {{ root: string, versions: Record<string, string> }} site
 * @returns {Array<{ name: string, ref: string | null, base: string, dir: string, channel: 'release' | 'next' | null }>}
 */
export function sitePlan(site) {
  const versions = site?.versions;
  if (!versions || typeof versions !== 'object' || Object.keys(versions).length === 0) {
    throw new Error('site.json: нет versions');
  }
  const channelOf = {};
  for (const [key, tag] of Object.entries(versions)) {
    const k = VERSION_KEY.exec(key);
    if (!k) throw new Error(`site.json: ключ «${key}» не вида vN`);
    const t = TAG.exec(String(tag));
    if (!t) throw new Error(`site.json: метка «${tag}» не вида vA.B.C`);
    const major = Number(k[1]);
    if (key in FROZEN && tag !== FROZEN[key]) {
      throw new Error(`site.json: ${key} заморожена на ${FROZEN[key]}, а не ${tag}`);
    }
    if (major >= 2 && Number(t[1]) !== major) {
      throw new Error(`site.json: ${key} должна указывать на метку v${major}.x.x, а не ${tag}`);
    }
    // Метки линии v1 собираются без переменной (в их коде её нет), v2+ — выпуск.
    channelOf[key] = major >= 2 ? 'release' : null;
  }
  if (!(site.root in versions)) throw new Error(`site.json: root «${site.root}» нет среди versions`);

  const builds = [{ name: 'next', ref: null, base: `${SITE}next/`, dir: 'next', channel: 'next' }];
  for (const [key, tag] of Object.entries(versions)) {
    builds.push({ name: key, ref: tag, base: `${SITE}${key}/`, dir: key, channel: channelOf[key] });
  }
  builds.push({ name: 'root', ref: versions[site.root], base: SITE, dir: '', channel: channelOf[site.root] });
  return builds;
}

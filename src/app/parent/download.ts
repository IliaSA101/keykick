/** Файл на скачивание (выгрузка клуба, 063 Т11): единственное место с `Blob` и ссылкой-скачиванием. Не бросает; `false` — браузер не дал. */
export function saveTextFile(name: string, text: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

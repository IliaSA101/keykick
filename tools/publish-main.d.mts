// Типы для тестов: чистые функции стража публикации tools/publish-main.mjs.
export declare const parseExclude: (text: string) => string[];
export declare const isExcluded: (ex: string[], p: string) => boolean;
export declare function leaks(file: string, text: string): string[];

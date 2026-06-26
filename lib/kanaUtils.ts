export function toFullWidthKatakana(input: string): string {
  return input.replace(/[ぁ-ゖ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

export function hasKatakana(input: string): boolean {
  return /[゠-ヿ]/.test(input);
}

export function hasHiragana(input: string): boolean {
  return /[ぁ-ゖ]/.test(input);
}

export function hasKanji(input: string): boolean {
  return /[一-鿿]/.test(input);
}

/**
 * 商品名からカナ候補を生成する。
 * - カタカナのみ → そのまま返す
 * - ひらがな含む → カタカナに変換して返す
 * - 漢字含む → 自動変換不可のため空文字を返す
 */
export function generateKanaFromName(name: string): string {
  if (!name) return "";
  if (hasKanji(name)) return "";
  return toFullWidthKatakana(name);
}

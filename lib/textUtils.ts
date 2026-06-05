export function toKatakana(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/[ぁ-ゖ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

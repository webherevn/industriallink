/** Bỏ thẻ HTML còn sót trong nhãn ngắn (kỹ năng, thẻ tin). */
export function plainLabel(input: string | null | undefined): string {
  if (!input) return '';
  let text = input;
  for (let pass = 0; pass < 2; pass += 1) {
    text = text
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
  return text;
}

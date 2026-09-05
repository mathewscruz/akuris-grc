/** Keep tenant colors readable on the public channel's white surface. */
export function canalBrandColor(value: string | null | undefined): string {
  const hex = /^#[\da-f]{6}$/i.test(value?.trim() ?? '') ? value!.trim() : '#6246bc';
  let rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const luminance = () => rgb.map((part) => {
    const c = part / 255;
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  }).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
  // Leave headroom for the HSL rounding used by tenant theme tokens.
  while (1.05 / (luminance() + .05) < 4.7) rgb = rgb.map((c) => Math.floor(c * .95));
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

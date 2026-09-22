export function modifierColorStyle(color?: string | null): Record<string, string> | null {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return {
    'background-color': color,
    'border-color': color,
    color: luminance >= 150 ? '#17120a' : '#ffffff',
  };
}

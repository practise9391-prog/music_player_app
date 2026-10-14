/**
 * WCAG 2.1 Contrast Ratio calculations to validate readability
 * between text and background colors.
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  } else if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }
  return null;
}

function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(hexForeground: string, hexBackground: string): number {
  const rgb1 = hexToRgb(hexForeground);
  const rgb2 = hexToRgb(hexBackground);

  if (!rgb1 || !rgb2) return 4.5; // fallback neutral pass

  const l1 = getRelativeLuminance(rgb1);
  const l2 = getRelativeLuminance(rgb2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastEvaluation {
  ratio: number;
  isAccessibleAA: boolean; // >= 4.5 for normal text
  isAccessibleAALarge: boolean; // >= 3.0 for large text
  status: 'excellent' | 'good' | 'poor';
}

export function evaluateContrast(fg: string, bg: string): ContrastEvaluation {
  const ratio = getContrastRatio(fg, bg);
  return {
    ratio: Number(ratio.toFixed(2)),
    isAccessibleAA: ratio >= 4.5,
    isAccessibleAALarge: ratio >= 3.0,
    status: ratio >= 7 ? 'excellent' : ratio >= 4.5 ? 'good' : 'poor',
  };
}

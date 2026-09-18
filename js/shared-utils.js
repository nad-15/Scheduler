/**
 * ==========================================================================
 * Shared Utilities Module
 * ==========================================================================
 * Single source of truth for pure utility functions used across all views
 * (Month View, List View, Year Map, Popups, etc.).
 * ==========================================================================
 */

/**
 * Converts a color (hex, rgb, rgba) to an rgba string with the specified opacity.
 * Handles:
 * - 3-digit hex: '#fff' -> rgba(255, 255, 255, alpha)
 * - 6-digit hex: '#2196f3' -> rgba(33, 150, 243, alpha)
 * - rgb: 'rgb(33, 150, 243)' -> rgba(33, 150, 243, alpha)
 * - rgba: 'rgba(33, 150, 243, 0.9)' -> rgba(33, 150, 243, alpha)
 * - Null / undefined / invalid -> rgba(106, 80, 68, alpha) fallback
 *
 * @param {string} color - CSS color string
 * @param {number} [alpha=0.6] - Opacity from 0 to 1
 * @returns {string} - rgba color string
 */
function fadeColor(color, alpha = 0.6) {
  if (!color || typeof color !== 'string') return `rgba(106, 80, 68, ${alpha})`;

  // If color is in rgba format, replace its existing alpha with the new one
  if (color.startsWith('rgba')) {
    return color.replace(/rgba?\(([^)]+)\)/, (match, values) => {
      const parts = values.split(',').map(v => v.trim());
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    });
  }

  // If color is in rgb format, apply the alpha
  if (color.startsWith('rgb')) {
    return color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  }

  // Otherwise, treat as hex (#fff or #ffffff)
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

/**
 * Converts an RGB string ('rgb(r, g, b)' or 'rgba(...)') or hex string to '#rrggbb' hex format.
 * Returns empty string if input is null/undefined/empty, or preserves existing hex.
 *
 * @param {string} rgb - RGB or Hex color string
 * @returns {string} - Hex formatted string (e.g. '#2196f3')
 */
function rgbToHex(rgb) {
  if (!rgb || typeof rgb !== 'string') {
    return "";
  }
  if (rgb.startsWith('#')) {
    return rgb;
  }

  // Extract the RGB values and convert to hex
  const match = rgb.match(/\d+/g);
  if (match && match.length >= 3) {
    return `#${match.slice(0, 3).map(x => Number(x).toString(16).padStart(2, '0')).join('')}`;
  }
  return rgb;
}

// Expose on window for global access across all scripts
window.fadeColor = fadeColor;
window.rgbToHex = rgbToHex;

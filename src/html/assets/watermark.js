/* ========== Text watermark placement ========== */

const Watermark = (() => {
  const MARGIN = 12;

  // Where to draw the text (canvas fillText with textBaseline 'bottom').
  // `size` may come straight from an <input> as a string: it is converted first, because
  // "28" + 12 is "2812", which put top-left and top-right watermarks far below the image.
  function position(pos, canvasW, canvasH, textW, size) {
    const s = Number(size) || 0;
    switch (pos) {
      case 'bottom-left': return { x: MARGIN, y: canvasH - MARGIN };
      case 'top-right': return { x: canvasW - textW - MARGIN, y: s + MARGIN };
      case 'top-left': return { x: MARGIN, y: s + MARGIN };
      case 'center': return { x: (canvasW - textW) / 2, y: canvasH / 2 + s / 2 };
      case 'bottom-right':
      default: return { x: canvasW - textW - MARGIN, y: canvasH - MARGIN };
    }
  }

  // '#rgb' or '#rrggbb' to {r, g, b}; null for anything else.
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  return { position, hexToRgb };
})();

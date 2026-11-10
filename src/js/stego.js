/* ========== Robust LSB Steganography Engine ========== */

const Stego = (() => {

  // Magic header to detect valid stego data: "STG1" (4 bytes = 32 bits), then the payload
  // length as a 32-bit big-endian number, then the payload. Bits go MSB first into the
  // least significant bit of R, G and B of each pixel in turn (alpha is skipped).
  const MAGIC = [0x53, 0x54, 0x47, 0x31];
  const HEADER_BYTES = 8;

  /**
   * Calculate maximum string payload capacity in bytes.
   */
  function calculateCapacityBytes(width, height) {
    // Total pixels * 3 channels (RGB) / 8 bits = max bytes
    // Minus 4 bytes for magic, 4 bytes for length
    const totalBits = width * height * 3;
    const capacityBytes = Math.floor((totalBits - 64) / 8);
    return Math.max(0, capacityBytes);
  }

  // Index into RGBA data of the n-th usable (non-alpha) channel.
  const channel = (n) => n + Math.floor(n / 3);

  // The bytes are packed straight into the pixels. (This used to build a string of '0'/'1'
  // characters first, one character per bit, and parse it back with parseInt.)
  function writeBytes(data, bytes) {
    let i = 0;
    for (const byte of bytes) {
      for (let b = 7; b >= 0; b--) {
        if ((i & 3) === 3) i++;  // skip alpha
        data[i] = (data[i] & 0xFE) | ((byte >> b) & 1);
        i++;
      }
    }
    return bytes.length * 8;
  }

  function readBytes(data, firstByte, count) {
    const out = new Uint8Array(count);
    let i = channel(firstByte * 8);
    for (let k = 0; k < count; k++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        if ((i & 3) === 3) i++;
        byte = (byte << 1) | (data[i] & 1);
        i++;
      }
      out[k] = byte;
    }
    return out;
  }

  /**
   * Embed data string into an image using LSB (Least Significant Bit).
   * Format: [MAGIC 32 bits] + [LENGTH 32 bits] + [PAYLOAD bytes]
   */
  function embedData(canvas, img, dataStr) {
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Encode string to UTF-8 bytes to safely handle all characters
    const payload = new TextEncoder().encode(dataStr);
    const stream = new Uint8Array(HEADER_BYTES + payload.length);
    stream.set(MAGIC, 0);
    new DataView(stream.buffer).setUint32(4, payload.length);
    stream.set(payload, HEADER_BYTES);

    const neededBits = stream.length * 8;
    const maxCapacityBits = (data.length / 4) * 3;
    if (neededBits > maxCapacityBits) {
      return {
        ok: false,
        reason: `Payload too large. Needs ${neededBits} bits, but image only has ${maxCapacityBits} bits.`
      };
    }

    // Make every pixel opaque. Browsers store canvas pixels with premultiplied alpha, so the
    // colour of a semi-transparent pixel is rounded on putImageData and its LSBs, the message,
    // come back changed. Transparent PNGs (logos, screenshots) lost their payload this way.
    for (let i = 3; i < data.length; i += 4) data[i] = 255;

    const bitsUsed = writeBytes(data, stream);
    ctx.putImageData(imageData, 0, 0);
    return { ok: true, bitsUsed, capacityBytes: calculateCapacityBytes(img.width, img.height) };
  }

  /**
   * Extract data string from an image using LSB.
   * Throws an Error if no valid payload is found.
   */
  function extractData(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const maxCapacityBits = (data.length / 4) * 3;

    if (maxCapacityBits < HEADER_BYTES * 8) {
      throw new Error("Image is too small to contain valid steganography data.");
    }

    const header = readBytes(data, 0, HEADER_BYTES);
    if (MAGIC.some((m, k) => header[k] !== m)) {
      throw new Error("No secure steganographic signature found in this image.");
    }

    const dataLengthBytes = new DataView(header.buffer).getUint32(4);
    if ((HEADER_BYTES + dataLengthBytes) * 8 > maxCapacityBits) {
      throw new Error(`Corrupted header: declares length ${dataLengthBytes} bytes, which exceeds image capacity.`);
    }

    return new TextDecoder().decode(readBytes(data, HEADER_BYTES, dataLengthBytes));
  }

  return { embedData, extractData, calculateCapacityBytes };
})();

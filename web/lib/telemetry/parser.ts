/**
 * .f1tel binary parser - runs in browser (Web Worker or main thread).
 *
 * File format:
 *   [0-3]   "F1TL" magic
 *   [4-5]   game_year  uint16 LE
 *   [6]     format version uint8
 *   [7-10]  uncompressed payload size uint32 LE
 *   [11..N] gzip-compressed JSON
 *   [N+1..N+4] CRC32 of uncompressed JSON, uint32 LE
 */

import type { F1TelData } from "./types";

const MAGIC = "F1TL";
const SUPPORTED_YEARS = [2025, 2026];
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

function crc32(bytes: Uint8Array): number {
  // Standard CRC32 table
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function parseF1Tel(buffer: ArrayBuffer): Promise<F1TelData> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new ParseError(`File too large (max 20 MB)`);
  }
  if (buffer.byteLength < 16) {
    throw new ParseError("File too small");
  }

  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Magic bytes
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== MAGIC) {
    throw new ParseError(`Invalid file: expected F1TL magic, got "${magic}"`);
  }

  // Game year
  const gameYear = view.getUint16(4, true);
  if (!SUPPORTED_YEARS.includes(gameYear)) {
    throw new ParseError(`Unsupported game year: ${gameYear}`);
  }

  // Format version (currently only 0x01 supported)
  const version = view.getUint8(6);
  if (version !== 0x01) {
    throw new ParseError(`Unsupported format version: ${version}`);
  }

  // Payload size (uncompressed)
  const payloadSize = view.getUint32(7, true);

  // Compressed payload: bytes 11 .. end-4
  const compressedStart = 11;
  const compressedEnd = buffer.byteLength - 4;
  if (compressedEnd <= compressedStart) {
    throw new ParseError("File structure invalid");
  }
  const compressed = bytes.slice(compressedStart, compressedEnd);

  // Decompress
  let jsonBytes: Uint8Array;
  try {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(compressed);
    writer.close();

    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLen += value.length;
    }
    jsonBytes = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      jsonBytes.set(chunk, offset);
      offset += chunk.length;
    }
  } catch {
    throw new ParseError("Decompression failed");
  }

  // Size check
  if (jsonBytes.length !== payloadSize) {
    throw new ParseError(
      `Payload size mismatch: expected ${payloadSize}, got ${jsonBytes.length}`
    );
  }

  // CRC32 check
  const storedCrc = view.getUint32(compressedEnd, true);
  const computedCrc = crc32(jsonBytes);
  if (storedCrc !== computedCrc) {
    throw new ParseError(
      `CRC32 mismatch: file may be corrupted (stored=${storedCrc.toString(16)}, computed=${computedCrc.toString(16)})`
    );
  }

  // JSON parse
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch {
    throw new ParseError("JSON parse failed");
  }

  // Basic shape validation
  if (typeof data !== "object" || data === null) {
    throw new ParseError("Invalid payload structure");
  }
  const d = data as Record<string, unknown>;
  if (!d.session || !d.laps || !d.telemetry_frames) {
    throw new ParseError("Missing required fields in payload");
  }

  return data as F1TelData;
}

// Writes the two PNG icons the manifest references. Run: node scripts/make-icons.mjs
// Deliberately dependency-free — it hand-rolls a minimal PNG rather than pulling in a
// canvas library for two flat squares.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [0x4b, 0x2e, 0xf5];
const FG = [0xfa, 0xfa, 0xf8];

// a chunky "D" drawn on a 12x12 grid, scaled up
const GLYPH = [
  "............",
  "..DDDDDD....",
  "..DD...DD...",
  "..DD....DD..",
  "..DD....DD..",
  "..DD....DD..",
  "..DD....DD..",
  "..DD....DD..",
  "..DD...DD...",
  "..DDDDDD....",
  "............",
  "............",
];

function png(size, path) {
  const px = size / 12;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const on = GLYPH[Math.floor(y / px)][Math.floor(x / px)] === "D";
      row.push(...(on ? FG : BG));
    }
    rows.push(Buffer.from(row));
  }
  const raw = deflateSync(Buffer.concat(rows));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crcTable = [...Array(256)].map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    let c = 0xffffffff;
    for (const b of body) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    const crc = Buffer.alloc(4); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", raw), chunk("IEND", Buffer.alloc(0)),
  ]));
  console.log("wrote", path);
}
png(180, new URL("../public/icon-180.png", import.meta.url).pathname);
png(512, new URL("../public/icon-512.png", import.meta.url).pathname);

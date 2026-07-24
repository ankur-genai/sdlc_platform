// Minimal, dependency-free ZIP writer using the STORE method (no
// compression). Enough to bundle the generated source files into a single
// downloadable archive from the browser without pulling in a zip library.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

export interface ZipInputFile {
  path: string;
  content: string;
}

/** Builds a valid (uncompressed) ZIP archive Blob from the given files. */
export function createZip(files: ZipInputFile[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = file.path.replace(/^\/+/, '');
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(file.content ?? '');
    const crc = crc32(data);
    const size = data.length;

    // Local file header + data.
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), nameBytes, data,
    ]);
    chunks.push(local);

    // Central directory record for this entry.
    const record = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), nameBytes,
    ]);
    central.push(record);
    offset += local.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const record of central) {
    chunks.push(record);
    centralSize += record.length;
  }

  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralSize), u32(centralStart), u16(0),
  ]);
  chunks.push(end);

  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}

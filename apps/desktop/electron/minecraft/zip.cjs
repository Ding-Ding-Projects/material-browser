// Minimal ZIP reader and writer for server jars and world archives.
// Reading supports stored and deflated entries; writing uses deflate and ZIP64 is not needed
// because single entries and archives are capped well below 4 GiB.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { fail } = require("./util.cjs");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer, crc = 0) {
  crc = ~crc >>> 0;
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return ~crc >>> 0;
}

/** Index a ZIP held in memory. Returns name -> { read() } without inflating anything up front. */
function openZip(buffer, { maxEntryBytes = 512 * 1024 * 1024 } = {}) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw fail("ZIP_MALFORMED");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw fail("ZIP_MALFORMED");
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressed = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, {
      name,
      size,
      read() {
        if (size > maxEntryBytes) throw fail("ZIP_ENTRY_TOO_LARGE", name);
        if (buffer.readUInt32LE(local) !== 0x04034b50) throw fail("ZIP_MALFORMED");
        const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
        const raw = buffer.subarray(start, start + compressed);
        const data = method === 0 ? Buffer.from(raw) : method === 8 ? zlib.inflateRawSync(raw, { maxOutputLength: maxEntryBytes }) : null;
        if (!data) throw fail("ZIP_METHOD_UNSUPPORTED", name);
        if (data.length !== size || crc32(data) !== crc) throw fail("ZIP_ENTRY_CORRUPT", name);
        return data;
      },
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function dosTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * Write every file under `folder` into a ZIP at `destination`, inside a top-level folder named
 * `rootName` (no folder when it is empty). Writes a temporary file first and refuses to replace an existing archive.
 */
function zipFolder(folder, destination, rootName, { now = new Date() } = {}) {
  if (fs.existsSync(destination)) throw fail("DESTINATION_EXISTS");
  const files = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name), rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) files.push({ full, rel });
    }
  };
  walk(folder, rootName);
  const temporary = `${destination}.${process.pid}.part`;
  const handle = fs.openSync(temporary, "w");
  const central = [];
  let offset = 0;
  const { time, day } = dosTime(now);
  try {
    for (const file of files) {
      const data = fs.readFileSync(file.full);
      const packed = zlib.deflateRawSync(data);
      const name = Buffer.from(file.rel, "utf8");
      const crc = crc32(data);
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(0x0800, 6);
      header.writeUInt16LE(8, 8);
      header.writeUInt16LE(time, 10);
      header.writeUInt16LE(day, 12);
      header.writeUInt32LE(crc, 14);
      header.writeUInt32LE(packed.length, 18);
      header.writeUInt32LE(data.length, 22);
      header.writeUInt16LE(name.length, 26);
      fs.writeSync(handle, header);
      fs.writeSync(handle, name);
      fs.writeSync(handle, packed);
      const record = Buffer.alloc(46);
      record.writeUInt32LE(0x02014b50, 0);
      record.writeUInt16LE(20, 4);
      record.writeUInt16LE(20, 6);
      record.writeUInt16LE(0x0800, 8);
      record.writeUInt16LE(8, 10);
      record.writeUInt16LE(time, 12);
      record.writeUInt16LE(day, 14);
      record.writeUInt32LE(crc, 16);
      record.writeUInt32LE(packed.length, 20);
      record.writeUInt32LE(data.length, 24);
      record.writeUInt16LE(name.length, 28);
      record.writeUInt32LE(offset, 42);
      central.push(Buffer.concat([record, name]));
      offset += 30 + name.length + packed.length;
      if (offset > 0xfffffff0) throw fail("ZIP_TOO_LARGE");
    }
    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length, 8);
    end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    fs.writeSync(handle, directory);
    fs.writeSync(handle, end);
    fs.closeSync(handle);
  } catch (error) {
    try { fs.closeSync(handle); } catch {}
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  fs.linkSync(temporary, destination);
  fs.rmSync(temporary, { force: true });
  return { files: files.length, bytes: fs.statSync(destination).size };
}

/** Reopen an archive and check every entry's size and CRC. */
function verifyZip(file, expectedFiles) {
  const entries = openZip(fs.readFileSync(file));
  for (const entry of entries.values()) entry.read();
  if (expectedFiles !== undefined && entries.size !== expectedFiles) throw fail("ZIP_VERIFY_FAILED");
  return { entries: entries.size };
}

module.exports = { crc32, openZip, zipFolder, verifyZip };

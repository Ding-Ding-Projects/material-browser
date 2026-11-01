// Local file converter. Every conversion runs inside this process with what ships in the
// build: Electron's nativeImage for PNG and JPEG, and plain JavaScript for CSV, JSON and
// Netscape bookmark files. Nothing is uploaded and no external program is started.
//
// The renderer only ever sends file paths and options, never file contents. Output is
// written only to the folder the user picked in the native folder dialog, through a
// temporary file that is moved into place without replacing an existing file, and is
// read back and checked before the job is reported as done.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CHANNEL = "material:converter";
const MB = 1024 * 1024;
const LIMITS = Object.freeze({ image: 50 * MB, data: 25 * MB });
const MAX_JOBS = 200;
const MAX_PATHS = 100;
const UNAVAILABLE_REASON = "Unavailable: no bundled converter in this build";

const CATEGORIES = Object.freeze([
  {
    id: "image",
    label: "Images",
    available: true,
    inputs: ["png", "jpg", "jpeg"],
    targets: ["png", "jpeg"],
  },
  {
    id: "document",
    label: "Documents",
    available: false,
    reason: UNAVAILABLE_REASON,
    inputs: ["pdf", "doc", "docx", "odt", "rtf", "txt", "md", "epub", "ppt", "pptx", "xls", "xlsx", "ods"],
    targets: [],
  },
  {
    id: "data",
    label: "Data",
    available: true,
    inputs: ["csv", "json", "html", "htm"],
    targets: ["json", "json-minified", "csv"],
  },
  {
    id: "media",
    label: "Audio and video",
    available: false,
    reason: UNAVAILABLE_REASON,
    inputs: ["mp3", "wav", "flac", "ogg", "m4a", "aac", "mp4", "mov", "mkv", "webm", "avi", "wmv"],
    targets: [],
  },
]);

function capabilities() {
  return CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    available: c.available,
    reason: c.available ? null : c.reason,
    inputs: [...c.inputs],
    targets: [...c.targets],
  }));
}

function extensionOf(file) {
  return path.extname(file).slice(1).toLowerCase();
}

function categoryFor(file) {
  const ext = extensionOf(file);
  return CATEGORIES.find((c) => c.inputs.includes(ext)) || null;
}

/** Output kind for an input and a requested target, or null when the pair is not supported. */
function planFor(file, target) {
  const ext = extensionOf(file);
  const category = categoryFor(file);
  if (!category || !category.available) return null;
  if (category.id === "image") {
    if (target !== "png" && target !== "jpeg") return null;
    return { kind: `image-${target}`, extension: target === "jpeg" ? "jpg" : "png" };
  }
  if (ext === "csv") {
    if (target === "json" || target === "json-pretty") return { kind: "csv-json", extension: "json", pretty: true };
    if (target === "json-minified") return { kind: "csv-json", extension: "json", pretty: false };
    return null;
  }
  if (ext === "json") {
    if (target === "csv") return { kind: "json-csv", extension: "csv" };
    if (target === "json" || target === "json-pretty") return { kind: "json-json", extension: "json", pretty: true };
    if (target === "json-minified") return { kind: "json-json", extension: "json", pretty: false };
    return null;
  }
  if (ext === "html" || ext === "htm") {
    if (target === "json" || target === "json-pretty") return { kind: "bookmarks-json", extension: "json", pretty: true };
    if (target === "json-minified") return { kind: "bookmarks-json", extension: "json", pretty: false };
    return null;
  }
  return null;
}

/** The target used when the renderer does not ask for one. */
function defaultTarget(file) {
  const ext = extensionOf(file);
  if (ext === "png") return "jpeg";
  if (ext === "jpg" || ext === "jpeg") return "png";
  if (ext === "csv" || ext === "html" || ext === "htm") return "json";
  if (ext === "json") return "csv";
  return null;
}

// ---------------------------------------------------------------------------------------
// CSV (RFC 4180)

class ConversionError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail || "";
  }
}

/**
 * Parses RFC 4180 CSV into an array of records (arrays of strings). Accepts CRLF, LF or CR
 * record breaks, quoted fields with doubled quotes and line breaks inside quotes. A final
 * line break does not create an empty record. A leading byte order mark is ignored.
 */
function parseCsv(text) {
  if (typeof text !== "string") throw new ConversionError("CSV_INVALID", "Input is not text");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let quoted = false;
  let afterQuote = false;
  let fieldStarted = false;
  const n = text.length;
  const endField = () => {
    row.push(field);
    field = "";
    afterQuote = false;
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < n) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        afterQuote = true;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === ",") {
      endField();
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      endRow();
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (afterQuote) {
      throw new ConversionError("CSV_INVALID", `Unexpected character after a closing quote in record ${rows.length + 1}`);
    }
    if (c === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
      i++;
      continue;
    }
    field += c;
    fieldStarted = true;
    i++;
  }
  if (quoted) throw new ConversionError("CSV_INVALID", `Unclosed quoted field in record ${rows.length + 1}`);
  if (fieldStarted || afterQuote || row.length > 0) endRow();
  return rows;
}

function csvField(value) {
  const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serializes records with CRLF line breaks, as RFC 4180 specifies. */
function stringifyCsv(rows) {
  return rows.map((r) => r.map(csvField).join(",")).join("\r\n") + (rows.length ? "\r\n" : "");
}

function uniqueHeaders(headers) {
  const bases = headers.map((h, index) => h === "" ? `column${index + 1}` : h);
  const reserved = new Set(bases);
  const used = new Set();
  return bases.map((base) => {
    let name = base;
    for (let suffix = 2; used.has(name); suffix++) {
      name = `${base}_${suffix}`;
      while (reserved.has(name)) name = `${base}_${++suffix}`;
    }
    used.add(name);
    return name;
  });
}

/** First record is the header; every following record becomes one object. */
function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = uniqueHeaders(rows[0]);
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    // A completely empty line is not a record when the header has several columns.
    if (row.length === 1 && row[0] === "" && headers.length > 1) continue;
    if (row.length !== headers.length) {
      throw new ConversionError("CSV_ROW_WIDTH", `Record ${r + 1} has ${row.length} fields; the header has ${headers.length}`);
    }
    const record = {};
    headers.forEach((h, k) => {
      Object.defineProperty(record, h, { value: row[k], enumerable: true, writable: true, configurable: true });
    });
    records.push(record);
  }
  return { headers, records };
}

/** An array of objects (columns in first-seen key order) or an array of arrays. */
function valueToCsvRows(value) {
  if (!Array.isArray(value)) throw new ConversionError("JSON_SHAPE", "CSV needs a JSON array of objects or of arrays");
  if (value.length === 0) return { rows: [], dataRows: 0 };
  if (value.every(Array.isArray)) return { rows: value, dataRows: value.length, headerless: true };
  if (!value.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
    throw new ConversionError("JSON_SHAPE", "CSV needs every array item to be an object, or every item to be an array");
  }
  const columns = [];
  const known = new Set();
  for (const item of value) for (const key of Object.keys(item)) if (!known.has(key)) {
    known.add(key);
    columns.push(key);
  }
  const rows = [columns, ...value.map((item) => columns.map((c) => item[c]))];
  return { rows, dataRows: value.length };
}

// ---------------------------------------------------------------------------------------
// Netscape bookmark files

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return Object.hasOwn(ENTITIES, name.toLowerCase()) ? ENTITIES[name.toLowerCase()] : whole;
  });
}

function attributes(source) {
  const out = {};
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = pattern.exec(source))) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

function epoch(value) {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? new Date(n * 1000).toISOString() : null;
}

/** Turns a Netscape bookmark file (the format browsers export) into a folder tree. */
function parseBookmarks(html) {
  if (!/<!DOCTYPE\s+NETSCAPE-Bookmark-file-1>/i.test(html) && !/<DT>\s*<(A|H3)\b/i.test(html)) {
    throw new ConversionError("BOOKMARKS_INVALID", "This file is not a Netscape bookmark file");
  }
  const root = { type: "folder", title: "Bookmarks", children: [] };
  const stack = [root];
  let pendingFolder = null;
  let count = 0;
  // Each match is one opening or closing tag plus the text that follows it up to the next tag.
  const token = /<(\/?)(DL|H3|A|H1|TITLE)\b([^>]*)>([^<]*)/gi;
  let m;
  while ((m = token.exec(html))) {
    const closing = m[1] === "/";
    const tag = m[2].toUpperCase();
    if (tag === "DL") {
      if (closing) {
        if (stack.length > 1) stack.pop();
      } else if (pendingFolder) {
        stack.push(pendingFolder);
        pendingFolder = null;
      }
      continue;
    }
    if (closing) continue;
    const attrs = attributes(m[3] || "");
    const text = decodeEntities((m[4] || "").trim());
    const parent = stack[stack.length - 1];
    if (tag === "H1" || tag === "TITLE") {
      if (stack.length === 1 && text) root.title = text;
    } else if (tag === "H3") {
      const folder = { type: "folder", title: text, addDate: epoch(attrs.add_date), modified: epoch(attrs.last_modified), children: [] };
      if (attrs.personal_toolbar_folder === "true") folder.toolbar = true;
      parent.children.push(folder);
      pendingFolder = folder;
    } else if (tag === "A") {
      const bookmark = { type: "bookmark", title: text, url: attrs.href || "", addDate: epoch(attrs.add_date) };
      if (attrs.tags) bookmark.tags = attrs.tags.split(",").map((s) => s.trim()).filter(Boolean);
      parent.children.push(bookmark);
      count++;
    }
  }
  return { tree: root, count };
}

function countBookmarks(node) {
  if (!node || typeof node !== "object") return 0;
  if (node.type === "bookmark") return 1;
  return Array.isArray(node.children) ? node.children.reduce((sum, child) => sum + countBookmarks(child), 0) : 0;
}

// ---------------------------------------------------------------------------------------
// Output naming and atomic placement

/** "name.ext", then "name (1).ext", "name (2).ext" and so on: the first one not taken. */
function availableName(folder, base, extension, exists = (p) => fs.existsSync(p)) {
  for (let n = 0; n < 10000; n++) {
    const candidate = path.join(folder, n === 0 ? `${base}.${extension}` : `${base} (${n}).${extension}`);
    if (!exists(candidate)) return candidate;
  }
  throw new ConversionError("NAME_EXHAUSTED", "Too many files with this name already exist");
}

/**
 * Writes bytes to a temporary file in the output folder, then moves it into place under
 * the first free name. A hard link fails if the name is taken, so an existing file is
 * never replaced even if it appears between the check and the move.
 */
function placeAtomically(folder, base, extension, bytes, onPlaced = () => {}) {
  const temporary = path.join(folder, `.${base}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`);
  fs.writeFileSync(temporary, bytes, { flag: "wx" });
  try {
    const temporaryIdentity = fs.statSync(temporary);
    for (let attempt = 0; attempt < 50; attempt++) {
      const target = availableName(folder, base, extension);
      let identity = temporaryIdentity;
      try {
        fs.linkSync(temporary, target);
      } catch (error) {
        if (error.code === "EEXIST") continue;
        if (!["EPERM", "ENOTSUP", "EXDEV", "ENOSYS", "EACCES", "EINVAL"].includes(error.code)) throw error;
        // Exclusive creation preserves no-overwrite semantics without hard links.
        try {
          fs.copyFileSync(temporary, target, fs.constants.COPYFILE_EXCL);
        } catch (copyError) {
          if (copyError.code === "EEXIST") continue;
          throw copyError;
        }
        identity = fs.statSync(target);
      }
      // Placement is complete. Later bookkeeping or cleanup must never retry it.
      onPlaced(identity);
      return target;
    }
    throw new ConversionError("NAME_EXHAUSTED", "Could not find a free output name");
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch {}
  }
}

// ---------------------------------------------------------------------------------------
// Conversion and verification

const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function sameOutputIdentity(actual, expected) {
  return actual.isFile() && !actual.isSymbolicLink() &&
    actual.dev === expected.dev && actual.ino === expected.ino &&
    actual.birthtimeMs === expected.birthtimeMs && actual.size === expected.size &&
    actual.mtimeMs === expected.mtimeMs;
}

function removeUnchangedOutput(file, identity, expectedDigest) {
  // Preserve observed replacements and changes. The final path check and unlink
  // are not atomic against arbitrary concurrent filesystem writers.
  try {
    if (!identity || !sameOutputIdentity(fs.lstatSync(file), identity)) return;
    const fd = fs.openSync(file, "r");
    let unchanged = false;
    try {
      unchanged = sameOutputIdentity(fs.fstatSync(fd), identity) && digest(fs.readFileSync(fd)) === expectedDigest;
    } finally { fs.closeSync(fd); }
    if (unchanged && sameOutputIdentity(fs.lstatSync(file), identity)) fs.unlinkSync(file);
  } catch {}
}

function readInput(file, category, limits) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new ConversionError("NOT_A_FILE", "The input is not a regular file");
  const limit = limits[category];
  if (stat.size > limit) {
    throw new ConversionError("TOO_LARGE", `The file is ${stat.size} bytes; the limit for this category is ${limit} bytes`);
  }
  const bytes = fs.readFileSync(file);
  if (bytes.length > limit) throw new ConversionError("TOO_LARGE", "The file grew past the size limit while it was read");
  return bytes;
}

function decodeText(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ConversionError("NOT_UTF8", "Data files must be UTF-8 text");
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (error) {
    throw new ConversionError("JSON_INVALID", error.message);
  }
}

/** Converts input bytes. Returns the output bytes plus what verification must find. */
function convertBytes(plan, bytes, options, nativeImage) {
  if (plan.kind.startsWith("image-")) {
    if (!nativeImage) throw new ConversionError("IMAGE_UNAVAILABLE", "Image support needs Electron's nativeImage");
    let image = nativeImage.createFromBuffer(bytes);
    if (image.isEmpty()) throw new ConversionError("IMAGE_INVALID", "The image could not be decoded");
    const width = Number(options.width);
    if (Number.isInteger(width) && width > 0) {
      if (width > 16384) throw new ConversionError("INVALID_REQUEST", "Width must be at most 16384 pixels");
      image = image.resize({ width, quality: "best" });
    }
    const size = image.getSize();
    const quality = Number.isInteger(Number(options.quality)) ? Math.min(100, Math.max(1, Number(options.quality))) : 90;
    const out = plan.kind === "image-jpeg" ? image.toJPEG(quality) : image.toPNG();
    return { bytes: out, expect: { image: size } };
  }
  const text = decodeText(bytes);
  if (plan.kind === "csv-json") {
    const { records } = csvToObjects(text);
    const json = JSON.stringify(records, null, plan.pretty ? 2 : 0) + "\n";
    return { bytes: Buffer.from(json, "utf8"), expect: { jsonArrayLength: records.length } };
  }
  if (plan.kind === "json-csv") {
    const { rows, dataRows } = valueToCsvRows(parseJson(text));
    return { bytes: Buffer.from(stringifyCsv(rows), "utf8"), expect: { csvRows: rows.length, dataRows } };
  }
  if (plan.kind === "json-json") {
    const value = parseJson(text);
    const json = JSON.stringify(value, null, plan.pretty ? 2 : 0) + "\n";
    return { bytes: Buffer.from(json, "utf8"), expect: { jsonEquals: JSON.stringify(value) } };
  }
  if (plan.kind === "bookmarks-json") {
    const { tree, count } = parseBookmarks(text);
    const json = JSON.stringify(tree, null, plan.pretty ? 2 : 0) + "\n";
    return { bytes: Buffer.from(json, "utf8"), expect: { bookmarks: count } };
  }
  throw new ConversionError("UNSUPPORTED", "No converter for this pair");
}

/** Reads the written file back from disk and checks it against what the conversion produced. */
function verifyOutput(file, expect, nativeImage) {
  const bytes = fs.readFileSync(file);
  if (bytes.length !== expect.byteLength || digest(bytes) !== expect.sha256) {
    throw new ConversionError("VERIFY_FAILED", "The written output does not match the converted bytes");
  }
  if (expect.image) {
    const image = nativeImage.createFromBuffer(bytes);
    const size = image.getSize();
    if (image.isEmpty() || size.width !== expect.image.width || size.height !== expect.image.height) {
      throw new ConversionError("VERIFY_FAILED", "The written image does not decode to the expected size");
    }
    return bytes.length;
  }
  const text = decodeText(bytes);
  if (expect.csvRows !== undefined) {
    const rows = parseCsv(text);
    if (rows.length !== expect.csvRows) throw new ConversionError("VERIFY_FAILED", `Expected ${expect.csvRows} CSV records, found ${rows.length}`);
    return bytes.length;
  }
  const value = parseJson(text);
  if (expect.jsonArrayLength !== undefined && (!Array.isArray(value) || value.length !== expect.jsonArrayLength)) {
    throw new ConversionError("VERIFY_FAILED", "The written JSON does not have the expected number of rows");
  }
  if (expect.jsonEquals !== undefined && JSON.stringify(value) !== expect.jsonEquals) {
    throw new ConversionError("VERIFY_FAILED", "The written JSON does not match the input");
  }
  if (expect.bookmarks !== undefined && countBookmarks(value) !== expect.bookmarks) {
    throw new ConversionError("VERIFY_FAILED", "The written JSON does not contain every bookmark");
  }
  return bytes.length;
}

// ---------------------------------------------------------------------------------------
// Queue

const tick = () => new Promise((resolve) => setImmediate(resolve));

/**
 * One-at-a-time queue. Only the file being converted is in memory; queued jobs hold a
 * path and options. Cancelling a running job stops it at the next stage boundary and
 * removes an output only while its recorded identity and content still match.
 */
function createConverter({ nativeImage = null, limits = LIMITS, onChange = () => {} } = {}) {
  const jobs = [];
  let outputFolder = null;
  let outputDirectory = null;
  let running = false;

  const bindDirectory = (selectedPath) => {
    const resolvedPath = fs.realpathSync(selectedPath);
    const stat = fs.statSync(resolvedPath, { bigint: true });
    if (!stat.isDirectory()) throw new Error("INVALID_REQUEST");
    return Object.freeze({ selectedPath, resolvedPath, dev: stat.dev, ino: stat.ino, birthtimeNs: stat.birthtimeNs });
  };
  const checkedDirectory = (binding) => {
    try {
      const current = bindDirectory(binding.selectedPath);
      if (current.resolvedPath === binding.resolvedPath && current.dev === binding.dev &&
          current.ino === binding.ino && current.birthtimeNs === binding.birthtimeNs) return current.resolvedPath;
    } catch {}
    throw new ConversionError("OUTPUT_FOLDER_CHANGED", "The selected output folder changed. Choose it again before converting.");
  };

  const snapshot = () => ({
    outputFolder,
    busy: running,
    jobs: jobs.map(({ cancel, plan, ...job }) => ({ ...job })),
  });
  const changed = () => {
    try {
      onChange(snapshot());
    } catch {}
  };

  function setOutputFolder(folder) {
    if (typeof folder !== "string" || !path.isAbsolute(folder)) throw new Error("INVALID_REQUEST");
    const selected = bindDirectory(folder);
    outputFolder = folder;
    outputDirectory = selected;
    changed();
    return outputFolder;
  }

  function describe(file) {
    const category = categoryFor(file);
    const target = defaultTarget(file);
    return {
      path: file,
      name: path.basename(file),
      category: category ? category.id : null,
      available: Boolean(category && category.available),
      reason: !category ? "Unavailable: this file type is not recognised" : category.available ? null : category.reason,
      targets: category && category.available ? category.targets.filter((t) => planFor(file, t)) : [],
      defaultTarget: category && category.available ? target : null,
    };
  }

  function inspect(paths) {
    if (!Array.isArray(paths) || paths.length > MAX_PATHS) throw new Error("INVALID_REQUEST");
    return paths.map((p) => {
      if (typeof p !== "string" || !path.isAbsolute(p)) throw new Error("INVALID_REQUEST");
      return describe(p);
    });
  }

  function enqueue(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_PATHS) throw new Error("INVALID_REQUEST");
    for (const item of items)
      if (!item || typeof item.path !== "string" || !path.isAbsolute(item.path)) throw new Error("INVALID_REQUEST");
    if (!outputFolder && items.some((item) => describe(item.path).available)) throw new Error("NO_OUTPUT_FOLDER");
    if (items.some((item) => describe(item.path).available)) checkedDirectory(outputDirectory);
    if (jobs.filter((job) => ["queued", "running"].includes(job.state)).length + items.length > MAX_JOBS)
      throw new Error("QUEUE_FULL");
    const added = [];
    for (const item of items) {
      const info = describe(item.path);
      const target = typeof item.target === "string" ? item.target : info.defaultTarget;
      const width = item.width === undefined || item.width === null || item.width === "" ? undefined : Number(item.width);
      const job = {
        id: crypto.randomUUID(),
        input: item.path,
        name: info.name,
        category: info.category,
        target,
        options: { width: Number.isInteger(width) && width > 0 ? width : undefined, quality: item.quality },
        state: "queued",
        stage: "",
        progress: 0,
        output: null,
        bytes: null,
        error: null,
        detail: null,
      };
      const plan = info.available && typeof target === "string" ? planFor(item.path, target) : null;
      if (!info.available) {
        job.state = "unavailable";
        job.error = info.reason;
      } else if (!plan) {
        job.state = "unavailable";
        job.error = "Unavailable: no bundled converter for this pair in this build";
      }
      Object.defineProperty(job, "plan", { value: plan, enumerable: false, writable: true });
      Object.defineProperty(job, "cancel", { value: false, enumerable: false, writable: true });
      Object.defineProperty(job, "directory", { value: outputDirectory, enumerable: false });
      job.folder = outputFolder;
      jobs.push(job);
      added.push(job.id);
    }
    while (jobs.length > MAX_JOBS) {
      const index = jobs.findIndex((j) => j.state !== "queued" && j.state !== "running");
      if (index < 0) break;
      jobs.splice(index, 1);
    }
    changed();
    void pump();
    return added;
  }

  function cancel(id) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return false;
    if (job.state === "queued") {
      job.state = "canceled";
      changed();
      return true;
    }
    if (job.state === "running") {
      job.cancel = true;
      return true;
    }
    return false;
  }

  function clearFinished() {
    for (let i = jobs.length - 1; i >= 0; i--) if (!["queued", "running"].includes(jobs[i].state)) jobs.splice(i, 1);
    changed();
  }

  async function runJob(job) {
    let written = null;
    let writtenIdentity = null;
    let expectedDigest = null;
    const step = async (stage, progress) => {
      if (job.cancel) throw new ConversionError("CANCELED");
      job.stage = stage;
      job.progress = progress;
      changed();
      await tick();
      if (job.cancel) throw new ConversionError("CANCELED");
    };
    try {
      await step("reading", 0.1);
      let bytes = readInput(job.input, job.category, limits);
      await step("converting", 0.35);
      const result = convertBytes(job.plan, bytes, job.options, nativeImage);
      expectedDigest = digest(result.bytes);
      result.expect = { ...result.expect, byteLength: result.bytes.length, sha256: expectedDigest };
      bytes = null;
      await step("writing", 0.7);
      const base = path.basename(job.input, path.extname(job.input));
      // Resolve only the originally selected directory. These checks are not an
      // atomic filesystem transaction against arbitrary concurrent writers.
      const folder = checkedDirectory(job.directory);
      written = placeAtomically(folder, base, job.plan.extension, result.bytes, (identity) => { writtenIdentity = identity; });
      await step("checking", 0.9);
      checkedDirectory(job.directory);
      const size = verifyOutput(written, result.expect, nativeImage);
      if (job.cancel) throw new ConversionError("CANCELED");
      Object.assign(job, { state: "done", stage: "", progress: 1, output: written, bytes: size });
    } catch (error) {
      if (written) {
        removeUnchangedOutput(written, writtenIdentity, expectedDigest);
      }
      if (error && error.code === "CANCELED") Object.assign(job, { state: "canceled", stage: "", progress: 0 });
      else
        Object.assign(job, {
          state: "failed",
          stage: "",
          progress: 0,
          error: error instanceof ConversionError ? error.code : error && error.code ? String(error.code) : "CONVERSION_FAILED",
          detail: error instanceof ConversionError ? error.detail : null,
        });
    }
    changed();
  }

  async function pump() {
    if (running) return;
    running = true;
    try {
      for (;;) {
        const job = jobs.find((j) => j.state === "queued");
        if (!job) break;
        job.state = "running";
        await runJob(job);
      }
    } finally {
      running = false;
      changed();
    }
  }

  /** Resolves once the queue is empty; used by tests and on shutdown. */
  async function idle() {
    while (running || jobs.some((j) => j.state === "queued")) await tick();
  }

  const job = (id) => jobs.find((j) => j.id === id) || null;
  return { setOutputFolder, inspect, enqueue, cancel, clearFinished, snapshot, idle, job };
}

// ---------------------------------------------------------------------------------------
// IPC

function registerConverterIpc({ ipcMain, app, dialog, trusted, getWindow }) {
  const electron = require("electron");
  const converter = createConverter({ nativeImage: electron.nativeImage });
  const allowedInputs = CATEGORIES.flatMap((c) => c.inputs);
  ipcMain.handle(CHANNEL, async (event, operation, params = {}) => {
    if (!trusted(event) || typeof operation !== "string" || !params || typeof params !== "object" || Array.isArray(params))
      throw new Error("INVALID_REQUEST");
    if (operation === "capabilities") return { categories: capabilities(), limits: { ...LIMITS } };
    if (operation === "status") return converter.snapshot();
    if (operation === "choose-files") {
      const category = CATEGORIES.find((c) => c.id === params.category);
      const filters = category
        ? [{ name: category.label, extensions: category.inputs }, { name: "All files", extensions: ["*"] }]
        : [{ name: "Supported files", extensions: allowedInputs }, { name: "All files", extensions: ["*"] }];
      const result = await dialog.showOpenDialog(getWindow(), { properties: ["openFile", "multiSelections"], filters });
      return result.canceled ? [] : converter.inspect(result.filePaths.slice(0, MAX_PATHS));
    }
    if (operation === "inspect") return converter.inspect(params.paths);
    if (operation === "choose-folder") {
      const result = await dialog.showOpenDialog(getWindow(), {
        properties: ["openDirectory", "createDirectory"],
        defaultPath: converter.snapshot().outputFolder || app.getPath("documents"),
      });
      if (result.canceled || !result.filePaths[0]) return { outputFolder: converter.snapshot().outputFolder };
      return { outputFolder: converter.setOutputFolder(result.filePaths[0]) };
    }
    if (operation === "enqueue") return { ids: converter.enqueue(params.items) };
    if (operation === "cancel") return { ok: converter.cancel(String(params.id)) };
    if (operation === "clear") {
      converter.clearFinished();
      return { ok: true };
    }
    if (operation === "reveal") {
      const job = converter.job(String(params.id));
      if (!job || job.state !== "done" || !job.output) throw new Error("INVALID_REQUEST");
      electron.shell.showItemInFolder(job.output);
      return { ok: true };
    }
    throw new Error("INVALID_REQUEST");
  });
  return converter;
}

module.exports = {
  CHANNEL,
  LIMITS,
  UNAVAILABLE_REASON,
  registerConverterIpc,
  createConverter,
  capabilities,
  categoryFor,
  planFor,
  defaultTarget,
  parseCsv,
  stringifyCsv,
  csvToObjects,
  valueToCsvRows,
  parseBookmarks,
  availableName,
  placeAtomically,
  ConversionError,
};

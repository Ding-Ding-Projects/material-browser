const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const converter = require("./converter.cjs");
const {
  parseCsv,
  stringifyCsv,
  csvToObjects,
  valueToCsvRows,
  parseBookmarks,
  availableName,
  createConverter,
  capabilities,
  planFor,
  UNAVAILABLE_REASON,
} = converter;

const temp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test("CSV parser handles quoted fields, doubled quotes and embedded commas", () => {
  assert.deepEqual(parseCsv('a,"b,c","say ""hi"""\n'), [["a", "b,c", 'say "hi"']]);
  assert.deepEqual(parseCsv('"",x,\n'), [["", "x", ""]]);
});

test("CSV parser keeps line breaks inside quoted fields", () => {
  assert.deepEqual(parseCsv('id,note\r\n1,"line one\r\nline two"\r\n2,"a\nb"\r\n'), [
    ["id", "note"],
    ["1", "line one\r\nline two"],
    ["2", "a\nb"],
  ]);
});

test("CSV parser accepts CRLF, LF and CR record breaks and an optional final break", () => {
  const expected = [["a", "b"], ["1", "2"]];
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), expected);
  assert.deepEqual(parseCsv("a,b\r\n1,2"), expected);
  assert.deepEqual(parseCsv("a,b\n1,2\n"), expected);
  assert.deepEqual(parseCsv("a,b\r1,2"), expected);
  assert.deepEqual(parseCsv("﻿a,b\r\n1,2"), expected);
  assert.deepEqual(parseCsv(""), []);
});

test("CSV parser rejects an unclosed quote and text after a closing quote", () => {
  assert.throws(() => parseCsv('a,"open\n'), /CSV_INVALID/);
  assert.throws(() => parseCsv('"done"x,b\n'), /CSV_INVALID/);
});

test("CSV records with the wrong number of fields are refused, not padded", () => {
  assert.throws(() => csvToObjects("a,b\n1,2,3\n"), /CSV_ROW_WIDTH/);
  assert.deepEqual(csvToObjects("a,a,\n1,2,3\n").headers, ["a", "a_2", "column3"]);
});

test("CSV to JSON and back keeps every value, quote and line break", () => {
  const source = 'name,note,empty\r\n"Lee, Ka","He said ""ok""",\r\n" Tam ","two\r\nlines",x\r\n';
  const { records } = csvToObjects(source);
  assert.deepEqual(records, [
    { name: "Lee, Ka", note: 'He said "ok"', empty: "" },
    { name: " Tam ", note: "two\r\nlines", empty: "x" },
  ]);
  const json = JSON.parse(JSON.stringify(records));
  const { rows, dataRows } = valueToCsvRows(json);
  assert.equal(dataRows, 2);
  const again = stringifyCsv(rows);
  assert.equal(again, source);
  assert.deepEqual(csvToObjects(again).records, records);
});

test("JSON to CSV refuses shapes that are not tables", () => {
  assert.throws(() => valueToCsvRows({ a: 1 }), /JSON_SHAPE/);
  assert.throws(() => valueToCsvRows([{ a: 1 }, 2]), /JSON_SHAPE/);
  assert.deepEqual(valueToCsvRows([{ a: 1 }, { b: 2 }]).rows, [["a", "b"], [1, undefined], [undefined, 2]]);
});

test("Netscape bookmark files become a folder tree", () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bar &amp; more</H3>
  <DL><p>
    <DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="1700000001" TAGS="x, y">Example</A>
  </DL><p>
  <DT><A HREF="https://example.org/">Org</A>
</DL><p>`;
  const { tree, count } = parseBookmarks(html);
  assert.equal(count, 2);
  assert.equal(tree.children[0].title, "Bar & more");
  assert.equal(tree.children[0].toolbar, true);
  assert.equal(tree.children[0].children[0].url, "https://example.com/?a=1&b=2");
  assert.deepEqual(tree.children[0].children[0].tags, ["x", "y"]);
  assert.equal(tree.children[1].title, "Org");
  assert.throws(() => parseBookmarks("<html><body>hello</body></html>"), /BOOKMARKS_INVALID/);
});

test("output names never replace an existing file", () => {
  const folder = temp("convert-name-");
  assert.equal(availableName(folder, "data", "json"), path.join(folder, "data.json"));
  fs.writeFileSync(path.join(folder, "data.json"), "keep");
  fs.writeFileSync(path.join(folder, "data (1).json"), "keep");
  assert.equal(availableName(folder, "data", "json"), path.join(folder, "data (2).json"));
});

test("queue converts one file at a time, adds a suffix, and checks the output", async () => {
  const input = temp("convert-in-");
  const output = temp("convert-out-");
  const csv = path.join(input, "people.csv");
  fs.writeFileSync(csv, 'name,city\r\n"Chan, Tai Man","Hong\r\nKong"\r\nWong,Kowloon\r\n');
  fs.writeFileSync(path.join(output, "people.json"), "existing");
  const seen = [];
  const queue = createConverter({ onChange: (s) => seen.push(s.jobs.filter((j) => j.state === "running").length) });
  queue.setOutputFolder(output);
  const [id] = queue.enqueue([{ path: csv, target: "json" }]);
  await queue.idle();
  const job = queue.job(id);
  assert.equal(job.state, "done", job.detail || job.error);
  assert.equal(job.output, path.join(output, "people (1).json"));
  assert.equal(fs.readFileSync(path.join(output, "people.json"), "utf8"), "existing");
  assert.deepEqual(JSON.parse(fs.readFileSync(job.output, "utf8")), [
    { name: "Chan, Tai Man", city: "Hong\r\nKong" },
    { name: "Wong", city: "Kowloon" },
  ]);
  assert.ok(seen.every((n) => n <= 1));
  assert.deepEqual(fs.readdirSync(output).filter((f) => f.endsWith(".tmp")), []);

  const [back] = queue.enqueue([{ path: job.output, target: "csv" }]);
  await queue.idle();
  const second = queue.job(back);
  assert.equal(second.state, "done", second.detail || second.error);
  assert.equal(fs.readFileSync(second.output, "utf8"), fs.readFileSync(csv, "utf8"));
});

test("files over the size cap are rejected before they are read", async () => {
  const input = temp("convert-in-");
  const output = temp("convert-out-");
  const big = path.join(input, "big.json");
  fs.writeFileSync(big, JSON.stringify("x".repeat(2048)));
  const queue = createConverter({ limits: { image: 1024, data: 1024 } });
  queue.setOutputFolder(output);
  const [id] = queue.enqueue([{ path: big, target: "json-minified" }]);
  await queue.idle();
  assert.equal(queue.job(id).state, "failed");
  assert.equal(queue.job(id).error, "TOO_LARGE");
  assert.deepEqual(fs.readdirSync(output), []);
});

test("invalid input fails and leaves nothing behind", async () => {
  const input = temp("convert-in-");
  const output = temp("convert-out-");
  const bad = path.join(input, "bad.json");
  fs.writeFileSync(bad, "{not json");
  const queue = createConverter();
  queue.setOutputFolder(output);
  const [id] = queue.enqueue([{ path: bad, target: "csv" }]);
  await queue.idle();
  assert.equal(queue.job(id).state, "failed");
  assert.equal(queue.job(id).error, "JSON_INVALID");
  assert.deepEqual(fs.readdirSync(output), []);
});

test("queued and running jobs can be canceled", async () => {
  const input = temp("convert-in-");
  const output = temp("convert-out-");
  const files = ["a", "b"].map((n) => {
    const file = path.join(input, `${n}.json`);
    fs.writeFileSync(file, "[1,2,3]");
    return file;
  });
  const queue = createConverter();
  queue.setOutputFolder(output);
  const [first, second] = queue.enqueue(files.map((p) => ({ path: p, target: "json-pretty" })));
  assert.equal(queue.cancel(second), true);
  assert.equal(queue.cancel(first), true);
  await queue.idle();
  assert.equal(queue.job(first).state, "canceled");
  assert.equal(queue.job(second).state, "canceled");
  assert.deepEqual(fs.readdirSync(output), []);
});

test("unavailable categories never claim support", async () => {
  const listed = capabilities();
  const unavailable = listed.filter((c) => !c.available);
  assert.deepEqual(unavailable.map((c) => c.id).sort(), ["document", "media"]);
  for (const category of unavailable) {
    assert.deepEqual(category.targets, []);
    assert.equal(category.reason, UNAVAILABLE_REASON);
    for (const ext of category.inputs)
      for (const target of ["png", "jpeg", "json", "csv", "json-pretty", "json-minified", "mp4", "pdf", "webp"])
        assert.equal(planFor(`/x/file.${ext}`, target), null, `${ext} -> ${target}`);
  }
  const output = temp("convert-out-");
  const queue = createConverter();
  const described = queue.inspect(["/x/clip.mov", "/x/report.docx", "/x/unknown.xyz"]);
  assert.ok(described.every((d) => !d.available && d.targets.length === 0 && /^Unavailable/.test(d.reason)));
  const ids = queue.enqueue([{ path: "/x/clip.mov", target: "mp4" }]);
  await queue.idle();
  assert.equal(queue.job(ids[0]).state, "unavailable");
  assert.deepEqual(fs.readdirSync(output), []);
  // No WebP: nativeImage cannot encode it, so it must not be offered.
  assert.equal(planFor("/x/photo.png", "webp"), null);
});

test("available conversions need a chosen output folder", () => {
  const queue = createConverter();
  assert.throws(() => queue.enqueue([{ path: "/x/a.csv", target: "json" }]), /NO_OUTPUT_FOLDER/);
  assert.throws(() => queue.enqueue([{ path: "relative.csv" }]), /INVALID_REQUEST/);
});

test("the converter never starts external programs", () => {
  const source = fs.readFileSync(path.join(__dirname, "converter.cjs"), "utf8");
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /\b(spawn|execFile|execSync|fork)\s*\(/);
});

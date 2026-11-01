const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const converter = require('./converter.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'converter-integrity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, 'input.csv');
  const output = path.join(root, 'output');
  fs.mkdirSync(output);
  fs.writeFileSync(input, 'key\noriginal\n');
  return { input, output, destination: path.join(output, 'input.json') };
}

test('duplicate CSV names never collide with literal or generated column names', () => {
  for (const input of ['a,a,a_2\nfirst,second,third\n', 'column2,,column2_2\nfirst,second,third\n']) {
    const { headers, records } = converter.csvToObjects(input);
    assert.equal(new Set(headers).size, 3);
    assert.deepEqual(headers.map((key) => records[0][key]), ['first', 'second', 'third']);
  }
});

test('special CSV names remain ordinary own data fields through JSON serialization', () => {
  const { records } = converter.csvToObjects('__proto__,constructor,safe\nfirst,second,third\n');
  assert.equal(Object.getPrototypeOf(records[0]), Object.prototype);
  assert.equal(Object.hasOwn(records[0], '__proto__'), true);
  assert.deepEqual(Object.values(JSON.parse(JSON.stringify(records[0]))), ['first', 'second', 'third']);
});

test('same-row output changes fail verification and preserve changed bytes', async (t) => {
  const { input, output, destination } = fixture(t);
  const changed = '[{"key":"modified"}]';
  let injected = false;
  const queue = converter.createConverter({ onChange(state) {
    if (!injected && state.jobs.some((job) => job.stage === 'checking')) {
      injected = true;
      fs.writeFileSync(destination, changed);
    }
  } });
  queue.setOutputFolder(output);
  const [id] = queue.enqueue([{ path: input, target: 'json' }]);
  await queue.idle();
  assert.equal(injected, true);
  assert.equal(queue.job(id).state, 'failed');
  assert.equal(queue.job(id).error, 'VERIFY_FAILED');
  assert.equal(fs.readFileSync(destination, 'utf8'), changed);
});

test('cancellation preserves a replacement destination and removes an unchanged owned output', async (t) => {
  for (const replace of [true, false]) {
    const { input, output, destination } = fixture(t);
    let injected = false;
    let queue;
    queue = converter.createConverter({ onChange(state) {
      const job = state.jobs.find((item) => item.stage === 'checking');
      if (!injected && job) {
        injected = true;
        if (replace) {
          fs.unlinkSync(destination);
          fs.writeFileSync(destination, 'replacement retained');
        }
        queue.cancel(job.id);
      }
    } });
    queue.setOutputFolder(output);
    const [id] = queue.enqueue([{ path: input, target: 'json' }]);
    await queue.idle();
    assert.equal(injected, true);
    assert.equal(queue.job(id).state, 'canceled');
    assert.equal(fs.existsSync(destination), replace);
    if (replace) assert.equal(fs.readFileSync(destination, 'utf8'), 'replacement retained');
  }
});

test('a post-placement temporary unlink fault never retries completed placement', (t) => {
  const { output } = fixture(t);
  const source = fs.readFileSync(path.join(__dirname, 'converter.cjs'), 'utf8');
  const customFs = Object.create(fs);
  customFs.unlinkSync = (file) => {
    if (file.endsWith('.tmp')) throw Object.assign(new Error('Injected temporary removal fault'), { code: 'EPERM' });
    return fs.unlinkSync(file);
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => name === 'node:fs' ? customFs : require(name), process, Buffer, TextDecoder, setImmediate, setTimeout, clearTimeout });
  const placed = module.exports.placeAtomically(output, 'result', 'json', Buffer.from('[1]'));
  assert.equal(placed, path.join(output, 'result.json'));
  assert.deepEqual(fs.readdirSync(output).filter((name) => name.endsWith('.json')), ['result.json']);
  assert.equal(fs.readFileSync(placed, 'utf8'), '[1]');
});

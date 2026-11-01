import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

function verify() {
  const fail = message => { const error = new Error(message); error.safeMessage = message; throw error; };
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const desktop = path.join(root, 'apps/desktop');
  const load = createRequire(path.join(desktop, 'package.json'));
  const { parseDocument } = load('htmlparser2');
  const postcss = load('postcss');
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--dist')) fail('Use --dist <built-directory>');
  const dist = fs.realpathSync(args[1] ? path.resolve(args[1]) : path.join(desktop, 'dist'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const requiredFonts = new Map([
    ['29337f1432ce34984214e9d0b02f489f53e96e55dc1035258fcb7e74413ec7a7', 'Noto Sans HK subset 17 WOFF2'],
    ['2eec0e8861fd9dd90c0e8d6f354ec635c96d02543382f814ba8111249bff79fc', 'Noto Sans HK subset 98 WOFF2'],
    ['34e65dc4e3deafe3d668d398a26c6a292730fe356a6a1f4303d5af3919a0e941', 'Roboto Greek extended 400 WOFF2'],
    ['02b4d89306066a2698c1e9f44463917fdbf17426c06789a52819d9f5f467cd64', 'Roboto Greek extended 400 WOFF'],
    ['e44efd49524d8b9ba8cb4b627aeac4aa34524e11d9bf67a57becf0740bb58d88', 'Roboto Greek extended 500 WOFF2'],
    ['61d982d5f6183523de5b328ec77d0ac46dbd4b72a7359530e61e14669b4334c9', 'Roboto Greek extended 500 WOFF'],
  ]);
  const inside = (base, file) => { const relative = path.relative(base, file); return relative !== '' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
  function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail('Linked asset trees are not supported by this check');
      return entry.isDirectory() ? files(file) : entry.isFile() ? [file] : [];
    });
  }
  const document = parseDocument(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'));
  const html = document.children.filter(node => node.type === 'tag' && node.name === 'html');
  const elements = html.length === 1 ? html[0].children.filter(node => ['tag', 'script', 'style'].includes(node.type)) : [];
  const heads = elements.filter(node => node.type === 'tag' && node.name === 'head');
  if (heads.length !== 1 || elements[0] !== heads[0]) fail('The built document must have one explicit leading head element');
  const policies = heads[0].children.filter(node => node.type === 'tag' && node.name === 'meta' &&
    node.attribs['http-equiv']?.toLowerCase() === 'content-security-policy').map(node => node.attribs.content || '');
  const trimAscii = value => value.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '');
  const fontDirectives = policies.length === 1 ? policies[0].split(';').map(trimAscii).filter(value => /^font-src(?:[ \t\r\n\f]|$)/i.test(value)) : [];
  if (fontDirectives.length !== 1 || fontDirectives[0].split(/[ \t\r\n\f]+/).join(' ').toLowerCase() !== "font-src 'self'") fail('The expected self-only font policy changed');
  const manifest = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'));
  const sourceHashes = new Set();
  for (const name of Object.keys(manifest.dependencies || {}).filter(name => /^@fontsource(?:-variable)?\/[a-z0-9-]+$/.test(name))) {
    const directory = path.join(desktop, 'node_modules', name, 'files');
    for (const file of files(directory).filter(file => /\.(?:woff2?|ttf|otf)$/i.test(file))) sourceHashes.add(hash(fs.readFileSync(file)));
  }
  if (!sourceHashes.size) fail('No declared bundled font sources were found');
  const referenced = new Set();
  const deliveredHashes = new Set();
  let declarations = 0, references = 0;
  for (const css of files(dist).filter(file => file.endsWith('.css'))) {
    const sheet = postcss.parse(fs.readFileSync(css, 'utf8'), { from: css });
    sheet.walkAtRules(face => {
      if (face.name.includes('\\')) fail('Escaped at-rule identifiers require an explicit parser extension');
      if (face.name.toLowerCase() !== 'font-face') return;
      declarations++;
      let faceReferences = 0;
      face.walkDecls(declaration => {
        if (declaration.prop.includes('\\')) fail('Escaped font property syntax requires an explicit parser extension');
        if (declaration.prop.toLowerCase() !== 'src') return;
        if (declaration.value.includes('\\')) fail('Escaped font source syntax requires an explicit parser extension');
        for (const match of declaration.value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi)) {
          references++;
          faceReferences++;
          const url = match[1] ?? match[2] ?? match[3];
          if (/^[a-z][a-z0-9+.-]*:|^[/\\]/i.test(url)) fail('A bundled font URL is incompatible with the self-only policy');
          const candidate = path.resolve(path.dirname(css), decodeURIComponent(url.split(/[?#]/)[0]));
          if (!inside(dist, candidate)) fail('A font reference escapes the built asset inventory');
          const file = fs.realpathSync(candidate);
          if (!inside(dist, file) || !fs.statSync(file).isFile() || !/\.(?:woff2?|ttf|otf)$/i.test(file)) fail('A font reference escapes the built asset inventory');
          const digest = hash(fs.readFileSync(file));
          if (!sourceHashes.has(digest)) fail('Emitted font bytes do not match the declared source packages');
          deliveredHashes.add(digest);
          referenced.add(path.relative(dist, file).replaceAll(path.sep, '/'));
        }
      });
      if (!faceReferences) fail('A bundled font declaration has no supported file reference');
    });
  }
  if (!declarations || !references) fail('The built font inventory is empty');
  if ([...requiredFonts.keys()].some(digest => !deliveredHashes.has(digest))) fail('The reviewed required font inventory is absent or changed');
  console.log(JSON.stringify({ passed: true, declarations, references, uniqueFontAssets: referenced.size, requiredFonts: requiredFonts.size, csp: "font-src 'self'", sourceBytesMatched: true }));

}
try { verify(); } catch (error) {
  console.error(error.safeMessage || `Font asset inputs could not be verified (${error.code || 'invalid-input'}).`);
  process.exitCode = 1;
}

/** Linux Electron evidence helpers. These receipts deliberately do not claim Windows HWND or Lowlevel verification. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function hashFile(file) { return sha256(await fs.readFile(file)); }
export async function sourceBinding(root) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', 'apps/desktop', 'crates', 'Cargo.toml', 'Cargo.lock'], { cwd: root }).toString().split('\0').filter(Boolean).sort();
  const files = [];
  for (const name of names) {
    try { files.push({ path: name, sha256: await hashFile(path.join(root, name)) }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; files.push({ path: name, deleted: true }); }
  }
  return { commit, treeSha256: sha256(JSON.stringify(files)), files };
}
export async function artifactBinding(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else files.push({ path: path.relative(root, filename), sha256: await hashFile(filename) });
    }
  }
  await walk(path.join(root, 'apps/desktop/dist'));
  await walk(path.join(root, 'apps/desktop/electron'));
  const host = path.join(root, 'target/release/material-browser');
  try { files.push({ path: path.relative(root, host), sha256: await hashFile(host) }); } catch {}
  return { sha256: sha256(JSON.stringify(files)), files };
}
export async function measure(page) {
  return page.evaluate(() => {
    const fields = ['display','position','boxSizing','width','minWidth','maxWidth','height','minHeight','maxHeight','color','backgroundColor','borderColor','margin','padding','gap','flexDirection','flexBasis','flexGrow','flexShrink','gridTemplateColumns','gridTemplateRows','alignItems','justifyContent','overflowX','overflowY','transform','fontFamily','fontSize','lineHeight','visibility','opacity','zIndex'];
    const rect = element => { const r = element.getBoundingClientRect(); return Object.fromEntries(['x','y','top','right','bottom','left','width','height'].map(k => [k,r[k]])); };
    const describe = element => { const c = getComputedStyle(element); return { tag:element.tagName, className: typeof element.className === 'string' ? element.className : '', rect:rect(element), computed:Object.fromEntries(fields.map(k => [k,c[k]])), scrollWidth:element.scrollWidth, clientWidth:element.clientWidth, scrollHeight:element.scrollHeight, clientHeight:element.clientHeight }; };
    const selectors = ['html','body','.app-shell','.body','.workspace-plane','.workspace-disclosure','.app-header','.workspace-nav','.workspace-main','.workspace-tabs','.settings-workspace','.settings-layout','.settings-panel','.setting-row','.profile-table','.profile-inspector','.surface','.modal','[role="dialog"]'];
    const elements = [];
    for (const selector of selectors) {
      const matches = Array.from(document.querySelectorAll(selector));
      matches.forEach((element,index) => {
        const r = element.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(element).visibility === 'hidden') return;
        elements.push({ selector,matchedCount:matches.length,chosenIndex:index,...describe(element),ancestors:Array.from((function*(){let p=element.parentElement;for(let n=0;p&&n<4;n++,p=p.parentElement)yield p;})()).map(describe) });
      });
    }
    const dialogHosts = Array.from(document.querySelectorAll('md-dialog'));
    dialogHosts.forEach((host,index) => {
      const dialog = host.shadowRoot?.querySelector('dialog');
      if (!dialog) return;
      const r = dialog.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(dialog).visibility === 'hidden') return;
      elements.push({ selector:'md-dialog::shadow dialog',matchedCount:dialogHosts.length,chosenIndex:index,...describe(dialog),ancestors:[describe(host),describe(document.documentElement)] });
    });
    const escaped = Array.from(document.querySelectorAll('button,input,select,textarea,md-filled-button,md-outlined-button,md-text-button,[role="tab"]')).filter(e => { const r=e.getBoundingClientRect(); return r.width&&r.height&&(r.left < -1 || r.right > innerWidth+1); }).map(e=>({tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,100),rect:rect(e)}));
    return { viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},document:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight},presentation:{...document.documentElement.dataset},fonts:{status:document.fonts.status,faces:Array.from(document.fonts).map(face=>({family:face.family,weight:face.weight,style:face.style,status:face.status})),roboto:document.fonts.check('14px Roboto'),robotoMono:document.fonts.check('14px "Roboto Mono"')},focused:{tag:document.activeElement?.tagName,id:document.activeElement?.id},elements,controlsOutsideViewportX:escaped };
  });
}
export async function capture({page,app,output,id,stateIds=[],tuple={},binding,runtime,notes=[]}) {
  await fs.mkdir(output,{recursive:true});
  await page.evaluate(() => document.fonts.ready);
  const screenshot = path.join(output,`${id}.png`);
  const captured = await app.evaluate(async ({BrowserWindow}) => { const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage(); return { base64:image.toPNG().toString('base64'), size:image.getSize() }; });
  await fs.writeFile(screenshot,Buffer.from(captured.base64,'base64'));
  const measurements = await measure(page);
  const visibleText = await page.locator('body').innerText();
  const processIdentity = await app.evaluate(({app,BrowserWindow}) => ({pid:process.pid,executable:process.execPath,platform:process.platform,version:process.versions.electron,userData:app.getPath('userData'),windows:BrowserWindow.getAllWindows().map(w=>({id:w.id,title:w.getTitle(),bounds:w.getBounds(),contentBounds:w.getContentBounds(),url:w.webContents.getURL(),zoomFactor:w.webContents.getZoomFactor(),rendererPid:w.webContents.getOSProcessId()}))}));
  const receipt = {version:1,kind:'linux-electron-dom-layout',route:'electron-playwright-xvfb',capturedAt:new Date().toISOString(),id,stateIds,tuple,source:binding.source,artifact:binding.artifact,buildReceipt:{path:binding.path,sha256:binding.sha256},screenshot:{path:screenshot,sha256:await hashFile(screenshot),...captured.size},processIdentity,visibleText,privacy:{taskOwnedProfile:true,visibleDesktopUntouched:true},measurements,runtime:structuredClone(runtime),notes,exclusions:['No Windows HWND, Lowlevel, OS scaling, installer, or sound audibility verification.','Linux Electron runtime with a locally built Linux Rust host, where available.']};
  await fs.writeFile(path.join(output,`${id}.json`),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}

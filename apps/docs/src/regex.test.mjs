import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./regex.worker.js',import.meta.url),'utf8');
function evaluate(data){let result;const context={self:{postMessage:value=>result=value}};vm.runInNewContext(source,context);context.self.onmessage({data});return result;}
test('regex isolates plain flags, unicode captures and zero width results',()=>{const result=evaluate({pattern:'(?<word>保管庫)',flags:'u',items:['保管庫','other']});assert.equal(result.indices.join(','),'0');assert.equal(result.captures[0][1],'保管庫');assert.equal(evaluate({pattern:'^',flags:'m',items:['a','b']}).indices.length,2);});
test('invalid and unsupported expressions produce explicit errors',()=>{assert.ok(evaluate({pattern:'(',flags:'i',items:['text']}).error);assert.ok(evaluate({pattern:'x',flags:'g',items:['x']}).error);assert.ok(evaluate({pattern:'x'.repeat(513),flags:'i',items:['x']}).error);});

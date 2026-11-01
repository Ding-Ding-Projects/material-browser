import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileModels, readQueue, batchEstimate, catalogueVariants } from './model-state.mjs';
test('reconciliation retains installed-only identities and actual running state', () => {
  const rows = reconcileModels([{name:'a:1',size:10},{name:'a:2'}], [{name:'local:1'},{name:'a:1',digest:'abc'}], [{model:'a:1'}]);
  assert.equal(rows.length,3); assert.equal(rows[0].digest,'abc'); assert.equal(rows[0].running,true); assert.equal(rows[1].installed,false); assert.equal(rows[2].installed,true);
});
test('queue restore bounds and deduplicates untrusted persisted values', () => {
  assert.deepEqual(readQueue(['a',null,'a','', 'b']), ['a','b']); assert.deepEqual(readQueue({}),[]); assert.equal(readQueue(Array.from({length:100},(_,i)=>String(i))).length,50);
});
test('missing sizes never become a complete zero-byte estimate', () => {
  assert.deepEqual(batchEstimate(['a','b'],[{name:'a',size:12}]),{bytes:12,unknown:1,complete:false});
  assert.deepEqual(batchEstimate(['a'],[{name:'a',size:12}]),{bytes:12,unknown:0,complete:true});
});

test('catalogue families are never invented as exact pull variants', () => {
  assert.deepEqual(catalogueVariants([{name:'family',tags:[{name:'family:1'},{name:'family:2'}]},{name:'other'}]), [{name:'family:1'},{name:'family:2'}]);
});

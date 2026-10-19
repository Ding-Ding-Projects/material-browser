import test from 'node:test';
import assert from 'node:assert/strict';
import { operationFailure } from './operation-errors.mjs';

test('wrapped identity capability errors explain the unavailable guarantee in both languages', () => {
  const direct = operationFailure(new Error('IDENTITY_UNAVAILABLE'));
  const wrapped = operationFailure(new Error("Error invoking remote method 'material:request': Error: IDENTITY_UNAVAILABLE"));
  assert.deepEqual(wrapped, direct);
  assert.match(wrapped[0], /No browser was launched/);
  assert.match(wrapped[1], /未有啟動/);
});
test('unknown host text is never reflected into notification or narration copy', () => {
  for (const error of [new Error('private path and secret-shaped data'), new Error('IDENTITY_UNAVAILABLE: extra text'), new Error('unrecognized wrapper: IDENTITY_UNAVAILABLE'), 'IDENTITY_UNAVAILABLE', null]) {
    const result = operationFailure(error);
    assert.match(result[0], /could not be completed/);
    assert.doesNotMatch(result.join(' '), /private path|secret-shaped|material:request/);
  }
});
test('missing engine remains an actionable installation state, not an identity promise', () => {
  assert.match(operationFailure(new Error('ENGINE_UNAVAILABLE'))[0], /supported engine bundle/);
});

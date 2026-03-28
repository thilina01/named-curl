import assert from 'assert';

import { parseCurlCommand } from '../shared/curl.js';
import {
  extractVariableNamesFromString,
  resolveVariablesInString,
  shouldSkipRequestHeaderName
} from '../shared/request.js';
import {
  normalizeCommand,
  normalizeHeaders,
  normalizePathSegments,
  normalizeTags,
  normalizeVariableBindings
} from '../shared/storage.js';
import { formatJsonPath, serializeJsonValue } from '../shared/utils.js';

const curlCommand = parseCurlCommand(
  `curl -X POST "https://api.example.com/users" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Ada"}'`
);

assert.strictEqual(curlCommand.method, 'POST');
assert.strictEqual(curlCommand.url, 'https://api.example.com/users');
assert.strictEqual(curlCommand.headers.length, 2);
assert.strictEqual(curlCommand.body, '{"name":"Ada"}');

const normalizedCommand = normalizeCommand({
  id: 'cmd_1',
  name: 'Users',
  method: 'post',
  url: 'https://api.example.com/users',
  tags: ['users', 'admin', 'users'],
  headers: '{\n  "Accept": "application/json"\n}',
  body: ''
});

assert.deepStrictEqual(normalizedCommand.headers, [
  {
    key: 'Accept',
    value: 'application/json'
  }
]);
assert.strictEqual(normalizedCommand.method, 'POST');
assert.deepStrictEqual(normalizedCommand.tags, ['users', 'admin']);

assert.deepStrictEqual(normalizeTags('users, admin\nusers'), ['users', 'admin']);

const migratedCommand = normalizeCommand({
  id: 'cmd_legacy',
  name: 'Legacy Users',
  method: 'GET',
  url: 'https://api.example.com/legacy-users',
  collectionId: 'col_legacy',
  headers: [],
  body: ''
}, {
  legacyCollectionsById: new Map([['col_legacy', 'Legacy']])
});

assert.deepStrictEqual(migratedCommand.tags, ['Legacy']);

assert.deepStrictEqual(normalizeHeaders('Authorization: Bearer token\nX-Test: 1'), [
  { key: 'Authorization', value: 'Bearer token' },
  { key: 'X-Test', value: '1' }
]);

assert.strictEqual(
  resolveVariablesInString('https://api.example.com/$USER_ID?token=${TOKEN}', {
    USER_ID: '42',
    TOKEN: 'abc'
  }),
  'https://api.example.com/42?token=abc'
);

assert.deepStrictEqual(
  extractVariableNamesFromString('Bearer $TOKEN and ${USER_ID} and \\$ESCAPED'),
  ['TOKEN', 'USER_ID']
);

assert.strictEqual(shouldSkipRequestHeaderName('content-length'), true);
assert.strictEqual(shouldSkipRequestHeaderName('authorization'), false);

assert.deepStrictEqual(normalizePathSegments('response.data[0].id'), ['data', 0, 'id']);
assert.strictEqual(formatJsonPath(['data', 0, 'id']), 'response.data[0].id');
assert.strictEqual(serializeJsonValue({ ok: true }), '{\n  "ok": true\n}');

const bindings = normalizeVariableBindings([
  {
    variableKey: 'USER_ID',
    path: 'response.data[0].id',
    sourceRequestName: 'Users',
    sourceRequestUrl: 'https://api.example.com/users'
  }
], [
  {
    id: 'cmd_users',
    name: 'Users',
    url: 'https://api.example.com/users'
  }
]);

assert.deepStrictEqual(bindings, [
  {
    variableKey: 'USER_ID',
    segments: ['data', 0, 'id'],
    path: 'response.data[0].id',
    commandId: 'cmd_users',
    sourceRequestName: 'Users',
    sourceRequestUrl: 'https://api.example.com/users'
  }
]);

console.log('Shared module tests passed.');

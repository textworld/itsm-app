import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('ticket submit form loads and clears optional system classification', () => {
  assert.match(source, /selectedClassificationConfig/);
  assert.match(source, /\/api\/config\/dictionaries\/options\?type=/);
  assert.match(source, /ticketClassificationOptionId/);
  assert.match(source, /form\.setFieldsValue\(\{[\s\S]*systemName: undefined,[\s\S]*ticketClassificationOptionId: undefined/);
  assert.match(source, /onChange=\{\(\) => form\.setFieldValue\('ticketClassificationOptionId', undefined\)\}/);
});

test('ticket submit payload includes classification only when selected', () => {
  assert.match(source, /ticketClassification: values\.ticketClassificationOptionId/);
  assert.match(source, /optionId: values\.ticketClassificationOptionId/);
  assert.match(source, /dictionaryType: selectedSystem\?\.ticketClassification\?\.dictionaryType/);
});

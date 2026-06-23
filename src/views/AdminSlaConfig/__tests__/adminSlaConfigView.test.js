import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  new URL('../index.jsx', import.meta.url),
  'utf8'
);

test('SLA config view manages channel and priority rules through admin API', () => {
  assert.match(source, /\/api\/admin\/sla-rules/);
  assert.match(source, /SLA 配置/);
  assert.match(source, /生产系统数据提取/);
  assert.match(source, /生产系统数据修正/);
  assert.match(source, /账号及权限申请/);
  assert.match(source, /常规咨询问题/);
  assert.match(source, /P0/);
  assert.match(source, /P1/);
  assert.match(source, /P2/);
  assert.match(source, /P3/);
  assert.match(source, /响应时效/);
  assert.match(source, /首次处理时效/);
  assert.match(source, /办结时效/);
  assert.match(source, /多级预警/);
  assert.match(source, /自动升级/);
  assert.match(source, /启用/);
  assert.match(source, /停用/);
  assert.match(source, /method: 'PUT'/);
});

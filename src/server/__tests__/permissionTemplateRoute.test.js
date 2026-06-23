import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as templateGet } from '../../../app/api/templates/permission-request/route.js';

test('权限申请模板接口返回可下载的 Excel 模板', async () => {
  const response = await templateGet();
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.ms-excel; charset=utf-8');
  assert.match(response.headers.get('content-disposition'), /filename\*=UTF-8''%E6%9D%83%E9%99%90%E7%94%B3%E8%AF%B7%E6%A8%A1%E6%9D%BF\.xls/);
  assert.match(body, /申请人/);
  assert.match(body, /权限范围/);
});

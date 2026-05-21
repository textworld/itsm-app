import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appLayoutSource = fs.readFileSync(
  new URL('../AppLayout.jsx', import.meta.url),
  'utf8'
);

const globalCssSource = fs.readFileSync(
  new URL('../../../index.css', import.meta.url),
  'utf8'
);

test('整体布局改为上下结构，菜单放到顶部且不再使用左侧栏', () => {
  assert.doesNotMatch(appLayoutSource, /<Sider\b/);
  assert.match(appLayoutSource, /const \{ Header, Content \} = Layout;/);
  assert.match(appLayoutSource, /<Header[\s\S]*<Menu[\s\S]*mode="horizontal"/);
});

test('顶部导航栏不使用固定定位', () => {
  assert.doesNotMatch(appLayoutSource, /position:\s*'sticky'/);
  assert.doesNotMatch(globalCssSource, /\.app-shell-header\s*\{[^}]*position:\s*sticky;/);
});

test('顶部导航使用更收紧的后台样式类', () => {
  assert.match(appLayoutSource, /className="app-shell"/);
  assert.match(appLayoutSource, /className="app-shell-header"/);
  assert.match(appLayoutSource, /className="app-shell-brand"/);
  assert.match(appLayoutSource, /className="app-shell-nav"/);
  assert.match(appLayoutSource, /className="app-shell-toolbar"/);
  assert.match(globalCssSource, /\.app-shell-header\s*\{/);
  assert.match(globalCssSource, /\.app-shell-nav\s+\.ant-menu/);
  assert.match(globalCssSource, /\.app-shell-toolbar\s*\{/);
});

test('support roles have a history ticket list entry in the top navigation', () => {
  assert.match(appLayoutSource, /HistoryOutlined/);
  assert.match(appLayoutSource, /user\?\.role === ROLES\.L1 \|\| user\?\.role === ROLES\.L2/);
  assert.match(appLayoutSource, /href="\/tickets\/history"/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/tickets\/history'\)/);
});

test('support roles have a personal quick phrases configuration entry', () => {
  assert.match(appLayoutSource, /ProfileOutlined/);
  assert.match(appLayoutSource, /href="\/personal\/quick-phrases"/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/personal\/quick-phrases'\)/);
  assert.match(appLayoutSource, /个人配置/);
  assert.match(appLayoutSource, /常用话术/);
});

test('administrator entries are grouped under a second-level admin menu', () => {
  assert.match(appLayoutSource, /user\?\.role === ROLES\.ADMIN/);
  assert.match(appLayoutSource, /key: 'admin-management'/);
  assert.match(appLayoutSource, /label: '后台管理'/);
  assert.match(appLayoutSource, /children:/);
  assert.match(appLayoutSource, /href="\/admin\/users"/);
  assert.match(appLayoutSource, /href="\/dictionaries\/insurance-types"/);
  assert.match(appLayoutSource, /href="\/systems"/);
  assert.match(appLayoutSource, /href="\/schedules"/);
  assert.match(appLayoutSource, /href="\/support-rests"/);
  assert.match(appLayoutSource, /href="\/data-fix-schemes"/);
  assert.match(appLayoutSource, /href="\/oa-simulator"/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/admin\/users'\)/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/dictionaries\/insurance-types'\)/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/systems'\)/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/schedules'\)/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/support-rests'\)/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/data-fix-schemes'\)/);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/oa-simulator'\)/);
  assert.match(appLayoutSource, /账号管理/);
  assert.match(appLayoutSource, /险种词典/);
  assert.match(appLayoutSource, /系统配置/);
  assert.match(appLayoutSource, /排班配置/);
  assert.match(appLayoutSource, /休息时间配置/);
  assert.match(appLayoutSource, /数据修正方案/);
  assert.match(appLayoutSource, /OA 模拟审批台/);
});

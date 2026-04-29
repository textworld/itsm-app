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

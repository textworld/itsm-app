import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getProtectedRouteRedirect,
  getLoginRedirectHref
} from '../protectedRoute.js';

test('未登录访问受保护页时返回登录跳转地址', () => {
  const redirectHref = getProtectedRouteRedirect(
    {
      get() {
        return undefined;
      }
    },
    '/tickets'
  );

  assert.equal(redirectHref, '/login?from=%2Ftickets');
});

test('已登录访问受保护页时不需要跳转', () => {
  const redirectHref = getProtectedRouteRedirect(
    {
      get(name) {
        if (name !== 'itsm_session_user_id') return undefined;
        return { value: 'u_requester_1' };
      }
    },
    '/tickets'
  );

  assert.equal(redirectHref, null);
});

test('登录跳转地址会正确编码原始路径', () => {
  assert.equal(
    getLoginRedirectHref('/tickets/TKT-20260410-0001?tab=messages'),
    '/login?from=%2Ftickets%2FTKT-20260410-0001%3Ftab%3Dmessages'
  );
});

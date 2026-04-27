import { getSessionUserFromRequest } from './session.js';

export function getLoginRedirectHref(pathname = '/tickets') {
  return `/login?from=${encodeURIComponent(pathname)}`;
}

export function getProtectedRouteRedirect(cookieStore, pathname = '/tickets') {
  const user = getSessionUserFromRequest({ cookies: cookieStore });
  return user ? null : getLoginRedirectHref(pathname);
}

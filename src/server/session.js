import { getUserById } from './store.js';

const SESSION_COOKIE_NAME = 'itsm_session_user_id';
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 20;

export function buildSessionCookieOptions(userId, now = new Date()) {
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 20);

  return {
    name: SESSION_COOKIE_NAME,
    value: userId,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    expires
  };
}

export function buildClearedSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  };
}

export function createSessionCookie(response, userId) {
  response.cookies.set(buildSessionCookieOptions(userId));
}

export function clearSessionCookie(response) {
  response.cookies.set(buildClearedSessionCookieOptions());
}

export function getSessionUserFromRequest(request) {
  const userId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return userId ? getUserById(userId) : null;
}

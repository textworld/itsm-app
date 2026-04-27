import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import StateMachinePage from '../../../src/views/StateMachine/index.jsx';
import { getProtectedRouteRedirect } from '../../../src/server/protectedRoute.js';

export default async function Page() {
  const redirectHref = getProtectedRouteRedirect(await cookies(), '/state-machine');
  if (redirectHref) {
    redirect(redirectHref);
  }
  return <StateMachinePage />;
}

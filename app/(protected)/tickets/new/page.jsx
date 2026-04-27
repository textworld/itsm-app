import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TicketSubmitPage from '../../../../src/views/TicketSubmit/index.jsx';
import { getProtectedRouteRedirect } from '../../../../src/server/protectedRoute.js';

export default async function Page() {
  const redirectHref = getProtectedRouteRedirect(await cookies(), '/tickets/new');
  if (redirectHref) {
    redirect(redirectHref);
  }
  return <TicketSubmitPage />;
}

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TicketListPage from '../../../src/views/TicketList/index.jsx';
import { getProtectedRouteRedirect } from '../../../src/server/protectedRoute.js';

export default async function Page() {
  const redirectHref = getProtectedRouteRedirect(await cookies(), '/tickets');
  if (redirectHref) {
    redirect(redirectHref);
  }
  return <TicketListPage />;
}

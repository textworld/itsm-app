import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TicketDetailPage from '../../../../src/views/TicketDetail/index.jsx';
import { getProtectedRouteRedirect } from '../../../../src/server/protectedRoute.js';

export default async function Page({ params }) {
  const resolvedParams = await params;
  const ticketId = resolvedParams?.id;
  const redirectHref = getProtectedRouteRedirect(
    await cookies(),
    ticketId ? `/tickets/${ticketId}` : '/tickets'
  );
  if (redirectHref) {
    redirect(redirectHref);
  }
  return <TicketDetailPage />;
}

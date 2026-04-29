import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TicketListPage from '../../../../src/views/TicketList/index.jsx';
import { getProtectedRouteRedirect } from '../../../../src/server/protectedRoute.js';
import { TICKET_LIST_MODES } from '../../../../src/utils/ticketListView.js';

export default async function Page() {
  const redirectHref = getProtectedRouteRedirect(await cookies(), '/tickets/history');
  if (redirectHref) {
    redirect(redirectHref);
  }
  return <TicketListPage mode={TICKET_LIST_MODES.HISTORY} />;
}

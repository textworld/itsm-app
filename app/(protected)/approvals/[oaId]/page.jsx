import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ApprovalDetailPage from '../../../../src/views/ApprovalDetail/index.jsx';
import { getProtectedRouteRedirect } from '../../../../src/server/protectedRoute.js';

export default async function Page({ params }) {
  const resolvedParams = await params;
  const oaId = resolvedParams?.oaId;
  const redirectHref = getProtectedRouteRedirect(
    await cookies(),
    oaId ? `/approvals/${oaId}` : '/tickets'
  );
  if (redirectHref) {
    redirect(redirectHref);
  }

  return <ApprovalDetailPage />;
}

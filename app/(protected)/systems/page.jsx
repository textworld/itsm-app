import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminSystemsPage from '../../../src/views/AdminSystems/index.jsx';
import { getSessionUserFromRequest } from '../../../src/server/session.js';
import { getLoginRedirectHref } from '../../../src/server/protectedRoute.js';
import { ROLES } from '../../../src/constants/roles.js';

export default async function SystemsPage() {
  const user = getSessionUserFromRequest({ cookies: await cookies() });

  if (!user) {
    redirect(getLoginRedirectHref('/systems'));
  }

  if (user.role !== ROLES.ADMIN) {
    redirect('/tickets');
  }

  return (
    <div className="admin-config-page">
      <AdminSystemsPage />
    </div>
  );
}

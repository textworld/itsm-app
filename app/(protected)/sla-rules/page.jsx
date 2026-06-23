import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminSlaConfigPage from '../../../src/views/AdminSlaConfig/index.jsx';
import { ROLES } from '../../../src/constants/roles.js';
import { getLoginRedirectHref } from '../../../src/server/protectedRoute.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';

export default async function Page() {
  const user = getSessionUserFromRequest({ cookies: await cookies() });
  if (!user) {
    redirect(getLoginRedirectHref('/sla-rules'));
  }

  if (user.role !== ROLES.ADMIN) {
    return <NoAdminPermission />;
  }

  return <AdminSlaConfigPage />;
}

function NoAdminPermission() {
  return (
    <div className="admin-config-page">
      <div style={{ padding: 24, background: '#fff', border: '1px solid #f0f0f0' }}>
        无管理员权限
      </div>
    </div>
  );
}

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminAnnouncementsPage from '../../../src/views/AdminAnnouncements/index.jsx';
import { ROLES } from '../../../src/constants/roles.js';
import { getLoginRedirectHref } from '../../../src/server/protectedRoute.js';
import { getSessionUserFromRequest } from '../../../src/server/session.js';

const ANNOUNCEMENT_MANAGER_ROLES = [ROLES.ADMIN, ROLES.L1, ROLES.L2];

export default async function Page() {
  const user = getSessionUserFromRequest({ cookies: await cookies() });
  if (!user) {
    redirect(getLoginRedirectHref('/announcements'));
  }

  if (!ANNOUNCEMENT_MANAGER_ROLES.includes(user.role)) {
    return <NoAdminPermission />;
  }

  return <AdminAnnouncementsPage />;
}

function NoAdminPermission() {
  return (
    <div className="admin-config-page">
      <div style={{ padding: 24, background: '#fff', border: '1px solid #f0f0f0' }}>
        无公告管理权限
      </div>
    </div>
  );
}

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ScheduleDetailPage from '../../../../src/views/AdminScheduleConfig/ScheduleDetailPage.jsx';
import { ROLES } from '../../../../src/constants/roles.js';
import { getLoginRedirectHref } from '../../../../src/server/protectedRoute.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export default async function Page({ params }) {
  const { groupId } = await params;
  const user = getSessionUserFromRequest({ cookies: await cookies() });
  const returnPath = `/schedules/${groupId}`;

  if (!user) {
    redirect(getLoginRedirectHref(returnPath));
  }

  if (user.role !== ROLES.ADMIN) {
    return <NoAdminPermission />;
  }

  return <ScheduleDetailPage mode="edit" groupId={groupId} />;
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

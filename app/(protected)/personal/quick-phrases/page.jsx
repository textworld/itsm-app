import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PersonalQuickPhrasesPage from '../../../../src/views/PersonalQuickPhrases/index.jsx';
import { ROLES } from '../../../../src/constants/roles.js';
import { getLoginRedirectHref } from '../../../../src/server/protectedRoute.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export default async function Page() {
  const user = getSessionUserFromRequest({ cookies: await cookies() });
  if (!user) {
    redirect(getLoginRedirectHref('/personal/quick-phrases'));
  }

  if (user.role !== ROLES.L1 && user.role !== ROLES.L2) {
    return <NoSupportPermission />;
  }

  return <PersonalQuickPhrasesPage />;
}

function NoSupportPermission() {
  return (
    <div className="admin-config-page">
      <div style={{ padding: 24, background: '#fff', border: '1px solid #f0f0f0' }}>
        仅技术支持可维护个人常用话术
      </div>
    </div>
  );
}

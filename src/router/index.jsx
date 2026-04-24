import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout.jsx';
import LoginPage from '../pages/Login/index.jsx';
import TicketListPage from '../pages/TicketList/index.jsx';
import TicketSubmitPage from '../pages/TicketSubmit/index.jsx';
import TicketDetailPage from '../pages/TicketDetail/index.jsx';
import StateMachinePage from '../pages/StateMachine/index.jsx';
import NotFoundPage from '../pages/NotFound.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';

/**
 * 登录守卫：未登录自动跳转到 /login，并携带 from 以便登录后回跳
 */
function RequireAuth({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/tickets" replace />;
  }
  return children;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route path="tickets" element={<TicketListPage />} />
        <Route
          path="tickets/new"
          element={
            <RequireAuth allowedRoles={[ROLES.REQUESTER]}>
              <TicketSubmitPage />
            </RequireAuth>
          }
        />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="state-machine" element={<StateMachinePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

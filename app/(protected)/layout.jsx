import ProtectedShell from '../../src/components/auth/ProtectedShell.jsx';

export default function ProtectedLayout({ children }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}

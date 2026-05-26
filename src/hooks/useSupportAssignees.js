'use client';

import { useEffect, useState } from 'react';

export function useSupportAssignees(role = '') {
  const [assignees, setAssignees] = useState([]);

  useEffect(() => {
    let active = true;
    const query = role ? `?role=${encodeURIComponent(role)}` : '';

    (async () => {
      try {
        const response = await fetch(`/api/config/support-assignees${query}`, { cache: 'no-store' });
        const data = await response.json();
        if (active && response.ok && data?.ok !== false) {
          setAssignees(data.users || []);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setAssignees([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [role]);

  return assignees;
}

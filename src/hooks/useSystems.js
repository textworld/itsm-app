import { useEffect, useState } from 'react';
import { normalizeSystemOptions } from '../constants/systems.js';

export function useSystems() {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    (async () => {
      try {
        const response = await fetch('/api/systems', { cache: 'no-store' });
        const payload = await response.json();
        if (!active) return;
        if (!response.ok || payload?.ok === false) {
          setSystems([]);
          return;
        }
        setSystems(normalizeSystemOptions(payload.systems || []));
      } catch (error) {
        console.error(error);
        if (active) setSystems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { systems, loading };
}

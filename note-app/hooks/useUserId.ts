// hooks/useUserId.ts
import { useEffect, useState } from 'react';
import { getUserId } from '../utils/auth';

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };

    fetchUserId();
  }, []);

  return userId;
}

import { useEffect, type PropsWithChildren } from 'react';
import { useProjectStore } from '@/store/project.store';

export function AppProviders({ children }: PropsWithChildren) {
  const restore = useProjectStore((state) => state.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return children;
}

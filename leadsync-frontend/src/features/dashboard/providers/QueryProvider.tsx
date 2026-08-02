import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onEvent } from '../../../lib/socketClient';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
      refetchOnMount: true,
    },
  },
});

export const DashboardQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };
    const unsub1 = onEvent('order_created', invalidate);
    const unsub2 = onEvent('order_updated', invalidate);
    const unsub3 = onEvent('payment_confirmed', invalidate);
    const unsub4 = onEvent('dashboard_metrics_updated', invalidate);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

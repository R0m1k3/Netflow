import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { NetflowMobile, initializeNetflowMobile } from './NetflowMobile';

interface NetflowContextValue {
  netflow: NetflowMobile | null;
  isLoading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isConnected: boolean;
  refresh: () => Promise<void>;
}

const NetflowContext = createContext<NetflowContextValue>({
  netflow: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
  isConnected: false,
  refresh: async () => { },
});

interface NetflowProviderProps {
  children: React.ReactNode;
}

export function NetflowProvider({ children }: NetflowProviderProps) {
  const [netflow, setNetflow] = useState<NetflowMobile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    isConnected: false,
  });

  const initialize = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const instance = await initializeNetflowMobile();
      setNetflow(instance);
      setAuthState({
        isAuthenticated: instance.isPlexAuthenticated,
        isConnected: instance.isConnected,
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to initialize'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initialize();
  }, []);

  const refresh = useCallback(async () => {
    if (netflow) {
      setAuthState({
        isAuthenticated: netflow.isPlexAuthenticated,
        isConnected: netflow.isConnected,
      });
    }
  }, [netflow]);

  const value = useMemo(() => ({
    netflow,
    isLoading,
    error,
    isAuthenticated: authState.isAuthenticated,
    isConnected: authState.isConnected,
    refresh,
  }), [netflow, isLoading, error, authState.isAuthenticated, authState.isConnected, refresh]);

  return (
    <NetflowContext.Provider value={value}>
      {children}
    </NetflowContext.Provider>
  );
}

/**
 * Hook to access NetflowMobile instance
 */
export function useNetflow(): NetflowContextValue {
  return useContext(NetflowContext);
}

/**
 * Hook that throws if Netflow is not loaded
 */
export function useRequireNetflow(): NetflowMobile {
  const { netflow, isLoading, error } = useNetflow();

  if (isLoading) {
    throw new Error('Netflow is still loading');
  }

  if (error) {
    throw error;
  }

  if (!netflow) {
    throw new Error('Netflow is not initialized');
  }

  return netflow;
}

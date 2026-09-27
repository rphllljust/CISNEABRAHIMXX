import { useCallback, useEffect, useRef, useState } from 'react';
import { BackofficeApiError } from './enterprise-api';

export type QueryState<T> =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'denied' }
  | { phase: 'error'; message: string; retryable: boolean; kind: BackofficeApiError['kind'] }
  | { phase: 'ready'; data: T; refreshing?: boolean };

function isAbortError(error: unknown): boolean {
  return typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError';
}

export function useBackofficeQuery<T>(options: {
  enabled?: boolean;
  loader: (signal?: AbortSignal) => Promise<T>;
  mapError: (code: string | undefined, status: number) => string;
  autoLoad?: boolean;
}): {
  state: QueryState<T>;
  reload: (signal?: AbortSignal) => Promise<void>;
  reset: () => void;
  setReady: (data: T) => void;
} {
  const { enabled = true, loader, mapError, autoLoad = true } = options;
  const [state, setState] = useState<QueryState<T>>(enabled && autoLoad ? { phase: 'loading' } : { phase: 'idle' });
  const loaderRef = useRef(loader);
  const mapErrorRef = useRef(mapError);
  const requestSequenceRef = useRef(0);
  loaderRef.current = loader;
  mapErrorRef.current = mapError;

  const reload = useCallback(async (signal?: AbortSignal) => {
    const requestSequence = ++requestSequenceRef.current;

    setState((current) =>
      current.phase === 'ready'
        ? { phase: 'ready', data: current.data, refreshing: true }
        : { phase: 'loading' },
    );

    try {
      const data = await loaderRef.current(signal);
      if (signal?.aborted || requestSequence !== requestSequenceRef.current) {
        return;
      }
      setState({ phase: 'ready', data, refreshing: false });
    } catch (error) {
      if (signal?.aborted || requestSequence !== requestSequenceRef.current || isAbortError(error)) {
        return;
      }
      if (error instanceof BackofficeApiError) {
        if (error.kind === 'denied') {
          setState({ phase: 'denied' });
          return;
        }
        setState({
          phase: 'error',
          message: mapErrorRef.current(error.code, error.status),
          retryable: error.kind === 'network' || error.kind === 'unknown',
          kind: error.kind,
        });
        return;
      }
      setState({
        phase: 'error',
        message: mapErrorRef.current(undefined, 0),
        retryable: true,
        kind: 'unknown',
      });
    }
  }, []);

  const reset = useCallback(() => {
    requestSequenceRef.current += 1;
    setState({ phase: 'idle' });
  }, []);

  const setReady = useCallback((data: T) => {
    requestSequenceRef.current += 1;
    setState({ phase: 'ready', data, refreshing: false });
  }, []);

  useEffect(() => {
    if (!enabled || !autoLoad) {
      return;
    }
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [autoLoad, enabled, reload]);

  return { state, reload, reset, setReady };
}

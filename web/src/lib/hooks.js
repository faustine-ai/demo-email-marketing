import { useSyncExternalStore } from 'react';
import { subscribe, getState } from './store.js';

// Read the whole store. Components stay small, so this is plenty fast.
export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

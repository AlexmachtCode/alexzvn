import type { JmConnectApi } from '@shared/types';

declare global {
  interface Window {
    jmconnect: JmConnectApi;
  }
}

export {};

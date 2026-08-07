import type { JmInterpreterApi } from '@shared/api';

declare global {
  interface Window {
    jminterpreter: JmInterpreterApi;
  }
}

export {};

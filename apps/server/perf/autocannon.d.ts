// Minimal typings for the parts of autocannon 8 the load test uses (the package ships no types).
declare module 'autocannon' {
  import type { EventEmitter } from 'node:events';

  interface RawRequest {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: string;
  }

  interface Options {
    url: string;
    connections: number;
    duration: number;
    timeout?: number;
    headers?: Record<string, string>;
    requests?: Array<{ method?: string; path?: string; setupRequest?: (request: RawRequest) => RawRequest }>;
  }

  interface Result {
    requests: { total: number; average: number };
    latency: { p50: number; p90: number; p97_5: number; p99: number; max: number };
    errors: number;
    timeouts: number;
    non2xx: number;
    duration: number;
  }

  interface Instance extends EventEmitter, PromiseLike<Result> {
    on(
      event: 'response',
      listener: (client: unknown, statusCode: number, resBytes: number, responseTime: number) => void,
    ): this;
  }

  function autocannon(options: Options): Instance;
  export default autocannon;
}

import * as Comlink from 'comlink';

export type OcctProxy = {
  stepToGLB(u8: Uint8Array, opts?: any): Promise<Uint8Array>;
  readStep(u8: Uint8Array, opts?: any): Promise<any>;
};

let proxy: OcctProxy | null = null;
let worker: Worker | null = null;

export function getOcctProxy(): OcctProxy {
  if (!proxy) {
    worker = new Worker(new URL('./occt.worker.ts', import.meta.url), { type: 'module' });
    proxy = Comlink.wrap<OcctProxy>(worker);
  }
  return proxy!;
}

export function terminateOcctWorker() {
  if (worker) worker.terminate();
  worker = null;
  proxy = null;
}

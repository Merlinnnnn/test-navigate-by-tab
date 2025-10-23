import * as Comlink from 'comlink';

let occt: any;

async function initOCCT() {
  if (occt) return;
  const mod = await import('occt-import-js');
  const factory = mod.default || mod;
  occt = await factory({
    locateFile: (p: string) => `/occt/${p}`,
  });
}

async function stepToGLB(u8: Uint8Array, opts?: any): Promise<Uint8Array> {
  await initOCCT();
  const res = await occt.stepToGLB(u8.buffer, opts || {});
  // res có thể là ArrayBuffer/Uint8Array => normalize về Uint8Array
  const u = res instanceof Uint8Array ? res : new Uint8Array(res);
  return u;
}

async function readStep(u8: Uint8Array, opts?: any): Promise<any> {
  await initOCCT();
  return await occt.ReadStepFile?.(u8, opts) 
      ?? await occt.readStepFile?.(u8, opts) 
      ?? await occt.importStep?.(u8, opts) 
      ?? await occt.readStep?.(u8, opts);
}

Comlink.expose({ stepToGLB, readStep });

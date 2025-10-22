declare module 'occt-import-js' {
  export class OCCTWorkerManager {
    init(): Promise<void>;
    stepToGlb(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer>;
    stepToObj(arrayBuffer: ArrayBuffer): Promise<string>;
    dispose(): void;
  }
}

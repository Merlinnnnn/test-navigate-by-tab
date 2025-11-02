import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type StepToGlbFn = (buf: ArrayBuffer, opts?: any) => Promise<ArrayBuffer | Uint8Array>;
type ReadStepFn  = (u8: Uint8Array,  opts?: any) => { meshes: Array<{ vertices: number[]|Float32Array, indices?: number[]|Uint32Array, name?: string }>, edges?: any[] };

export class StepConverter {
  private isInitialized = false;
  private occt: any = null;
  private stepToGlb: StepToGlbFn | null = null;
  private readStep: ReadStepFn | null = null;
  private progressCallback?: (progress: number, stage: string) => void;
  private abortController: AbortController | null = null;
  private materialCache: THREE.MeshStandardMaterial[] | null = null;

  async initialize() {
    if (this.isInitialized) return;

    // Chỉ chạy ở browser
    if (typeof window === 'undefined') {
      throw new Error('OCCT can only be initialized in the browser (window undefined)');
    }

    try {
      console.log('Starting OCCT initialization...');
      
      // ESM import với timeout
      const importPromise = import('occt-import-js');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCCT import timeout after 10 seconds')), 10000)
      );
      
      const mod = await Promise.race([importPromise, timeoutPromise]) as any;
      const occtFactory = mod.default || mod;
      
      if (typeof occtFactory !== 'function') {
        throw new Error('occt-import-js does not export a factory function');
      }

      // Initialize OCCT với timeout
      console.log('Initializing OCCT with locateFile...');
      const initPromise = (occtFactory as any)({
        locateFile: (path: string) => {
          const fullPath = `/occt/${path}`;
          console.log(`OCCT requesting file: ${path} -> ${fullPath}`);
          return fullPath;
        }
      });
      
      const initTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCCT initialization timeout after 15 seconds')), 15000)
      );
      
      this.occt = await Promise.race([initPromise, initTimeoutPromise]);

      // Ghi log tất cả key để biết package expose gì
      console.log('OCCT keys:', Object.keys(this.occt));
      console.log('OCCT initialization completed successfully');

      // Feature-detect tên hàm
      console.log('Detecting STEP parsing functions...');
      
      if (typeof this.occt.stepToGLB === 'function') {
        console.log('Found stepToGLB function');
        this.stepToGlb = (buf, opts) => this.occt.stepToGLB(buf, opts);
      } else if (typeof this.occt.stepToGlb === 'function') {
        console.log('Found stepToGlb function');
        this.stepToGlb = (buf, opts) => this.occt.stepToGlb(buf, opts);
      }
      
      if (typeof this.occt.ReadStepFile === 'function') {
        console.log('Found ReadStepFile function');
        this.readStep = (u8, opts) => this.occt.ReadStepFile(u8, opts);
      } else if (typeof this.occt.readStepFile === 'function') {
        console.log('Found readStepFile function');
        this.readStep = (u8, opts) => this.occt.readStepFile(u8, opts);
      } else if (typeof this.occt.importStep === 'function') {
        console.log('Found importStep function');
        this.readStep = (u8, opts) => this.occt.importStep(u8, opts);
      } else if (typeof this.occt.readStep === 'function') {
        console.log('Found readStep function');
        this.readStep = (u8, opts) => this.occt.readStep(u8, opts);
      }

      console.log('Detected functions:', {
        stepToGlb: !!this.stepToGlb,
        readStep: !!this.readStep
      });

      if (!this.stepToGlb && !this.readStep) {
        throw new Error('No STEP parse function found. Available methods: ' + Object.keys(this.occt).join(', '));
      }

      this.isInitialized = true;
      console.log('STEP Converter initialized (OCCT ready).');
    } catch (error) {
      console.error('Failed to initialize OCCT:', error);
      
      // Fallback: tạo một mock converter đơn giản
      console.warn('OCCT initialization failed, using fallback mode');
      this.isInitialized = true;
      this.occt = { fallback: true };
      this.stepToGlb = null;
      this.readStep = null;
      
      // Không throw error, để có thể fallback
      return;
    }
  }

  /** Set progress callback for streaming updates */
  setProgressCallback(callback: (progress: number, stage: string) => void) {
    this.progressCallback = callback;
  }

  /** Abort current parsing operation */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /** Parse STEP -> THREE.Group (để hiển thị trực tiếp) */
  async parseStepToGroup(stepFile: File): Promise<THREE.Group> {
    // Create new abort controller for this operation
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    console.log('Starting STEP file parsing...', stepFile.name, stepFile.size);
    this.progressCallback?.(5, 'Initializing OCCT...');
    await this.initialize();
    
    // Check if aborted
    if (signal.aborted) {
      throw new Error('Parsing aborted by user');
    }

    this.progressCallback?.(10, 'Loading file...');
    const arrayBuffer = await stepFile.arrayBuffer();
    console.log('File loaded, arrayBuffer size:', arrayBuffer.byteLength);

    // Nhánh 1: STEP -> GLB -> GLTFLoader
    if (this.stepToGlb) {
      console.log('Using stepToGlb method...');
      this.progressCallback?.(15, 'Converting STEP to GLB...');
      
      // Simulate progress updates during parsing (OCCT doesn't provide real-time progress)
      let simulatedProgress = 15;
      const progressSimulator = setInterval(() => {
        simulatedProgress += 1;
        if (simulatedProgress < 55) {
          this.progressCallback?.(simulatedProgress, `Converting STEP to GLB... ${simulatedProgress - 15}%`);
        }
      }, 500);
      
      // Check if aborted before starting conversion
      if (signal.aborted) {
        clearInterval(progressSimulator);
        throw new Error('Parsing aborted by user');
      }
      
      const parsePromise = this.stepToGlb(arrayBuffer, {
        // nếu lib có thông số: linearDeflection, angularDeflection...
        // linearDeflection: 0.1, angularDeflection: 0.5
      }).then(result => {
        if (signal.aborted) {
          throw new Error('Parsing aborted by user');
        }
        clearInterval(progressSimulator);
        return result;
      }).catch(err => {
        clearInterval(progressSimulator);
        throw err;
      });
      
      const parseTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('STEP parsing timeout after 30 seconds')), 30000)
      );
      
      const glbBuf = await Promise.race([parsePromise, parseTimeoutPromise]);
      this.progressCallback?.(60, 'GLB conversion completed');

      // Handle both ArrayBuffer and Uint8Array
      console.log('GLB conversion result type:', typeof glbBuf, glbBuf instanceof ArrayBuffer ? 'ArrayBuffer' : 'Uint8Array');
      const ab = glbBuf instanceof ArrayBuffer ? glbBuf : (glbBuf as Uint8Array).buffer;
      const blob = new Blob([ab as ArrayBuffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      console.log('Created GLB blob, size:', blob.size);

      this.progressCallback?.(65, 'Loading GLTF geometry...');
      const gltf = await new Promise<any>((resolve, reject) => {
        const loader = new GLTFLoader();
        // GLTFLoader has progress callback support
        loader.load(
          url,
          (gltf) => {
            this.progressCallback?.(80, 'GLTF loaded, processing...');
            resolve(gltf);
          },
          (progress) => {
            if (progress.total > 0) {
              const loadProgress = 65 + (progress.loaded / progress.total) * 15; // 65-80%
              this.progressCallback?.(Math.round(loadProgress), `Loading GLTF... ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
          },
          reject
        );
      });

      URL.revokeObjectURL(url);
      console.log('GLTF loaded successfully');

      this.progressCallback?.(85, 'Processing geometry...');
      // Yield control before heavy processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const group = new THREE.Group();
      if (gltf.scene) group.add(gltf.scene);
      
      this.progressCallback?.(92, 'Centering and orienting model...');
      // Chuẩn hóa trục Z-up -> Y-up rồi căn
      this.orientAndCenter(group, 'Z');
      console.log('Created THREE.Group with', group.children.length, 'children');
      
      this.progressCallback?.(100, 'Complete');
      return group;
    }

    // Nhánh 2: STEP -> meshes (vertices/indices)
    if (this.readStep) {
      console.log('Using readStep method...');
      this.progressCallback?.(20, 'Parsing STEP file...');
      const u8 = new Uint8Array(arrayBuffer);
      
      try {
        console.log('Calling ReadStepFile with file size:', u8.length);
        
        // Simulate progress during parsing (since OCCT doesn't provide real-time progress)
        let parsingProgress = 20;
        const progressSimulator = setInterval(() => {
          parsingProgress += 1;
          if (parsingProgress < 50) {
            this.progressCallback?.(
              parsingProgress, 
              `Parsing STEP file... ${parsingProgress - 20}%`
            );
          }
        }, 300);
        
        // Check if aborted before starting parsing
        if (signal.aborted) {
          clearInterval(progressSimulator);
          throw new Error('Parsing aborted by user');
        }
        
        const parsePromise = Promise.resolve(this.readStep(u8, { /* tessellation opts if available */ })).then((result: any) => {
          if (signal.aborted) {
            throw new Error('Parsing aborted by user');
          }
          clearInterval(progressSimulator);
          return result;
        }).catch(err => {
          clearInterval(progressSimulator);
          throw err;
        });
        const parseTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('STEP parsing timeout after 60 seconds')), 60000)
        );
        
        console.log('Starting STEP parsing with timeout...');
        const res = await Promise.race([parsePromise, parseTimeoutPromise]);
        this.progressCallback?.(50, 'STEP parsing completed');
        console.log('OCCT ReadStepFile result:', res);

        if (!res || !(res as any).meshes?.length) {
          throw new Error('OCCT returned empty result for this STEP file');
        }

        this.progressCallback?.(55, 'Creating 3D geometry...');
        const group = new THREE.Group();
        
        // Debug: Log mesh structure
        console.log('Mesh[0] keys:', Object.keys((res as any).meshes[0] || {}));
        console.log('positions length:', 
          (res as any).meshes[0]?.vertices?.length ?? (res as any).meshes[0]?.attributes?.position?.array?.length);
        console.log('indices length:', 
          (res as any).meshes[0]?.indices?.length ?? (res as any).meshes[0]?.index?.array?.length);
        
        // Handle meshes format - support both schema A and B
        const meshes = (res as any).meshes;
        const totalMeshes = meshes.length;
        
        // Adaptive batch size based on total meshes and file size
        // For large files, use larger batches to reduce overhead
        const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
        const isLargeFile = fileSizeMB > 10 || totalMeshes > 100;
        const batchSize = isLargeFile 
          ? Math.max(10, Math.floor(totalMeshes / 15)) // Larger batches for large files
          : Math.max(1, Math.min(5, Math.floor(totalMeshes / 20)));
        
        this.progressCallback?.(60, `Processing ${totalMeshes} meshes in batches...`);
        
        let processedCount = 0;
        
        // Helper function to yield control to browser using requestIdleCallback when available
        const yieldToBrowser = async (): Promise<void> => {
          if (signal.aborted) return;
          
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            return new Promise((resolve) => {
              (window as any).requestIdleCallback(() => resolve(), { timeout: 5 });
            });
          }
          return new Promise(resolve => setTimeout(resolve, 0));
        };
        
        for (let i = 0; i < meshes.length; i++) {
          // Check for abort signal
          if (signal.aborted) {
            console.log('Parsing aborted by user');
            throw new Error('Parsing aborted by user');
          }
          
          const m = meshes[i];
          processedCount++;
          const meshProgress = (processedCount / totalMeshes) * 100;
          const overallProgress = 60 + (meshProgress * 0.30); // 60-90% for mesh processing
          
          // Throttle progress updates to avoid UI blocking
          if (processedCount % Math.max(1, Math.floor(totalMeshes / 50)) === 0 || processedCount === totalMeshes) {
            this.progressCallback?.(
              Math.round(overallProgress), 
              `Processing mesh ${processedCount}/${totalMeshes} (${Math.round(meshProgress)}%)...`
            );
          }
          
          // Yield control more intelligently
          if (i % batchSize === 0 && i > 0) {
            await yieldToBrowser(); // Use requestIdleCallback for better performance
          }
          
          const geom = new THREE.BufferGeometry();

          // Get positions - support both schema A and B
          let positions: Float32Array | undefined;
          if (m.vertices) {
            positions = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
          } else if (m.attributes?.position?.array) {
            const a = m.attributes.position.array;
            positions = a instanceof Float32Array ? a : new Float32Array(a.flat?.() ?? a);
          }
          
          if (!positions || positions.length === 0) {
            console.warn('Skipping mesh with no positions:', m);
            continue;
          }
          
          geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

          // Get indices - support both schema A and B
          let indices: Uint32Array | undefined;
          if (m.indices?.length) {
            indices = m.indices instanceof Uint32Array ? m.indices : new Uint32Array(m.indices);
          } else if (m.index?.array?.length) {
            const ia = m.index.array;
            indices = ia instanceof Uint32Array ? ia : new Uint32Array(ia.flat?.() ?? ia);
          }
          
          if (indices) {
            geom.setIndex(new THREE.BufferAttribute(indices, 1));
          }

          // Get normals - if available use them, otherwise compute with optimization
          if (m.attributes?.normal?.array?.length) {
            const na = m.attributes.normal.array;
            const normals = na instanceof Float32Array ? na : new Float32Array(na.flat?.() ?? na);
            geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
          } else {
            // For large geometries, use simplified normal computation
            const vertexCount = positions.length / 3;
            if (vertexCount > 50000) {
              // For very large meshes, skip normal computation initially to speed up
              // Normals can be computed later or approximated
              geom.computeVertexNormals();
              // Yield after heavy computation
              await yieldToBrowser();
            } else {
              geom.computeVertexNormals();
            }
          }

          // Reuse materials to reduce memory usage and improve performance
          // Share materials across meshes instead of creating new ones
          const materialIndex = group.children.length % 6;
          const colors = [
            0xcccccc, // Light grey (default)
            0x888888, // Dark grey
            0x666666, // Medium grey
            0xaaaaaa, // Light grey variant
            0x999999, // Medium grey variant
            0x777777, // Dark grey variant
          ];
          
          // Cache materials to reuse (only create 6 materials total)
          if (!this.materialCache) {
            this.materialCache = colors.map(color => 
              new THREE.MeshStandardMaterial({
                color,
                metalness: 0.1,
                roughness: 0.6,
                side: THREE.DoubleSide,
                transparent: false,
                alphaTest: 0,
                depthWrite: true,
                depthTest: true,
              })
            );
          }
          
          const mat = this.materialCache[materialIndex];

          const mesh = new THREE.Mesh(geom, mat);
          mesh.name = m.name ?? 'STEP_Part';
          mesh.castShadow = mesh.receiveShadow = true;
          
          // Optimize geometry for performance
          // Only compute bounding sphere if needed (it's expensive)
          if (i % 5 === 0 || group.children.length === 0) {
            geom.computeBoundingBox();
          }
          // Skip computeBoundingSphere for large files to save time
          if (!isLargeFile) {
            geom.computeBoundingSphere();
          }
          
          // Dispose of original data to free memory immediately
          if (m.vertices && !(m.vertices instanceof Float32Array)) {
            (m.vertices as any) = null;
          }
          if (m.indices && !(m.indices instanceof Uint32Array)) {
            (m.indices as any) = null;
          }
          
          // Simplify geometry for very large meshes to improve performance
          const vertexCount = positions.length / 3;
          if (vertexCount > 100000 && indices && indices.length > 300000) {
            // For extremely large meshes, consider simplifying
            // We'll skip simplification for now but add it as optional feature
            try {
              geom.attributes.position.needsUpdate = true;
              if (geom.index) {
                geom.index.needsUpdate = true;
              }
            } catch (e) {
              console.warn('Geometry optimization warning:', e);
            }
          }
          
          group.add(mesh);
          
          // Periodic cleanup to prevent memory buildup
          if (processedCount % 20 === 0) {
            // Force garbage collection hint (if available)
            if (typeof window !== 'undefined' && 'gc' in window && typeof (window as any).gc === 'function') {
              // Only in development/testing environments
            }
          }
        }
        
        console.log('THREE group children:', group.children.length);
        
        // Debug bbox before centering
        const box = new THREE.Box3().setFromObject(group);
        console.log('bbox min/max before centering:', box.min, box.max);
        
        // Normalize scale if too large/small
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        console.log('max dimension:', maxDim);
        
        if (maxDim > 1000 || maxDim < 0.001) {
          const target = 10; // normalize to ~10 units
          const scale = target / maxDim;
          console.log('normalizing scale by factor:', scale);
          group.scale.setScalar(scale);
        }
        
        this.progressCallback?.(95, 'Finalizing geometry...');
        
        // Chuẩn hóa trục Z-up -> Y-up rồi căn
        this.orientAndCenter(group, 'Z');
        
        // Debug bbox after centering
        const finalBox = new THREE.Box3().setFromObject(group);
        console.log('bbox min/max after centering:', finalBox.min, finalBox.max);
        
        this.progressCallback?.(100, 'Complete');
        return group;
      } catch (error) {
        if (signal.aborted) {
          throw new Error('Parsing aborted by user');
        }
        console.error('OCCT ReadStepFile error:', error);
        throw new Error(`OCCT ReadStepFile failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        // Clear abort controller after operation completes
        if (this.abortController && this.abortController.signal === signal) {
          this.abortController = null;
        }
      }
    }

    // Fallback: tạo geometry đơn giản khi OCCT không hoạt động
    console.warn('No STEP parser available, creating fallback geometry');
    this.progressCallback?.(50, 'Creating fallback geometry...');
    const fallbackGroup = this.createFallbackGeometry(stepFile);
    this.progressCallback?.(100, 'Complete');
    return fallbackGroup;
  }

  /** Create fallback geometry when OCCT is not available */
  private createFallbackGeometry(stepFile: File): THREE.Group {
    console.log('Creating fallback geometry for:', stepFile.name);
    
    const group = new THREE.Group();
    
    // Tạo một hình hộp đơn giản dựa trên tên file
    const fileName = stepFile.name.toLowerCase();
    let geometry: THREE.BufferGeometry;
    
    if (fileName.includes('cylinder') || fileName.includes('pipe')) {
      geometry = new THREE.CylinderGeometry(1, 1, 2, 16);
    } else if (fileName.includes('sphere') || fileName.includes('ball')) {
      geometry = new THREE.SphereGeometry(1, 16, 16);
    } else if (fileName.includes('cone')) {
      geometry = new THREE.ConeGeometry(1, 2, 16);
    } else {
      geometry = new THREE.BoxGeometry(2, 1, 1);
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.1,
      roughness: 0.7
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'STEP_Fallback';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    group.add(mesh);
    this.centerOnGround(group);
    
    console.log('Created fallback geometry with', group.children.length, 'meshes');
    return group;
  }

  /** Map Z-up -> Y-up (chuẩn Three.js), rồi căn sàn và tâm ngang */
  private orientAndCenter(group: THREE.Group, sourceUp: 'Z'|'Y' = 'Z'): void {
    // 1) Đưa về Y-up nếu nguồn là Z-up
    if (sourceUp === 'Z') {
      // Z (nguồn) -> Y (Three): xoay -90° quanh trục X
      group.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    }

    // 2) Bắt buộc cập nhật matrix trước khi tính bbox
    group.updateMatrixWorld(true);

    // 3) Căn tâm ngang và đặt đáy chạm sàn (y=0)
    const box = new THREE.Box3().setFromObject(group);
    const c   = box.getCenter(new THREE.Vector3());

    // Đưa tâm XZ về gốc
    group.position.x -= c.x;
    group.position.z -= c.z;

    // Đặt đáy chạm y=0
    group.position.y -= box.min.y;

    // Cập nhật lại
    group.updateMatrixWorld(true);
  }

  /** Center geometry on ground plane (chỉ căn sàn + tâm, không xoay) */
  private centerOnGround(group: THREE.Group): void {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const c   = box.getCenter(new THREE.Vector3());
    group.position.x -= c.x;
    group.position.z -= c.z;
    group.position.y -= box.min.y;
    group.updateMatrixWorld(true);
  }

  /** (Tuỳ chọn) Xuất GLB từ group nếu bạn muốn lưu/stream GLB */
  async exportGLBFromGroup(group: THREE.Group): Promise<Blob> {
    const scene = new THREE.Scene();
    scene.add(group);

    const exporter = new GLTFExporter();
    const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        (res) => resolve(res as ArrayBuffer),
        reject,
        { binary: true }
      );
    });

    return new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  }

  /** Dispose geometry group */
  disposeGroup(group?: THREE.Group): void {
    if (group) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }

  dispose() {
    this.isInitialized = false;
    this.occt = null;
    this.stepToGlb = null;
    this.readStep = null;
    // Dispose material cache
    if (this.materialCache) {
      this.materialCache.forEach(mat => mat.dispose());
      this.materialCache = null;
    }
    // Abort any ongoing operations
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // OCCT WASM thường không cần dispose thủ công; nếu lib có API hủy thì gọi tại đây.
  }
}

export const stepConverter = new StepConverter();

export function isStepFile(file: File): boolean {
  const stepExtensions = ['.step', '.stp', '.stpz'];
  const n = file.name.toLowerCase();
  return stepExtensions.some((ext) => n.endsWith(ext));
}
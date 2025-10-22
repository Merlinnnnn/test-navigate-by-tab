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

  /** Parse STEP -> THREE.Group (để hiển thị trực tiếp) */
  async parseStepToGroup(stepFile: File): Promise<THREE.Group> {
    console.log('Starting STEP file parsing...', stepFile.name, stepFile.size);
    await this.initialize();

    const arrayBuffer = await stepFile.arrayBuffer();
    console.log('File loaded, arrayBuffer size:', arrayBuffer.byteLength);

    // Nhánh 1: STEP -> GLB -> GLTFLoader
    if (this.stepToGlb) {
      console.log('Using stepToGlb method...');
      
      const parsePromise = this.stepToGlb(arrayBuffer, {
        // nếu lib có thông số: linearDeflection, angularDeflection...
        // linearDeflection: 0.1, angularDeflection: 0.5
      });
      
      const parseTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('STEP parsing timeout after 30 seconds')), 30000)
      );
      
      const glbBuf = await Promise.race([parsePromise, parseTimeoutPromise]);

      // Handle both ArrayBuffer and Uint8Array
      console.log('GLB conversion result type:', typeof glbBuf, glbBuf instanceof ArrayBuffer ? 'ArrayBuffer' : 'Uint8Array');
      const ab = glbBuf instanceof ArrayBuffer ? glbBuf : (glbBuf as Uint8Array).buffer;
      const blob = new Blob([ab as ArrayBuffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      console.log('Created GLB blob, size:', blob.size);

      const gltf = await new Promise<any>((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(url, resolve, undefined, reject);
      });

      URL.revokeObjectURL(url);
      console.log('GLTF loaded successfully');

      const group = new THREE.Group();
      if (gltf.scene) group.add(gltf.scene);
      this.centerOnGround(group);
      console.log('Created THREE.Group with', group.children.length, 'children');
      return group;
    }

    // Nhánh 2: STEP -> meshes (vertices/indices)
    if (this.readStep) {
      console.log('Using readStep method...');
      const u8 = new Uint8Array(arrayBuffer);
      
      try {
        console.log('Calling ReadStepFile with file size:', u8.length);
        const parsePromise = this.readStep(u8, { /* tessellation opts if available */ });
        const parseTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('STEP parsing timeout after 60 seconds')), 60000)
        );
        
        console.log('Starting STEP parsing with timeout...');
        const res = await Promise.race([parsePromise, parseTimeoutPromise]);
        console.log('OCCT ReadStepFile result:', res);

        if (!res || !(res as any).meshes?.length) {
          throw new Error('OCCT returned empty result for this STEP file');
        }

        const group = new THREE.Group();
        
        // Debug: Log mesh structure
        console.log('Mesh[0] keys:', Object.keys((res as any).meshes[0] || {}));
        console.log('positions length:', 
          (res as any).meshes[0]?.vertices?.length ?? (res as any).meshes[0]?.attributes?.position?.array?.length);
        console.log('indices length:', 
          (res as any).meshes[0]?.indices?.length ?? (res as any).meshes[0]?.index?.array?.length);
        
        // Handle meshes format - support both schema A and B
        for (const m of (res as any).meshes) {
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

          // Get normals - if available use them, otherwise compute
          if (m.attributes?.normal?.array?.length) {
            const na = m.attributes.normal.array;
            const normals = na instanceof Float32Array ? na : new Float32Array(na.flat?.() ?? na);
            geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
          } else {
            geom.computeVertexNormals();
          }

          // Create varied materials to distinguish different parts
          const materialIndex = group.children.length % 6;
          const colors = [
            0xcccccc, // Light grey (default)
            0x888888, // Dark grey
            0x666666, // Medium grey
            0xaaaaaa, // Light grey variant
            0x999999, // Medium grey variant
            0x777777, // Dark grey variant
          ];
          
          const mat = new THREE.MeshStandardMaterial({
            color: colors[materialIndex],
            metalness: 0.1,
            roughness: 0.6,
            // Enable DoubleSide to handle backface issues
            side: THREE.DoubleSide,
          });

          const mesh = new THREE.Mesh(geom, mat);
          mesh.name = m.name ?? 'STEP_Part';
          mesh.castShadow = mesh.receiveShadow = true;
          group.add(mesh);
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
        
        this.centerOnGround(group);
        
        // Debug bbox after centering
        const finalBox = new THREE.Box3().setFromObject(group);
        console.log('bbox min/max after centering:', finalBox.min, finalBox.max);
        
        return group;
      } catch (error) {
        console.error('OCCT ReadStepFile error:', error);
        throw new Error(`OCCT ReadStepFile failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Fallback: tạo geometry đơn giản khi OCCT không hoạt động
    console.warn('No STEP parser available, creating fallback geometry');
    return this.createFallbackGeometry(stepFile);
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

  /** Center geometry on ground plane */
  private centerOnGround(group: THREE.Group): void {
    const box = new THREE.Box3().setFromObject(group);
    const c = box.getCenter(new THREE.Vector3());
    
    // Center horizontally
    group.position.x -= c.x;
    group.position.z -= c.z;
    
    // Place bottom on ground (y=0) - but don't flip orientation
    group.position.y -= box.min.y;
    
    // Optional: Rotate to fix orientation if needed
    // Uncomment these lines if model appears upside down or sideways:
    // group.rotation.x = Math.PI / 2; // Rotate 90 degrees around X axis
    // group.rotation.z = Math.PI;     // Rotate 180 degrees around Z axis
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
    // OCCT WASM thường không cần dispose thủ công; nếu lib có API hủy thì gọi tại đây.
  }
}

export const stepConverter = new StepConverter();

export function isStepFile(file: File): boolean {
  const stepExtensions = ['.step', '.stp', '.stpz'];
  const n = file.name.toLowerCase();
  return stepExtensions.some((ext) => n.endsWith(ext));
}
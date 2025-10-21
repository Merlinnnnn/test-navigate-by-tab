import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Mock STEP Converter Helper (creates valid GLB from mock geometry)
export class MockStepConverter {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Mock implementation - creates valid GLB from mock geometry
      console.log('Mock STEP Converter initialized');
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Mock STEP Converter:', error);
      throw new Error('Failed to initialize STEP converter. Please try again.');
    }
  }

  async convertStepToGLB(stepFile: File): Promise<Blob> {
    await this.initialize();

    try {
      console.log('Converting STEP file to GLB:', stepFile.name);
      
      // For now, create a simple mock GLB with a basic geometry
      // In production, this would use OpenCascade to convert STEP
      const mockGeometry = this.createMockGeometry();
      const glbBlob = await this.createMockGLB(mockGeometry);
      
      console.log('STEP conversion completed successfully (mock)');
      return glbBlob;
      
    } catch (error) {
      console.error('STEP conversion failed:', error);
      throw new Error(`Failed to convert STEP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async convertStepToOBJ(stepFile: File): Promise<string> {
    await this.initialize();

    try {
      console.log('Converting STEP file to OBJ:', stepFile.name);
      
      // For now, create a simple mock OBJ
      // In production, this would use OpenCascade to convert STEP
      const objData = this.createMockOBJ();
      
      console.log('STEP to OBJ conversion completed successfully (mock)');
      return objData;
      
    } catch (error) {
      console.error('STEP to OBJ conversion failed:', error);
      throw new Error(`Failed to convert STEP file to OBJ: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Mock helper methods for demonstration
  private createMockGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    return geometry;
  }

  private async createMockGLB(geometry: THREE.BufferGeometry): Promise<Blob> {
    // Create a valid GLB using GLTFExporter
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      metalness: 0.1,
      roughness: 0.6
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Export to GLB using GLTFExporter
    const exporter = new GLTFExporter();
    const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        // onCompleted
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            // If result is JSON glTF, convert to binary
            const json = JSON.stringify(result);
            resolve(new TextEncoder().encode(json).buffer);
          }
        },
        // onError
        (err) => reject(err),
        // options
        { binary: true } // Create binary GLB
      );
    });

    return new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  }

  private createMockOBJ(): string {
    return `# Mock OBJ file converted from STEP
v -1.0 -1.0 -1.0
v  1.0 -1.0 -1.0
v  1.0  1.0 -1.0
v -1.0  1.0 -1.0
v -1.0 -1.0  1.0
v  1.0 -1.0  1.0
v  1.0  1.0  1.0
v -1.0  1.0  1.0

f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 5 1 4 8`;
  }

  // Helper function to create Three.js geometry from OBJ string
  createGeometryFromOBJ(objString: string): THREE.Group {
    const group = new THREE.Group();
    const lines = objString.split('\n');
    
    const vertices: THREE.Vector3[] = [];
    const faces: number[][] = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      
      if (parts[0] === 'v') {
        // Vertex
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        vertices.push(new THREE.Vector3(x, y, z));
      } else if (parts[0] === 'f') {
        // Face
        const face = [];
        for (let i = 1; i < parts.length; i++) {
          const vertexIndex = parseInt(parts[i].split('/')[0]) - 1; // OBJ is 1-indexed
          face.push(vertexIndex);
        }
        faces.push(face);
      }
    }
    
    // Create geometry from vertices and faces
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];
    
    // Add vertices to positions array
    vertices.forEach(vertex => {
      positions.push(vertex.x, vertex.y, vertex.z);
    });
    
    // Add faces to indices array
    faces.forEach(face => {
      if (face.length === 3) {
        // Triangle
        indices.push(face[0], face[1], face[2]);
      } else if (face.length === 4) {
        // Quad - triangulate
        indices.push(face[0], face[1], face[2]);
        indices.push(face[0], face[2], face[3]);
      }
    });
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.1,
      roughness: 0.6
    });
    
    // Create mesh and position it correctly on the grid
    const mesh = new THREE.Mesh(geometry, material);
    
    // Center the geometry and position it on the grid (y = 0)
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    mesh.position.set(-center.x, -box.min.y, -center.z);
    
    group.add(mesh);
    
    return group;
  }

  // Cleanup resources
  dispose() {
    this.isInitialized = false;
  }
}

// Singleton instance
export const stepConverter = new MockStepConverter();

// Helper function to detect if file is STEP format
export function isStepFile(file: File): boolean {
  const stepExtensions = ['.step', '.stp', '.stpz'];
  const fileName = file.name.toLowerCase();
  return stepExtensions.some(ext => fileName.endsWith(ext));
}

// Helper function to get file extension
export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

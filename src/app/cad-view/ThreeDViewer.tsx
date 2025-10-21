import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Bounds, useGLTF, Center, Html, useProgress } from "@react-three/drei";
import { STLLoader } from "three-stdlib";
import { OBJLoader } from "three-stdlib";
import * as THREE from "three";
import { stepConverter, isStepFile } from "./stepConverter";

// ---------- UI helpers ----------
function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (f) onFile(f);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`w-full h-28 rounded-2xl border-2 border-dashed flex items-center justify-between px-4 transition ${
        dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300"
      }`}
    >
      <div className="text-sm text-gray-700">
        <div className="font-medium">Drag & drop a 3D file here</div>
        <div className="opacity-70">Supports .glb/.gltf, .stl, .obj, .step/.stp</div>
      </div>
      <label className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm cursor-pointer shadow">
        Choose file
        <input type="file" accept=".glb,.gltf,.stl,.obj,.step,.stp" className="hidden" onChange={onChange} />
      </label>
    </div>
  );
}

function Toolbar({ onReset, fileName }: { onReset: () => void; fileName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white shadow border border-gray-200">
      <div className="text-sm text-gray-600 truncate">
        {fileName ? <><span className="font-medium">Loaded:</span> {fileName}</> : "No file loaded"}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onReset} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm">Clear</button>
      </div>
    </div>
  );
}

function LoadingOverlay() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="px-4 py-2 rounded-xl bg-black/70 text-white text-sm shadow">
        Loading… {progress.toFixed(0)}%
      </div>
    </Html>
  );
}

// ---------- Loaders for each format ----------
function GLTFModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, true);
  // Optional: ensure mesh materials respond to lighting
  scene.traverse((obj: THREE.Object3D) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if ((mesh.material as THREE.Material).name === "") {
        // leave material as-is; glTF usually has PBR materials already
      }
    }
  });
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.6 }), []);
  // STL may have huge units; scale is handled by Bounds fit below
  return (
    <Center>
      <mesh geometry={geometry} material={material} />
    </Center>
  );
}

function OBJModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.6 }), []);
  // Apply material to all meshes in the OBJ
  useEffect(() => {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
    }
  });
  }, [obj, material]);
  return (
    <Center>
      <primitive object={obj} />
    </Center>
  );
}

function StepModel({ geometry }: { geometry: THREE.Group }) {
  return (
    <Center>
      <primitive object={geometry} />
    </Center>
  );
}

// ---------- Main 3D Scene ----------
function Scene({ fileUrl, fileType, stepGeometry }: { fileUrl: string; fileType: string; stepGeometry?: THREE.Group | null }) {
  const renderModel = () => {
    switch (fileType.toLowerCase()) {
      case 'glb':
      case 'gltf':
        return <GLTFModel url={fileUrl} />;
      case 'stl':
        return <STLModel url={fileUrl} />;
      case 'obj':
        return <OBJModel url={fileUrl} />;
      case 'step':
      case 'stp':
        return stepGeometry ? <StepModel geometry={stepGeometry} /> : null;
      default:
        return null;
    }
  };

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Environment preset="studio" />
      <Grid args={[10, 10]} position={[0, 0, 0]} />
      <Bounds fit clip observe margin={1.2}>
        {renderModel()}
      </Bounds>
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1}
        maxDistance={100}
      />
    </>
  );
}

// ---------- Main Component ----------
export default function ThreeDViewer() {
  const [fileUrl, setFileUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [stepGeometry, setStepGeometry] = useState<THREE.Group | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setIsConverting(false);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Check if it's a STEP file
    if (isStepFile(file)) {
      setIsConverting(true);
      try {
        console.log('Converting STEP file:', file.name);
        
        // Try GLB conversion first (more efficient)
        try {
          const glbBlob = await stepConverter.convertStepToGLB(file);
          const url = URL.createObjectURL(glbBlob);
          setFileUrl(url);
          setFileName(file.name);
          setFileType('glb');
          setStepGeometry(null);
          console.log('STEP converted to GLB successfully');
        } catch (glbError) {
          console.log('GLB conversion failed, trying OBJ:', glbError);
          
          // Fallback to OBJ conversion
          try {
            const objString = await stepConverter.convertStepToOBJ(file);
            const geometry = stepConverter.createGeometryFromOBJ(objString);
            setStepGeometry(geometry);
            setFileUrl(""); // No URL needed for STEP geometry
            setFileName(file.name);
            setFileType('step');
            console.log('STEP converted to OBJ successfully');
          } catch (objError) {
            console.log('OBJ conversion failed:', objError);
            throw objError;
          }
        }
      } catch (error) {
        console.error('STEP conversion failed:', error);
        setError(`Failed to convert STEP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsConverting(false);
        return;
      }
      setIsConverting(false);
    } else {
      // Handle other file types
      if (!['glb', 'gltf', 'stl', 'obj'].includes(ext)) {
        setError(`Unsupported file format: .${ext}. Please use .glb, .gltf, .stl, .obj, or .step files.`);
        return;
      }

      const url = URL.createObjectURL(file);
    setFileUrl(url);
      setFileName(file.name);
      setFileType(ext);
      setStepGeometry(null);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }
    setFileUrl("");
    setFileName("");
    setFileType("");
    setError("");
    setStepGeometry(null);
    setIsConverting(false);
  }, [fileUrl]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  return (
    <div className="w-full h-full flex flex-col gap-4">
        <DropZone onFile={handleFile} />
      
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {isConverting && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
          Converting STEP file... This may take a moment.
        </div>
      )}
      
      <Toolbar onReset={handleReset} fileName={fileName} />
      
      <div className="flex-1 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
        {(fileUrl || stepGeometry) ? (
          <Canvas
            camera={{ position: [5, 5, 5], fov: 50 }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={<LoadingOverlay />}>
              <Scene fileUrl={fileUrl} fileType={fileType} stepGeometry={stepGeometry || undefined} />
            </Suspense>
          </Canvas>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">No 3D file loaded</div>
              <div className="text-sm">Upload a .glb, .gltf, .stl, .obj, or .step file to start viewing</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
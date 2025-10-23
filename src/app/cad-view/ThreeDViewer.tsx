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
        <input
          type="file"
          accept=".glb,.gltf,.stl,.obj,.step,.stp"
          className="hidden"
          onChange={onChange}
        />
      </label>
    </div>
  );
}

function Toolbar({ onReset, fileName, onFixOrientation }: { 
  onReset: () => void; 
  fileName?: string;
  onFixOrientation?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white shadow border border-gray-200">
      <div className="text-sm text-gray-600 truncate">
        {fileName ? (
          <>
            <span className="font-medium">Loaded:</span> {fileName}
          </>
        ) : (
          "No file loaded"
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            // Reset camera to default position
            const canvas = document.querySelector('canvas');
            if (canvas) {
              const event = new CustomEvent('reset-camera');
              canvas.dispatchEvent(event);
            }
          }}
          className="px-3 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm"
        >
          Reset View
        </button>
        {onFixOrientation && (
          <button
            onClick={onFixOrientation}
            className="px-3 py-2 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 text-sm"
          >
            Fix Orientation
          </button>
        )}
        <button
          onClick={onReset}
          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm"
        >
          Clear
        </button>
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
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 0.1,
        roughness: 0.6,
      }),
    []
  );
  // STL may have huge units; scale is handled by Bounds fit below
  return (
    <Center>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </Center>
  );
}

function OBJModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 0.1,
        roughness: 0.6,
      }),
    []
  );
  // Apply material to all meshes in the OBJ
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).material = material;
      (child as THREE.Mesh).castShadow = true;
      (child as THREE.Mesh).receiveShadow = true;
    }
  });
  return (
    <Center>
      <primitive object={obj} />
    </Center>
  );
}

function StepModel({ geometry }: { geometry: THREE.Group }) {
  // ĐÃ center & orient từ StepConverter, nên render thẳng
  return <primitive object={geometry} />;
}

function Scene({
  fileUrl,
  fileType,
  stepGeometry,
}: {
  fileUrl: string;
  fileType: string;
  stepGeometry?: THREE.Group | null;
}) {
  // Calculate dynamic zoom limits based on model size
  const getZoomLimits = useCallback(() => {
    if (stepGeometry) {
      const box = new THREE.Box3().setFromObject(stepGeometry);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Set zoom limits based on model size
      const minDistance = Math.max(0.001, maxDim * 0.01); // 1% of model size
      const maxDistance = Math.max(10000, maxDim * 100); // 100x model size
      
      console.log('Model size:', maxDim, 'Zoom limits:', { minDistance, maxDistance });
      return { minDistance, maxDistance };
    }
    return { minDistance: 0.01, maxDistance: 10000 };
  }, [stepGeometry]);
  const renderModel = () => {
    switch (fileType.toLowerCase()) {
      case "glb":
      case "gltf":
        return <GLTFModel url={fileUrl} />;
      case "stl":
        return <STLModel url={fileUrl} />;
      case "obj":
        return <OBJModel url={fileUrl} />;
      case "step":
      case "stp":
        return stepGeometry ? <StepModel geometry={stepGeometry} /> : null;
      default:
        return null;
    }
  };

  const zoomLimits = getZoomLimits();

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Environment preset="studio" />
      <Grid args={[10, 10]} position={[0, 0, 0]} />
      <Bounds fit clip observe margin={1.2}>
        {renderModel()}
      </Bounds>
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={zoomLimits.minDistance}
        maxDistance={zoomLimits.maxDistance}
        // Add auto-rotation for better viewing
        autoRotate={false}
        autoRotateSpeed={0.5}
        // Enable damping for smoother controls
        enableDamping={true}
        dampingFactor={0.05}
        // Smooth zoom with better limits
        zoomSpeed={1.5}
        panSpeed={1.0}
        rotateSpeed={1.0}
        // Better zoom limits based on model size
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        // Allow more aggressive zoom
        zoomToCursor={true}
      />
    </>
  );
}

export default function ThreeDViewer() {
  const [fileUrl, setFileUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [stepGeometry, setStepGeometry] = useState<THREE.Group | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionStage, setConversionStage] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setIsConverting(false);
      setCurrentFile(file);
      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      // Check if it's a STEP file
      if (isStepFile(file)) {
        setIsConverting(true);
        setConversionProgress(0);
        setConversionStage("Starting...");
        
        // Set up progress callback
        stepConverter.setProgressCallback((progress: number, stage: string) => {
          setConversionProgress(progress);
          setConversionStage(stage);
        });
        
        try {
          console.log("Parsing STEP file:", file.name);

          // Parse STEP file directly to Three.js Group
          const group = await stepConverter.parseStepToGroup(file);
          setStepGeometry(group); // <-- dùng Group thật từ STEP
          setFileUrl(""); // không cần URL
          setFileName(file.name);
          setFileType("step"); // để Scene chọn StepModel
          console.log("STEP parsed successfully");
        } catch (error) {
          console.error("STEP parsing failed:", error);
          setError(
            `Failed to parse STEP file: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          setIsConverting(false);
          setConversionProgress(0);
          setConversionStage("");
          return;
        }
        setIsConverting(false);
        setConversionProgress(0);
        setConversionStage("");
      } else {
        // Handle other file types
        if (!["glb", "gltf", "stl", "obj"].includes(ext)) {
          setError(
            `Unsupported file format: .${ext}. Please use .glb, .gltf, .stl, .obj, or .step files.`
          );
          return;
        }

        const url = URL.createObjectURL(file);
    setFileUrl(url);
        setFileName(file.name);
        setFileType(ext);
        setStepGeometry(null);
      }
    },
    []
  );

  const handleFixOrientation = useCallback(() => {
    if (!stepGeometry) return;

    // Toggle giữa 0 và -90° quanh X
    const almostEqual = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) < eps;
    const isZUp = almostEqual(stepGeometry.rotation.x, 0);

    const rot = isZUp ? -Math.PI / 2 : 0;
    stepGeometry.rotation.set(rot, 0, 0);

    stepGeometry.updateMatrixWorld(true);
    // Sau xoay, đặt lại đáy chạm sàn
    const box = new THREE.Box3().setFromObject(stepGeometry);
    stepGeometry.position.y -= box.min.y;
    stepGeometry.updateMatrixWorld(true);
    
    console.log('Orientation toggled:', isZUp ? 'Y-up' : 'Z-up');
  }, [stepGeometry]);

  const handleReset = useCallback(() => {
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }
    // Dispose STEP geometry
    stepConverter.disposeGroup(stepGeometry || undefined);
    setFileUrl("");
    setFileName("");
    setFileType("");
    setError("");
    setStepGeometry(null);
    setIsConverting(false);
    setCurrentFile(null); // Reset current file
    setConversionProgress(0);
    setConversionStage("");
  }, [fileUrl, stepGeometry]);

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
          <div className="font-medium">Parsing STEP file...</div>
          <div className="text-xs opacity-75 mt-1">
            File: {fileName} | Size:{" "}
            {currentFile?.size ? `${(currentFile.size / 1024 / 1024).toFixed(1)} MB` : "Unknown"}
          </div>
          <div className="text-xs opacity-75 mt-1">
            Stage: {conversionStage}
          </div>
          <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
              style={{width: `${conversionProgress}%`}}
            ></div>
          </div>
          <div className="text-xs opacity-75 mt-1 text-right">
            {conversionProgress.toFixed(0)}%
          </div>
        </div>
      )}

      <Toolbar 
        onReset={handleReset} 
        fileName={fileName} 
        onFixOrientation={stepGeometry ? handleFixOrientation : undefined}
      />

      <div className="flex-1 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
        {fileUrl || stepGeometry ? (
          <Canvas
            gl={{ 
              antialias: true, 
              logarithmicDepthBuffer: true,
              powerPreference: "high-performance",
              alpha: false,
              preserveDrawingBuffer: false
            }}
            camera={{ 
              position: [5, 5, 5], 
              fov: 50, 
              near: 0.001, 
              far: 1e8 
            }}
            style={{ width: "100%", height: "100%" }}
            performance={{ min: 0.5 }}
            dpr={[1, 2]}
          >
            <Suspense fallback={<LoadingOverlay />}>
              <Scene
                fileUrl={fileUrl}
                fileType={fileType}
                stepGeometry={stepGeometry || undefined}
              />
            </Suspense>
          </Canvas>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">No 3D file loaded</div>
              <div className="text-sm">
                Upload a .glb, .gltf, .stl, .obj, or .step file to start viewing
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
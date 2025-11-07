import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useLoader, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Bounds, useGLTF, Center, Html, useProgress } from "@react-three/drei";
import { STLLoader } from "three-stdlib";
import { OBJLoader } from "three-stdlib";
import * as THREE from "three";
import { stepConverter, isStepFile } from "./stepConverter";

// ---------- DXF Parser Helper ----------
function buildGroupFromDxf(dxf: any): THREE.Group {
  const g = new THREE.Group();

  // Vật liệu đường kẻ (có thể đổi theo layer/colorIndex)
  const makeLineMat = (color?: number) =>
    new THREE.LineBasicMaterial({ color: color ?? 0x222222 });

  // Helper: thêm một Line từ mảng điểm [x,y,(z)]
  const addLineFromPoints = (pts: Array<[number, number, number?]>, closed = false, mat?: THREE.LineBasicMaterial) => {
    const geom = new THREE.BufferGeometry();
    const flat: number[] = [];
    // Nếu là closed polyline, thêm điểm đầu vào cuối
    const list = closed ? [...pts, pts[0]] : pts;
    for (const p of list) {
      flat.push(p[0], p[1], p[2] ?? 0);
    }
    geom.setAttribute("position", new THREE.Float32BufferAttribute(flat, 3));
    const line = new THREE.Line(geom, mat ?? makeLineMat());
    g.add(line);
  };

  const aci = (idx?: number) => {  // map ACI đơn giản
    const table: Record<number, number> = {
      1: 0xFF0000, 2: 0xFFFF00, 3: 0x00FF00, 4: 0x00FFFF, 5: 0x0000FF, 6: 0xFF00FF,
      7: 0x000000, 8: 0x808080, 9: 0xC0C0C0
    };
    return idx && table[idx] ? table[idx] : 0x222222;
  };

  const ents = dxf?.entities ?? [];
  console.log(`Processing ${ents.length} DXF entities`);
  
  // Thống kê các loại entities
  const entityStats: Record<string, number> = {};
  const processedStats: Record<string, number> = {};
  const errorStats: Record<string, number> = {};
  
  for (const e of ents) {
    if (!e || !e.type) {
      console.warn("Skipping entity without type:", e);
      continue;
    }
    
    // Đếm loại entity
    entityStats[e.type] = (entityStats[e.type] || 0) + 1;
    
    const color = e.color ? e.color : aci(e.colorNumber || e.colorIndex);

    try {
      const childrenBefore = g.children.length;
      switch (e.type) {
        case "LINE": {
          let startX: number | undefined, startY: number | undefined, startZ: number = 0;
          let endX: number | undefined, endY: number | undefined, endZ: number = 0;
          
          // Hỗ trợ cả định dạng vertices (Array) và start/end (object)
          if (e.vertices && Array.isArray(e.vertices) && e.vertices.length >= 2) {
            // Định dạng vertices: [vertex1, vertex2]
            const v1 = e.vertices[0];
            const v2 = e.vertices[1];
            startX = v1?.x;
            startY = v1?.y;
            startZ = v1?.z ?? 0;
            endX = v2?.x;
            endY = v2?.y;
            endZ = v2?.z ?? 0;
          } else {
            // Định dạng start/end
            startX = e.start?.x ?? e.startX;
            startY = e.start?.y ?? e.startY;
            startZ = e.start?.z ?? e.startZ ?? 0;
            endX = e.end?.x ?? e.endX;
            endY = e.end?.y ?? e.endY;
            endZ = e.end?.z ?? e.endZ ?? 0;
          }
          
          if (typeof startX !== 'number' || typeof startY !== 'number' ||
              typeof endX !== 'number' || typeof endY !== 'number') {
            console.warn("LINE entity missing coordinates:", {
              type: e.type,
              hasVertices: !!e.vertices,
              verticesLength: e.vertices?.length,
              hasStart: !!e.start,
              hasEnd: !!e.end,
              startX, startY, endX, endY,
              entity: e
            });
            break;
          }
          
          const mat = makeLineMat(color);
          addLineFromPoints([
            [startX, startY, startZ],
            [endX, endY, endZ]
          ], false, mat);
          
          if (g.children.length > childrenBefore) {
            processedStats[e.type] = (processedStats[e.type] || 0) + 1;
            console.log(`[DXF] Successfully processed LINE: (${startX}, ${startY}, ${startZ}) -> (${endX}, ${endY}, ${endZ})`);
          }
          break;
        }
        case "LWPOLYLINE":
        case "POLYLINE": {
          const vertices = e.vertices || e.points || [];
          if (!Array.isArray(vertices) || vertices.length < 2) break;
          
          const pts: Array<[number, number, number?]> = [];
          for (const v of vertices) {
            if (v && typeof v.x === 'number' && typeof v.y === 'number') {
              pts.push([v.x, v.y, v.z || 0]);
            }
          }
          
          if (pts.length >= 2) {
            const mat = makeLineMat(color);
            addLineFromPoints(pts, !!e.closed, mat);
          }
          break;
        }
        case "CIRCLE": {
          // Hỗ trợ cả e.center.x và e.centerX
          const centerX = e.center?.x ?? e.centerX ?? 0;
          const centerY = e.center?.y ?? e.centerY ?? 0;
          const radius = e.radius ?? e.r ?? 0;
          
          if (typeof centerX !== 'number' || typeof centerY !== 'number' ||
              typeof radius !== 'number' || radius <= 0) {
            console.warn("CIRCLE entity missing coordinates or radius:", e);
            break;
          }
          
          const curve = new THREE.EllipseCurve(
            centerX, centerY, radius, radius, 0, Math.PI * 2, false, 0
          );
          const points = curve.getPoints(128).map(p => [p.x, p.y, 0] as [number, number, number]);
          const mat = makeLineMat(color);
          addLineFromPoints(points, true, mat);
          break;
        }
        case "ARC": {
          // Hỗ trợ cả e.center.x và e.centerX
          const centerX = e.center?.x ?? e.centerX ?? 0;
          const centerY = e.center?.y ?? e.centerY ?? 0;
          const radius = e.radius ?? e.r ?? 0;
          const startAngle = e.startAngle ?? e.start ?? 0;
          const endAngle = e.endAngle ?? e.end ?? 0;
          
          if (typeof centerX !== 'number' || typeof centerY !== 'number' ||
              typeof radius !== 'number' || radius <= 0 ||
              typeof startAngle !== 'number' || typeof endAngle !== 'number') {
            console.warn("ARC entity missing coordinates, radius, or angles:", e);
            break;
          }
          
          const start = THREE.MathUtils.degToRad(startAngle);
          const end = THREE.MathUtils.degToRad(endAngle);
          const curve = new THREE.EllipseCurve(
            centerX, centerY, radius, radius, start, end, false, 0
          );
          const points = curve.getPoints(64).map(p => [p.x, p.y, 0] as [number, number, number]);
          const mat = makeLineMat(color);
          addLineFromPoints(points, false, mat);
          break;
        }
        case "ELLIPSE": {
          // Hỗ trợ cả e.center.x và e.centerX
          const centerX = e.center?.x ?? e.centerX ?? 0;
          const centerY = e.center?.y ?? e.centerY ?? 0;
          
          if (typeof centerX !== 'number' || typeof centerY !== 'number') {
            console.warn("ELLIPSE entity missing center coordinates:", e);
            break;
          }
          
          // DXF ellipse có major/minor axis; để đơn giản: vẽ gần đúng theo bbox
          const rx = e.majorAxis?.x ? Math.hypot(e.majorAxis.x, e.majorAxis.y) : (e.rx ?? 1);
          const ry = e.axisRatio ? rx * e.axisRatio : (e.ry ?? rx);
          if (rx <= 0 || ry <= 0) {
            console.warn("ELLIPSE entity has invalid radius:", e);
            break;
          }
          
          const start = e.startAngle ?? 0;
          const end = e.endAngle ?? (2 * Math.PI);
          const curve = new THREE.EllipseCurve(centerX, centerY, rx, ry, start, end, false, 0);
          const points = curve.getPoints(96).map(p => [p.x, p.y, 0] as [number, number, number]);
          const mat = makeLineMat(color);
          addLineFromPoints(points, false, mat);
          break;
        }
        case "SPLINE":
          // Đơn giản: bỏ qua hoặc tự nội suy (có thể thêm sau)
          break;
        default:
          // Các loại khác (TEXT, DIMENSION, HATCH...) có thể bổ sung dần
          console.log(`[DXF] Unsupported entity type: ${e.type}`, e);
          break;
      }
      
      // Kiểm tra xem có thêm children không
      if (g.children.length > childrenBefore) {
        processedStats[e.type] = (processedStats[e.type] || 0) + 1;
      }
    } catch (err) {
      // Bỏ qua entity lỗi và tiếp tục với entity tiếp theo
      errorStats[e.type] = (errorStats[e.type] || 0) + 1;
      console.warn(`Error processing DXF entity type ${e.type}:`, err, e);
      continue;
    }
  }

  // Log thống kê
  console.log('[DXF] Entity Statistics:', {
    total: ents.length,
    byType: entityStats,
    processed: processedStats,
    errors: errorStats,
    totalProcessed: Object.values(processedStats).reduce((a, b) => a + b, 0),
    totalErrors: Object.values(errorStats).reduce((a, b) => a + b, 0),
    childrenInGroup: g.children.length,
    details: {
      entityStats: JSON.stringify(entityStats),
      processedStats: JSON.stringify(processedStats),
      errorStats: JSON.stringify(errorStats)
    }
  });

  // Xoay DXF từ mặt phẳng XY (Z=0) lên mặt phẳng XZ (Y=0) để camera nhìn từ trên xuống
  // Xoay -90° quanh trục X: XY -> XZ (Y trong DXF -> Z trong Three.js, Z trong DXF -> -Y trong Three.js)
  g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  g.updateMatrixWorld(true);

  // Căn tâm + đặt đáy
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  const size = new THREE.Vector3();
  box.getSize(size);
  
  console.log('[DXF] Bounding box before centering:', {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
    center: { x: c.x, y: c.y, z: c.z },
    size: { x: size.x, y: size.y, z: size.z },
    maxDimension: Math.max(size.x, size.y, size.z)
  });
  
  // Căn tâm theo X và Z, đặt đáy ở Y=0
  g.position.x -= c.x;
  g.position.z -= c.z;
  g.position.y -= box.min.y; // Đặt đáy ở Y=0
  g.updateMatrixWorld(true);
  
  // Log bounding box sau khi căn
  const finalBox = new THREE.Box3().setFromObject(g);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);
  console.log('[DXF] Bounding box after centering:', {
    min: { x: finalBox.min.x, y: finalBox.min.y, z: finalBox.min.z },
    max: { x: finalBox.max.x, y: finalBox.max.y, z: finalBox.max.z },
    size: { x: finalSize.x, y: finalSize.y, z: finalSize.z },
    maxDimension: Math.max(finalSize.x, finalSize.y, finalSize.z),
    childrenCount: g.children.length,
    groupPosition: { x: g.position.x, y: g.position.y, z: g.position.z }
  });
  
  // Log một vài children đầu tiên để debug
  if (g.children.length > 0) {
    console.log('[DXF] Sample children (first 5):', 
      g.children.slice(0, 5).map((child, idx) => {
        if (child instanceof THREE.Line) {
          const pos = child.geometry.attributes.position;
          if (pos && pos.count >= 2) {
            const start = new THREE.Vector3().fromBufferAttribute(pos, 0);
            const end = new THREE.Vector3().fromBufferAttribute(pos, pos.count - 1);
            return {
              index: idx,
              type: 'Line',
              start: { x: start.x, y: start.y, z: start.z },
              end: { x: end.x, y: end.y, z: end.z },
              pointCount: pos.count
            };
          }
        }
        return { index: idx, type: child.type, name: child.name };
      })
    );
  }

  return g;
}

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
        <div className="opacity-70">Supports .glb/.gltf, .stl, .obj, .step/.stp, .dxf (DWG cần convert)</div>
      </div>
      <label className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm cursor-pointer shadow">
        Choose file
        <input
          type="file"
          accept=".glb,.gltf,.stl,.obj,.step,.stp,.dxf,.dwg"
          className="hidden"
          onChange={onChange}
        />
      </label>
    </div>
  );
}

function Toolbar({ onReset, fileName }: { 
  onReset: () => void; 
  fileName?: string;
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

function DxfModel({ geometry }: { geometry: THREE.Group }) {
  // ĐÃ center & orient từ buildGroupFromDxf, nên render thẳng
  return <primitive object={geometry} />;
}

// Component để setup orthographic camera cho DXF
function DxfCamera({ geometry }: { geometry?: THREE.Group | null }) {
  const { set, size, camera } = useThree();
  const cameraSetupRef = useRef(false);
  const viewSizeRef = useRef<number>(50);
  
  useEffect(() => {
    // Chỉ setup camera một lần khi geometry được load
    if (!geometry || cameraSetupRef.current) {
      return;
    }
    
    console.log('[DXF Camera] Setting up camera for geometry with', geometry.children.length, 'children');
    
    const aspect = size.width / size.height;
    
    // Tính toán viewSize dựa trên geometry
    const box = new THREE.Box3().setFromObject(geometry);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    // DXF là 2D, dùng max của X và Z (sau khi xoay, Y là chiều cao = 0)
    const maxDim = Math.max(sizeVec.x, sizeVec.z);
    // ViewSize nên lớn hơn maxDim một chút để có margin
    const viewSize = Math.max(50, maxDim * 1.2);
    viewSizeRef.current = viewSize;
    
    console.log('[DXF Camera] Calculated viewSize from geometry:', {
      maxDim,
      viewSize,
      boxSize: sizeVec,
      boxMin: { x: box.min.x, y: box.min.y, z: box.min.z },
      boxMax: { x: box.max.x, y: box.max.y, z: box.max.z }
    });
    
    const orthoCamera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 100000
    );
    // Camera nhìn từ trên xuống (Y cao, nhìn xuống mặt phẳng XZ)
    orthoCamera.position.set(0, 100, 0);
    orthoCamera.lookAt(0, 0, 0);
    orthoCamera.updateProjectionMatrix();
    set({ camera: orthoCamera });
    cameraSetupRef.current = true;
    
    console.log('[DXF Camera] Camera setup completed:', {
      viewSize,
      aspect,
      left: -viewSize * aspect,
      right: viewSize * aspect,
      top: viewSize,
      bottom: -viewSize,
      position: { x: 0, y: 100, z: 0 },
      lookAt: { x: 0, y: 0, z: 0 },
      cameraType: orthoCamera.type
    });
  }, [set, size, geometry]);
  
  // Giữ camera position cố định mỗi frame
  useFrame(() => {
    if (camera && camera.type === 'OrthographicCamera' && geometry) {
      const ortho = camera as THREE.OrthographicCamera;
      // Đảm bảo camera luôn ở Y=100, nhìn xuống (0,0,0)
      if (Math.abs(ortho.position.y - 100) > 0.1) {
        ortho.position.set(0, 100, 0);
        ortho.lookAt(0, 0, 0);
        ortho.updateProjectionMatrix();
      }
      
      // Đảm bảo orthographic camera có đúng viewSize khi window resize
      const aspect = size.width / size.height;
      const expectedLeft = -viewSizeRef.current * aspect;
      const expectedRight = viewSizeRef.current * aspect;
      const expectedTop = viewSizeRef.current;
      const expectedBottom = -viewSizeRef.current;
      
      if (Math.abs(ortho.left - expectedLeft) > 0.1 ||
          Math.abs(ortho.right - expectedRight) > 0.1 ||
          Math.abs(ortho.top - expectedTop) > 0.1 ||
          Math.abs(ortho.bottom - expectedBottom) > 0.1) {
        ortho.left = expectedLeft;
        ortho.right = expectedRight;
        ortho.top = expectedTop;
        ortho.bottom = expectedBottom;
        ortho.updateProjectionMatrix();
      }
    }
  });
  
  // Reset flag khi geometry thay đổi
  useEffect(() => {
    if (!geometry) {
      cameraSetupRef.current = false;
    }
  }, [geometry]);
  
  return null;
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
      case "dxf":
        return stepGeometry ? <DxfModel geometry={stepGeometry} /> : null;
      default:
        return null;
    }
  };

  const zoomLimits = getZoomLimits();

  const isDxf = fileType.toLowerCase() === "dxf";

  return (
    <>
      {!isDxf && (
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
        </>
      )}
      {!isDxf && <Grid args={[10, 10]} position={[0, 0, 0]} />}
      {isDxf ? (
        // DXF không dùng Bounds vì đã có orthographic camera riêng
        renderModel()
      ) : (
        <Bounds fit clip observe margin={1.2}>
          {renderModel()}
        </Bounds>
      )}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={!isDxf}
        // Với DXF (orthographic), không dùng minDistance/maxDistance vì nó dành cho perspective camera
        minDistance={isDxf ? undefined : zoomLimits.minDistance}
        maxDistance={isDxf ? undefined : zoomLimits.maxDistance}
        // Add auto-rotation for better viewing
        autoRotate={false}
        autoRotateSpeed={0.5}
        // Enable damping for smoother controls
        enableDamping={true}
        dampingFactor={0.05}
        // Smooth zoom with better limits
        zoomSpeed={isDxf ? 0.5 : 1.5} // Zoom chậm hơn cho DXF để tránh zoom quá nhanh
        panSpeed={1.0}
        rotateSpeed={1.0}
        // Better zoom limits based on model size
        minPolarAngle={isDxf ? Math.PI / 2 : 0}
        maxPolarAngle={isDxf ? Math.PI / 2 : Math.PI}
        // Allow more aggressive zoom
        zoomToCursor={true}
        // Với DXF, giữ camera ở vị trí cố định (Y cao)
        target={isDxf ? [0, 0, 0] : undefined}
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
  
  // Safety limit to avoid browser crashes on extremely large files
  const MAX_FILE_SIZE_MB = 200; // adjust if your environment can handle more

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      
      // Abort any ongoing conversion
      stepConverter.abort();
      
      // Clear previous geometry to free memory
      if (stepGeometry) {
        stepConverter.disposeGroup(stepGeometry);
        setStepGeometry(null);
      }
      
      setIsConverting(false);
      setCurrentFile(file);
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      // Set fileType tạm thời để hiển thị đúng trong UI
      if (ext === "dwg") {
        setFileType("dwg");
      }

      // Guard: prevent processing extremely large files that may crash the tab
      const fileSizeMB = file.size / 1024 / 1024;
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        setError(`File quá lớn (${fileSizeMB.toFixed(1)} MB). Giới hạn hiện tại là ${MAX_FILE_SIZE_MB} MB cho an toàn.`);
        return;
      }

      // 1) DXF - parse text với dxf-parser (chỉ load khi cần)
      if (ext === "dxf") {
        try {
          setIsConverting(true);
          setConversionStage("Reading DXF file...");
          const text = await file.text();
          setConversionStage("Parsing DXF...");
          const { default: DxfParser } = await import("dxf-parser");
          const parser = new DxfParser();
          const dxf = parser.parseSync(text);

          // Kiểm tra cấu trúc DXF
          if (!dxf) {
            throw new Error("DXF parser returned null or undefined");
          }
          
          console.log("DXF parsed structure:", {
            hasEntities: !!dxf.entities,
            entityCount: dxf.entities?.length || 0,
            hasHeader: !!dxf.header,
            keys: Object.keys(dxf)
          });

          setConversionStage("Building 3D geometry...");
          const group = buildGroupFromDxf(dxf);
          
          if (group.children.length === 0) {
            console.warn("DXF file parsed but no geometry was created. Entities:", dxf.entities?.length || 0);
          }
          
          setStepGeometry(group);
          setFileUrl("");
          setFileName(file.name);
          setFileType("dxf");
          setIsConverting(false);
          setConversionProgress(0);
          setConversionStage("");
          return;
        } catch (e: any) {
          console.error("DXF parsing error:", e);
          setError(`Không đọc được DXF: ${e?.message || String(e)}`);
          setIsConverting(false);
          setConversionProgress(0);
          setConversionStage("");
          return;
        }
      }

      // 2) DWG - convert sang DXF qua API
      if (ext === "dwg") {
        try {
          setIsConverting(true);
          setConversionStage("Converting DWG to DXF...");
          
          // Upload file lên API để convert
          const formData = new FormData();
          formData.append("file", file);
          
          const response = await fetch("/api/convert-dwg-to-dxf", {
            method: "POST",
            body: formData,
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(errorData.error || errorData.details || `Conversion failed: ${response.statusText}`);
          }
          
          setConversionStage("Parsing converted DXF...");
          
          // Nhận DXF file từ API
          const dxfBlob = await response.blob();
          const dxfText = await dxfBlob.text();
          
          // Parse DXF như bình thường
          const { default: DxfParser } = await import("dxf-parser");
          const parser = new DxfParser();
          const dxf = parser.parseSync(dxfText);
          
          if (!dxf) {
            throw new Error("DXF parser returned null or undefined after conversion");
          }
          
          console.log("DWG converted to DXF structure:", {
            hasEntities: !!dxf.entities,
            entityCount: dxf.entities?.length || 0,
            hasHeader: !!dxf.header,
            keys: Object.keys(dxf)
          });
          
          setConversionStage("Building 3D geometry...");
          const group = buildGroupFromDxf(dxf);
          
          if (group.children.length === 0) {
            console.warn("DWG file converted but no geometry was created. Entities:", dxf.entities?.length || 0);
          }
          
          setStepGeometry(group);
          setFileUrl("");
          setFileName(file.name);
          setFileType("dxf"); // Treat as DXF after conversion
          setIsConverting(false);
          setConversionProgress(0);
          setConversionStage("");
          return;
        } catch (e: any) {
          console.error("DWG conversion error:", e);
          const errorMessage = e?.message || String(e);
          
          // Hiển thị thông báo lỗi rõ ràng hơn
          if (errorMessage.includes("converter tool not found")) {
            setError("DWG converter tool chưa được cài đặt trên server. Vui lòng liên hệ quản trị viên để cài đặt LibreDWG hoặc ODA File Converter.");
          } else {
            setError(`Không thể chuyển đổi DWG sang DXF: ${errorMessage}`);
          }
          
          setIsConverting(false);
          setConversionProgress(0);
          setConversionStage("");
          return;
        }
      }

      // 3) STEP file
      if (isStepFile(file)) {
        setIsConverting(true);
        setConversionProgress(0);
        setConversionStage("Starting...");
        
        // Debounce progress updates to avoid UI blocking
        let lastProgressUpdate = 0;
        const progressThrottle = 50; // Update at most every 50ms
        
        // Set up progress callback with throttling
        stepConverter.setProgressCallback((progress: number, stage: string) => {
          const now = Date.now();
          if (now - lastProgressUpdate >= progressThrottle || progress === 100) {
            setConversionProgress(progress);
            setConversionStage(stage);
            lastProgressUpdate = now;
          }
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
          
          // Don't show error if it was aborted
          if (error instanceof Error && error.message.includes('aborted')) {
            console.log("STEP parsing was cancelled");
          } else {
            setError(
              `Failed to parse STEP file: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
          
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
            `Unsupported file format: .${ext}. Please use .glb, .gltf, .stl, .obj, .step/.stp, or .dxf files.`
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

  const handleReset = useCallback(() => {
    // Abort any ongoing conversion
    stepConverter.abort();
    
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
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
          <div className="font-medium text-base mb-2">
            {fileType.toLowerCase() === "dwg" || fileName.toLowerCase().endsWith(".dwg")
              ? "Đang chuyển đổi file DWG..." 
              : "Đang xử lý file STEP..."}
          </div>
          <div className="text-xs opacity-75 mb-1">
            <span className="font-medium">File:</span> {fileName}
          </div>
          <div className="text-xs opacity-75 mb-1">
            <span className="font-medium">Kích thước:</span>{" "}
            {currentFile?.size ? `${(currentFile.size / 1024 / 1024).toFixed(2)} MB` : "Unknown"}
          </div>
          <div className="text-sm font-medium mt-3 mb-2">
            {conversionStage || "Đang khởi tạo..."}
          </div>
          <div className="mt-2 w-full bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-2" 
              style={{width: `${Math.min(100, Math.max(0, conversionProgress))}%`}}
            >
              {conversionProgress > 15 && (
                <span className="text-white text-xs font-medium">
                  {conversionProgress.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs opacity-75">
              Đang tải từng đoạn...
            </div>
            <div className="text-sm font-semibold text-blue-800">
              {conversionProgress.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      <Toolbar 
        onReset={handleReset} 
        fileName={fileName}
      />

      <div className="flex-1 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
        {fileUrl || stepGeometry ? (
          <Canvas
            gl={{ 
              antialias: true, 
              // Disable logarithmic depth buffer to avoid GPU/driver issues on some devices
              logarithmicDepthBuffer: false,
              powerPreference: "high-performance",
              alpha: false,
              preserveDrawingBuffer: false
            }}
            camera={fileType.toLowerCase() === "dxf" 
              ? { position: [0, 50, 0], near: 0.1, far: 100000, fov: 50 }
              : { position: [5, 5, 5], near: 0.1, far: 100000, fov: 50 }
            }
            style={{ width: "100%", height: "100%" }}
            performance={{ min: 0.5 }}
            dpr={[1, 2]}
          >
            <Suspense fallback={<LoadingOverlay />}>
              {fileType.toLowerCase() === "dxf" ? <DxfCamera geometry={stepGeometry} /> : null}
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
                Upload a .glb, .gltf, .stl, .obj, .step/.stp, or .dxf file to start viewing
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
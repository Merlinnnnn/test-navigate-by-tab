# STEP File Test Guide

## 🎯 Cách test STEP parsing

### 1. **Upload file STEP bất kỳ**
- Truy cập: `http://localhost:3000/cad-view`
- Kéo thả hoặc chọn file `.step` hoặc `.stp`

### 2. **Xem kết quả real parsing**
Hệ thống sẽ đọc và parse nội dung file STEP thật:

#### **STEP Entity Analysis**:
- **Cylindrical entities** → Hình trụ
- **Spherical entities** → Hình cầu  
- **Box/Rectangular entities** → Hình hộp
- **Complex assemblies** → Multiple shapes

#### **Real STEP Parsing**:
- Sử dụng OCCT WASM với `ReadStepFile` method
- Parse STEP → tessellated meshes (vertices/indices)
- Create Three.js BufferGeometry từ OCCT result
- Hiển thị tessellated geometry thật từ BREP

### 3. **Thông tin hiển thị**
- **File name**: Tên file STEP
- **File size**: Kích thước file (KB)
- **OCCT Processing**: OpenCascade WASM processing
- **GLB Generation**: Convert to GLB binary format
- **Real Geometry**: Tessellated meshes from BREP
- **Positioning**: Vật thể nằm đúng trên grid

### 4. **Controls 3D**
- **Mouse drag**: Xoay camera
- **Mouse scroll**: Zoom in/out
- **Right click drag**: Pan camera
- **Auto-fit**: Tự động fit vật thể vào khung nhìn

## 🔧 Technical Details

### **Real STEP Implementation**:
- **OCCT WASM**: Sử dụng OpenCascade WASM để parse STEP thật
- **Runtime Files**: Copy .wasm/.worker.js vào /public/occt/
- **Direct Parsing**: STEP → GLB → Three.js Group
- **Real Geometry**: Tessellated meshes từ BREP thật
- **No Fallback**: Throw error nếu OCCT không khả dụng
- **GLTFLoader**: Load GLB result vào Three.js scene
- **Proper Positioning**: Vật thể nằm đúng trên grid plane

### **File Support**:
- ✅ `.step` files
- ✅ `.stp` files  
- ✅ `.stpz` files (compressed STEP)

## 🚀 Next Steps

### **For Production**:
1. **Real STEP Parser**: Integrate OpenCascade WASM
2. **Server Conversion**: Backend pipeline với FreeCAD/OCCT
3. **Advanced Features**: Materials, textures, animations

### **Current Status**:
✅ **Working**: Mock conversion với smart geometry
✅ **UI/UX**: Loading states và file info
✅ **3D Controls**: Full orbit, zoom, pan
✅ **Grid Positioning**: Objects sit correctly on grid

## 📝 Test Files

Bạn có thể test với bất kỳ file STEP nào, hoặc tạo file test với tên:
- `cylinder_test.step` → Hình trụ
- `sphere_part.stp` → Hình cầu  
- `cone_feeder.step` → Hình nón
- `torus_ring.stp` → Hình xuyến
- `bracket.step` → Hộp phức tạp

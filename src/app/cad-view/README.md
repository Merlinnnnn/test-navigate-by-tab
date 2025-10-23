# 3D CAD Viewer - Optimized

## Cải tiến đã thực hiện

### 1. Tối ưu hóa Zoom Controls
- **Dynamic Zoom Limits**: Tự động điều chỉnh min/max distance dựa trên kích thước model
- **minDistance**: 0.01 (có thể zoom rất gần) - 1% kích thước model
- **maxDistance**: 10,000+ (có thể zoom rất xa) - 100x kích thước model  
- **zoomSpeed**: 1.5 - zoom mượt mà và nhanh hơn
- **enableDamping**: true với dampingFactor 0.05 - giảm độ giật
- **zoomToCursor**: true - zoom vào vị trí con trỏ chuột
- **Camera Settings**: near: 0.001, far: 1e8 - hỗ trợ zoom cực gần/xa

### 2. Progressive Loading cho STEP Files
- **Progress Callback**: Hiển thị tiến trình chi tiết
- **Batch Processing**: Xử lý mesh theo batch để tránh block UI
- **Memory Optimization**: Giải phóng memory sau khi xử lý
- **Stage Tracking**: Hiển thị giai đoạn hiện tại (Initializing, Parsing, Processing...)

### 3. Performance Optimizations
- **Canvas Settings**: 
  - `powerPreference: "high-performance"`
  - `alpha: false` để tối ưu rendering
  - `preserveDrawingBuffer: false`
  - `dpr: [1, 2]` cho responsive rendering
- **Material Optimization**:
  - `transparent: false`
  - `depthWrite: true`
  - `depthTest: true`
- **Geometry Optimization**:
  - `computeBoundingBox()`
  - `computeBoundingSphere()`
- **Shadow Mapping**: Cải thiện shadow quality

### 4. Memory Management
- **Batch Processing**: Xử lý mesh theo batch
- **Memory Cleanup**: Giải phóng data gốc sau khi convert
- **Geometry Disposal**: Proper cleanup khi reset

### 5. Coordinate System Fix
- **Z-up to Y-up**: Chuyển đổi hệ trục từ Z-up (OCCT/STEP) sang Y-up (Three.js)
- **Explicit Mapping**: Sử dụng `applyMatrix4(makeRotationX(-π/2))` thay vì heuristic
- **No Double Center**: Tránh double center giữa StepConverter và Center component
- **Toggle Orientation**: Nút "Fix Orientation" để toggle giữa Y-up ↔ Z-up

## Cách sử dụng

1. **Upload file**: Kéo thả hoặc chọn file .step/.stp
2. **Progress tracking**: Xem tiến trình conversion chi tiết
3. **Smooth navigation**: Zoom, pan, rotate mượt mà
4. **Performance**: Tối ưu cho file lớn

## Supported Formats
- **STEP/STP**: Với progressive loading
- **GLB/GLTF**: Standard loading
- **STL/OBJ**: Standard loading

## Technical Details
- **OCCT Integration**: Sử dụng occt-import-js
- **Three.js**: React Three Fiber với optimizations
- **Memory Management**: Batch processing + cleanup
- **UI/UX**: Progress bars, smooth controls, responsive design

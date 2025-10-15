// ĐIỀU HƯỚNG: Các hàm hỗ trợ di chuyển focus bằng bàn phím giữa các ô
// Độc lập UI; có thể tái sử dụng ở nhiều component/trang.
export type NextCell = { rowKey: string | number; colKey: string };
export const CELL_ID = (rowKey: string | number, colKey: string) => `cell-${rowKey}-${colKey}`;

// BÀN PHÍM → FOCUS: Chuyển focus sang ô kế tiếp đã tính (nếu có)
export function focusCell(next: NextCell | null) {
  if (!next) return;
  const el = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, next.colKey)}"]`);
  if (el) el.focus();
}

// ĐIỀU HƯỚNG: Tính ô có thể chỉnh sửa kế tiếp dựa trên hàng/cột hiện tại
// - Khi hết cột, nhảy sang hàng tiếp theo
export function computeNextCell(
  orderedRowKeys: Array<string | number>,
  editableColKeysInOrder: string[],
  currRowKey: string | number,
  currColKey: string
): NextCell | null {
  const rowIdx = orderedRowKeys.indexOf(currRowKey);
  const colIdx = editableColKeysInOrder.indexOf(currColKey);
  if (rowIdx === -1 || colIdx === -1) return null;

  let nextRowIdx = rowIdx;
  let nextColIdx = colIdx + 1;

  if (nextColIdx >= editableColKeysInOrder.length) {
    nextColIdx = 0;
    nextRowIdx = rowIdx + 1;
  }
  if (nextRowIdx >= orderedRowKeys.length) return null;

  return {
    rowKey: orderedRowKeys[nextRowIdx],
    colKey: editableColKeysInOrder[nextColIdx],
  };
}

// ĐIỀU HƯỚNG: Tính ô ở hàng bên dưới nhưng cùng cột (nếu có)
export function computeBelowCell(
  orderedRowKeys: Array<string | number>,
  currRowKey: string | number,
  colKey: string
): NextCell | null {
  const rowIdx = orderedRowKeys.indexOf(currRowKey);
  if (rowIdx === -1) return null;
  const nextRowIdx = rowIdx + 1;
  if (nextRowIdx >= orderedRowKeys.length) return null;
  return { rowKey: orderedRowKeys[nextRowIdx], colKey };
}

// ĐIỀU HƯỚNG: Tính ô editable trước đó (đi ngược lại so với computeNextCell)
// - Nếu đang ở cột đầu, lùi về cột cuối của hàng trước
export function computePrevCell(
  orderedRowKeys: Array<string | number>,
  editableColKeysInOrder: string[],
  currRowKey: string | number,
  currColKey: string
): NextCell | null {
  const rowIdx = orderedRowKeys.indexOf(currRowKey);
  const colIdx = editableColKeysInOrder.indexOf(currColKey);
  if (rowIdx === -1 || colIdx === -1) return null;

  let prevRowIdx = rowIdx;
  let prevColIdx = colIdx - 1;

  if (prevColIdx < 0) {
    prevRowIdx = rowIdx - 1;
    if (prevRowIdx < 0) return null;
    prevColIdx = editableColKeysInOrder.length - 1;
  }

  return {
    rowKey: orderedRowKeys[prevRowIdx],
    colKey: editableColKeysInOrder[prevColIdx],
  };
}



"use client";
import React from "react";
import { CELL_ID, computeNextCell, computeBelowCell, computePrevCell, focusCell } from "./navigation";
import { NavigationContext } from "./EditableCells";

// DỮ LIỆU: Một ô mô tả gồm nhiều cặp (name : value) xếp chồng
export type DescriptionItem = { name: string; value: string };

// PROPS: Định danh ô + truyền danh sách items và callback ghi dữ liệu
type Props = {
  rowKey: string | number;
  rowIndex: number;
  colKey: string; // e.g., "itemDescription"
  items: DescriptionItem[];
  onCommitItem: (itemIndex: number, value: string) => void;
};

// ĐIỀU HƯỚNG: id duy nhất cho từng input value bên trong ô mô tả
const inputIdFor = (rowKey: string | number, colKey: string, idx: number) =>
  `${CELL_ID(rowKey, `${colKey}-${idx}`)}`;

const DescriptionCell: React.FC<Props> = ({ rowKey, rowIndex, colKey, items, onCommitItem }) => {
  const nav = React.useContext(NavigationContext);
  // TRẠNG THÁI: giữ local value cho từng item mô tả
  const [locals, setLocals] = React.useState<string[]>(() => items.map(i => i.value ?? ""));

  React.useEffect(() => {
    setLocals(items.map(i => i.value ?? ""));
  }, [items]);

  // TRẠNG THÁI → STORE: ghi một item
  const commit = (idx: number) => {
    const current = locals[idx] ?? "";
    if (current !== (items[idx]?.value ?? "")) onCommitItem(idx, current);
  };

  // TRẠNG THÁI ← PROPS: hoàn tác một item về giá trị props
  const revert = (idx: number) => {
    setLocals(prev => prev.map((v, i) => (i === idx ? (items[i]?.value ?? "") : v)));
  };

  const focusInner = (idx: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-cell-id="${inputIdFor(rowKey, colKey, idx)}"]`);
    if (el) el.focus();
  };

  // BÀN PHÍM: Ctrl+Enter=nhảy xuống hàng dưới cùng cột; Ctrl+Tab=lùi về cột trước; Enter=ghi+xuống dòng; Tab=hoàn tác+xuống; ArrowUp/Down di chuyển nội bộ
  const handleKeyDown = (idx: number): React.KeyboardEventHandler<HTMLInputElement> => (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      commit(idx);
      // Khi xuống hàng tiếp theo, ưu tiên focus vào item đầu tiên của ô mô tả ở hàng đó
      const below = computeBelowCell(nav.orderedRowKeys, rowKey, colKey);
      if (below) {
        requestAnimationFrame(() => {
          // focus toàn cell trước, sau đó chuyển vào input giá trị đầu tiên
          focusCell(below);
          const firstInput = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(below.rowKey, `${below.colKey}-0`)}"]`);
          if (firstInput) firstInput.focus();
        });
      }
      return;
    }
    if ((e.key === "Tab" && e.ctrlKey) || (e.key === "ArrowLeft" && e.ctrlKey)) {
      console.log("Ctrl+Tab");
      e.preventDefault();
      // Ctrl+Tab: hoàn tác item hiện tại rồi lùi về cột trước
      revert(idx);
      const prev = computePrevCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      if (prev) {
        requestAnimationFrame(() => {
          focusCell(prev);
          // nếu cột trước là mô tả, ưu tiên focus item đầu tiên; nếu là image, ưu tiên search (index 0)
          const firstDesc = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(prev.rowKey, `${prev.colKey}-0`)}"]`);
          if (firstDesc) {
            firstDesc.focus();
          } else {
            const imageSearch = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(prev.rowKey, `${prev.colKey}-0`)}"]`);
            if (imageSearch) imageSearch.focus();
          }
        });
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commit(idx);
      if (idx < items.length - 1) {
        requestAnimationFrame(() => focusInner(idx + 1));
      } else {
        const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
        requestAnimationFrame(() => {
          focusCell(next);
          if (next) {
            const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
            if (first) first.focus();
          }
        });
      }
    } else if (e.key === "Tab") {
      console.log("Tab");
      e.preventDefault();
      revert(idx);
      if (idx < items.length - 1) {
        requestAnimationFrame(() => focusInner(idx + 1));
      } else {
        const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
        requestAnimationFrame(() => {
          focusCell(next);
          if (next) {
            const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
            if (first) first.focus();
          }
        });
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < items.length - 1) focusInner(idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) focusInner(idx - 1);
    }
  };

  const handleBlur = (idx: number) => () => commit(idx);

  // UI: Giao diện name : input(value) xếp theo cột
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, idx) => (
        <div key={idx} style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ color: "#6b7280", fontSize: 12 }}>{it.name}</div>
          <input
            data-cell-id={inputIdFor(rowKey, colKey, idx)}
            value={locals[idx] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setLocals(prev => prev.map((v, i) => (i === idx ? val : v)));
            }}
            onKeyDown={handleKeyDown(idx)}
            onBlur={handleBlur(idx)}
            style={{
              width: "100%",
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              outline: "none",
              transition: "box-shadow .15s ease, border-color .15s ease",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default DescriptionCell;



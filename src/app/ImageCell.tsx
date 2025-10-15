"use client";
import React from "react";
import { CELL_ID, computeBelowCell, computeNextCell, computePrevCell, focusCell } from "./navigation";
import { NavigationContext } from "./EditableCells";

type Props = {
  rowKey: string | number;
  colKey: string; // "image"
  search: string;
  imageUrl?: string;
  imageId?: string;
  onCommitSearch: (value: string) => void;
  onCommitId: (value: string) => void;
};

const inputIdFor = (rowKey: string | number, colKey: string, idx: number) =>
  `${CELL_ID(rowKey, `${colKey}-${idx}`)}`;

const ImageCell: React.FC<Props> = ({ rowKey, colKey, search, imageUrl, imageId, onCommitSearch, onCommitId }) => {
  const nav = React.useContext(NavigationContext);
  const [localSearch, setLocalSearch] = React.useState<string>(search ?? "");
  const [localId, setLocalId] = React.useState<string>(imageId ?? "");

  React.useEffect(() => setLocalSearch(search ?? ""), [search]);
  React.useEffect(() => setLocalId(imageId ?? ""), [imageId]);

  const commitSearch = () => {
    if ((search ?? "") !== localSearch) onCommitSearch(localSearch);
  };
  const commitId = () => {
    if ((imageId ?? "") !== localId) onCommitId(localId);
  };
  const revertSearch = () => setLocalSearch(search ?? "");
  const revertId = () => setLocalId(imageId ?? "");

  const focusInner = (idx: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-cell-id="${inputIdFor(rowKey, colKey, idx)}"]`);
    if (el) el.focus();
  };

  const handleKeyDown = (idx: 0 | 1): React.KeyboardEventHandler<HTMLInputElement> => (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      if (idx === 0) commitSearch(); else commitId();
      const below = computeBelowCell(nav.orderedRowKeys, rowKey, colKey);
      requestAnimationFrame(() => {
        if (below) {
          focusCell(below);
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(below.rowKey, `${below.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
      return;
    }
    if ((e.key === "Tab" && e.ctrlKey) || (e.key === "ArrowLeft" && e.ctrlKey)) {
      e.preventDefault();
      // về cột trước, revert trường hiện tại
      if (idx === 0) revertSearch(); else revertId();
      const prev = computePrevCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      requestAnimationFrame(() => {
        focusCell(prev);
        if (prev) {
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(prev.rowKey, `${prev.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx === 0) {
        commitSearch();
        requestAnimationFrame(() => focusInner(1));
      } else {
        commitId();
        const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
        requestAnimationFrame(() => {
          focusCell(next);
          if (next) {
            // nếu cột kế là mô tả, ưu tiên value đầu tiên
            const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
            if (first) first.focus();
          }
        });
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (idx === 0) {
        revertSearch();
        requestAnimationFrame(() => focusInner(1));
      } else {
        revertId();
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
      if (idx === 0) focusInner(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 1) focusInner(0);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        data-cell-id={inputIdFor(rowKey, colKey, 0)}
        className="tn-input"
        placeholder="Search image..."
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        onBlur={commitSearch}
        onKeyDown={handleKeyDown(0)}
      />
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", background: "#fafafa" }}>
        {/* Ảnh xem trước */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl || "https://via.placeholder.com/160x90?text=No+Image"}
          alt="preview"
          style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
        />
      </div>
      <input
        data-cell-id={inputIdFor(rowKey, colKey, 1)}
        className="tn-input"
        placeholder="Image ID"
        value={localId}
        onChange={(e) => setLocalId(e.target.value)}
        onBlur={commitId}
        onKeyDown={handleKeyDown(1)}
      />
    </div>
  );
};

export default ImageCell;



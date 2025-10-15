"use client";
import React from "react";
import { Input } from "antd";
import { CELL_ID, computeNextCell, computeBelowCell, computePrevCell, focusCell } from "./navigation";

// TRẠNG THÁI ĐIỀU HƯỚNG: Cung cấp thứ tự khóa hàng và danh sách cột có thể edit
type NavigationContextType = {
  orderedRowKeys: Array<string | number>;
  editableColKeysInOrder: string[];
};

export const NavigationContext = React.createContext<NavigationContextType>({
  orderedRowKeys: [],
  editableColKeysInOrder: [],
});

// PROPS: Thông tin tối thiểu để định danh một ô cho điều hướng
type BaseNavProps = {
  rowKey: string | number;
  colKey: string;
};

type EditableCellProps = BaseNavProps & {
  value: string;
  onCommit: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
};

// UI + BÀN PHÍM: Input text có 2 lớp trạng thái (dual-state)
// - UI: render <input>
// - TRẠNG THÁI: giữ local khi gõ, đồng bộ từ props khi thay đổi bên ngoài
// - BÀN PHÍM: Enter=ghi(lưu)+đi tiếp, Tab=hoàn tác+đi tiếp, Blur=ghi(lưu)
export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  onCommit,
  rowKey,
  colKey,
  placeholder,
  className,
  style,
}) => {
  const [local, setLocal] = React.useState(value ?? "");
  const nav = React.useContext(NavigationContext);

  React.useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  // TRẠNG THÁI → STORE: Ghi giá trị local lên store/cha
  const commit = React.useCallback(() => {
    if (local !== (value ?? "")) onCommit(local);
  }, [local, value, onCommit]);

  // TRẠNG THÁI ← PROPS: Hoàn tác local về giá trị props mới nhất
  const revert = React.useCallback(() => {
    setLocal(value ?? "");
  }, [value]);

  // UI: Blur cũng ghi(lưu) như Enter
  const handleBlur = () => commit();

  // BÀN PHÍM: Enter/Tab, Ctrl+Enter (xuống hàng cùng cột), Ctrl+Tab/Ctrl+ArrowLeft (về cột trước)
  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      commit();
      const below = computeBelowCell(nav.orderedRowKeys, rowKey, colKey);
      requestAnimationFrame(() => focusCell(below));
      return;
    }
    if ((e.key === "Tab" && e.ctrlKey) || (e.key === "ArrowLeft" && e.ctrlKey)) {
      e.preventDefault();
      // Ctrl+Tab: hoàn tác rồi lùi về cột trước
      revert();
      const prev = computePrevCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      requestAnimationFrame(() => {
        focusCell(prev);
        // Nếu cột trước là mô tả, ưu tiên focus vào value đầu tiên
        if (prev) {
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(prev.rowKey, `${prev.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      requestAnimationFrame(() => {
        focusCell(next);
        if (next) {
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
    } else if (e.key === "Tab") {
      e.preventDefault();
      revert();
      const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      requestAnimationFrame(() => {
        focusCell(next);
        if (next) {
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
    }
  };

  return (
    <input
      data-cell-id={CELL_ID(rowKey, colKey)}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className ?? "tn-input"}
      style={style}
      placeholder={placeholder}
    />
  );
};

type NumericEditableProps = BaseNavProps & {
  value: number;
  onCommit: (num: number) => void;
  className?: string;
  style?: React.CSSProperties;
};

// UI + BÀN PHÍM: Input số nguyên (dual-state + điều hướng)
export const NumericEditable: React.FC<NumericEditableProps> = ({
  value,
  onCommit,
  rowKey,
  colKey,
  className,
  style,
}) => {
  const [local, setLocal] = React.useState(String(value ?? 0));
  const nav = React.useContext(NavigationContext);

  React.useEffect(() => setLocal(String(value ?? 0)), [value]);

  const parseLocal = () => {
    const digits = local.replace(/\D/g, "");
    const normalized = digits.replace(/^0+(?!$)/, "");
    const num = Number(normalized || 0);
    return num;
  };

  // TRẠNG THÁI/STORE: ghi & hoàn tác
  const commit = () => onCommit(parseLocal());
  const revert = () => setLocal(String(value ?? 0));

  // UI: Blur ghi(lưu)
  const handleBlur = () => commit();

  // BÀN PHÍM: Enter/Tab, Ctrl+Enter (xuống hàng), Ctrl+Tab/Ctrl+ArrowLeft (về cột trước)
  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      commit();
      const below = computeBelowCell(nav.orderedRowKeys, rowKey, colKey);
      requestAnimationFrame(() => focusCell(below));
      return;
    }
    if ((e.key === "Tab" && e.ctrlKey) || (e.key === "ArrowLeft" && e.ctrlKey)) {
      e.preventDefault();
      revert();
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
      commit();
      const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      requestAnimationFrame(() => {
        focusCell(next);
        if (next) {
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
    } else if (e.key === "Tab") {
      e.preventDefault();
      revert();
      const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      requestAnimationFrame(() => {
        focusCell(next);
        if (next) {
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
    }
  };

  return (
    <Input
      data-cell-id={CELL_ID(rowKey, colKey)}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      inputMode="numeric"
      pattern="\d*"
      variant="borderless"
      className={className ?? "tn-input tn-input--num"}
      style={style}
    />
  );
};

type MoneyEditableProps = BaseNavProps & {
  value: number;
  isVN: boolean;
  onCommit: (num: number) => void;
  className?: string;
  style?: React.CSSProperties;
};

const formatNumber = (val: string, isVN: boolean) => {
  const parts = val.split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (isVN || parts.length === 1) return intPart;
  return `${intPart}.${parts[1].slice(0, 2)}`;
};

// UI + BÀN PHÍM: Input tiền/thập phân có format
// - VND: số nguyên; USD: 2 chữ số thập phân
// - Dual-state + quy tắc Enter/Tab/Blur
export const MoneyEditable: React.FC<MoneyEditableProps> = ({
  value,
  isVN,
  onCommit,
  rowKey,
  colKey,
  className,
  style,
}) => {
  const [local, setLocal] = React.useState("");
  const nav = React.useContext(NavigationContext);

  React.useEffect(() => {
    const formatted = isVN
      ? formatNumber(Math.floor(value ?? 0).toString(), true)
      : formatNumber((value ?? 0).toFixed(2), false);
    setLocal(formatted);
  }, [value, isVN]);

  const sanitize = (raw: string) => {
    const stripped = raw.replace(/,/g, "");
    return isVN ? stripped.replace(/\D/g, "") : stripped.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  };

  // TRẠNG THÁI → STORE: Ghi số đã chuẩn hóa
  const commit = () => {
    const raw = local.replace(/,/g, "");
    const num = isVN ? parseInt(raw || "0", 10) : parseFloat(raw || "0");
    if (!isNaN(num)) onCommit(isVN ? num : Math.round(num * 100) / 100);
  };

  // TRẠNG THÁI ← PROPS: Đồng bộ lại UI từ prop
  const revert = () => {
    const formatted = isVN
      ? formatNumber(Math.floor(value ?? 0).toString(), true)
      : formatNumber((value ?? 0).toFixed(2), false);
    setLocal(formatted);
  };

  // UI: Blur ghi(lưu)
  const handleBlur = () => commit();

  // BÀN PHÍM: Enter/Tab, Ctrl+Enter (xuống hàng), Ctrl+Tab/Ctrl+ArrowLeft (về cột trước)
  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      commit();
      const below = computeBelowCell(nav.orderedRowKeys, rowKey, colKey);
      requestAnimationFrame(() => focusCell(below));
      return;
    }
    if ((e.key === "Tab" && e.ctrlKey) || (e.key === "ArrowLeft" && e.ctrlKey)) {
      e.preventDefault();
      revert();
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
      commit();
      const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      requestAnimationFrame(() => {
        focusCell(next);
        if (next) {
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
    } else if (e.key === "Tab") {
      e.preventDefault();
      revert();
      const next = computeNextCell(nav.orderedRowKeys, nav.editableColKeysInOrder, rowKey, colKey);
      requestAnimationFrame(() => {
        focusCell(next);
        if (next) {
          const first = document.querySelector<HTMLInputElement>(`[data-cell-id="${CELL_ID(next.rowKey, `${next.colKey}-0`)}"]`);
          if (first) first.focus();
        }
      });
    }
  };

  return (
    <input
      data-cell-id={CELL_ID(rowKey, colKey)}
      value={local}
      onChange={(e) => setLocal(formatNumber(sanitize(e.target.value), isVN))}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      inputMode="decimal"
      className={className ?? "tn-input tn-input--money"}
      style={style}
    />
  );
};



"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectMenuProps = {
  id?: string;
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

export function SelectMenu({ id, ariaLabel, value, options, onChange }: SelectMenuProps) {
  const generatedId = useId().replace(/:/g, "");
  const controlId = id ?? `select-menu-${generatedId}`;
  const listboxId = `${controlId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0] ?? { value, label: value },
    [options, value]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !rootRef.current) return;
      if (!rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="select-menu" ref={rootRef}>
      <button
        id={controlId}
        type="button"
        className={`select-menu-trigger${open ? " open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="select-menu-label">{selected.label}</span>
        <span className="select-menu-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="select-menu-list" id={listboxId} role="listbox" aria-labelledby={controlId}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`select-menu-option${option.value === value ? " selected" : ""}`}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}


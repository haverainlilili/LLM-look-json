"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { SchemaDifference } from "../lib/schema-diff.ts";

interface SchemaChangeDialogProps {
  fileName: string;
  difference: SchemaDifference;
  onCancel: () => void;
  onConfirm: () => void;
}

function DifferenceGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="schema-change-group">
      <div>
        <h3>{title}</h3>
        <span>{count}</span>
      </div>
      {children}
    </section>
  );
}

function PathList({ paths }: { paths: string[] }) {
  return (
    <ul>
      {paths.slice(0, 6).map((path) => <li key={path}><code>{path}</code></li>)}
      {paths.length > 6 ? <li>另有 {paths.length - 6} 个字段</li> : null}
    </ul>
  );
}

export function SchemaChangeDialog({
  fileName,
  difference,
  onCancel,
  onConfirm,
}: SchemaChangeDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="schema-change-overlay">
      <div
        ref={dialogRef}
        className="schema-change-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schema-change-heading"
        aria-describedby="schema-change-description"
      >
        <p className="schema-change-eyebrow">刷新保护</p>
        <h2 id="schema-change-heading">检测到数据结构变化</h2>
        <p id="schema-change-description">
          <strong>{fileName}</strong> 的字段结构与当前标签不同。新数据尚未应用，你可以保留当前数据，或用新结构重建本地模板。
        </p>

        <div className="schema-change-summary">
          <DifferenceGroup title="新增字段" count={difference.added.length}>
            <PathList paths={difference.added} />
          </DifferenceGroup>
          <DifferenceGroup title="移除字段" count={difference.removed.length}>
            <PathList paths={difference.removed} />
          </DifferenceGroup>
          <DifferenceGroup title="类型变化" count={difference.typeChanges.length}>
            <ul>
              {difference.typeChanges.slice(0, 6).map((change) => (
                <li key={change.path}>
                  <code>{change.path}</code>
                  <span>{change.before.join(" | ")} → {change.after.join(" | ")}</span>
                </li>
              ))}
              {difference.typeChanges.length > 6 ? (
                <li>另有 {difference.typeChanges.length - 6} 个字段</li>
              ) : null}
            </ul>
          </DifferenceGroup>
        </div>

        <div className="schema-change-actions">
          <button ref={cancelRef} type="button" onClick={onCancel}>保留当前数据</button>
          <button className="is-primary" type="button" onClick={onConfirm}>
            重建模板并刷新
          </button>
        </div>
      </div>
    </div>
  );
}

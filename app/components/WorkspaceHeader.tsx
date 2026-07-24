"use client";

import { useRef } from "react";

import { AddressImport } from "./AddressImport";

interface WorkspaceHeaderProps {
  fileName: string;
  query: string;
  onQueryChange: (query: string) => void;
  onFile: (file: File) => void;
  onAddress: (address: string) => Promise<void>;
}

export function WorkspaceHeader({
  fileName,
  query,
  onQueryChange,
  onFile,
  onAddress,
}: WorkspaceHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          F
        </span>
        <div>
          <p className="brand-name">Forma</p>
          <p className="brand-tagline">让数据自己选择视图</p>
        </div>
      </div>

      <label className="search-box" htmlFor="dataset-search">
        <span aria-hidden="true">⌕</span>
        <input
          id="dataset-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索当前数据集"
          autoComplete="off"
        />
        <kbd>⌘ K</kbd>
      </label>

      <div className="header-actions">
        <div className="file-context" title={fileName}>
          <span className="status-dot" aria-hidden="true" />
          <span>{fileName}</span>
        </div>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".json,.jsonl,.ndjson,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
        <div className="open-json-control">
          <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
            <span aria-hidden="true">＋</span>
            打开 JSON
          </button>
          <AddressImport onAddress={onAddress} />
        </div>
      </div>
    </header>
  );
}

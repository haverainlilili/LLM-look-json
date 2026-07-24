"use client";

import { AddressImport } from "./AddressImport";

interface WorkspaceHeaderProps {
  fileName: string;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenFile: () => void;
  onAddress: (address: string) => Promise<void>;
}

export function WorkspaceHeader({
  fileName,
  query,
  onQueryChange,
  onOpenFile,
  onAddress,
}: WorkspaceHeaderProps) {
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
        <div className="open-json-control">
          <button className="primary-button" type="button" onClick={onOpenFile}>
            <span aria-hidden="true">＋</span>
            打开 JSON
          </button>
          <AddressImport onAddress={onAddress} />
        </div>
      </div>
    </header>
  );
}

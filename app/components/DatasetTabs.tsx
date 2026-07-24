"use client";

import { useEffect } from "react";

interface DatasetTabItem {
  id: string;
  fileName: string;
  recordCount: number;
  isAnalyzing: boolean;
  isRefreshing: boolean;
}

interface DatasetTabsProps {
  tabs: DatasetTabItem[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

export function DatasetTabs({
  tabs,
  activeId,
  onActivate,
  onClose,
  onAdd,
}: DatasetTabsProps) {
  useEffect(() => {
    document.getElementById(`dataset-tab-${activeId}`)?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeId]);

  function activateByKeyboard(index: number) {
    const target = tabs[index];
    if (!target) return;
    onActivate(target.id);
    requestAnimationFrame(() => document.getElementById(`dataset-tab-${target.id}`)?.focus());
  }

  return (
    <nav className="dataset-tabs-bar" aria-label="已打开的数据集">
      <div className="dataset-tabs-scroll">
        <div className="dataset-tab-list" role="tablist" aria-label="数据集标签页">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeId;
            return (
              <div className={`dataset-tab${isActive ? " is-active" : ""}`} key={tab.id}>
                <button
                  id={`dataset-tab-${tab.id}`}
                  className="dataset-tab-button"
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="dataset-workspace"
                  tabIndex={isActive ? 0 : -1}
                  title={tab.fileName}
                  onClick={() => onActivate(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      activateByKeyboard((index + 1) % tabs.length);
                    } else if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      activateByKeyboard((index - 1 + tabs.length) % tabs.length);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      activateByKeyboard(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      activateByKeyboard(tabs.length - 1);
                    }
                  }}
                >
                  <span className="dataset-tab-mark" aria-hidden="true">◇</span>
                  <span className="dataset-tab-name">{tab.fileName}</span>
                  <span className="dataset-tab-count">
                    {tab.isAnalyzing
                      ? "MING…"
                      : tab.isRefreshing
                        ? "刷新…"
                        : tab.recordCount.toLocaleString("zh-CN")}
                  </span>
                </button>
                <button
                  className="dataset-tab-close"
                  type="button"
                  aria-label={`关闭 ${tab.fileName}`}
                  title={
                    tab.isAnalyzing || tab.isRefreshing
                      ? "当前操作完成后可关闭"
                      : `关闭 ${tab.fileName}`
                  }
                  disabled={tabs.length === 1 || tab.isAnalyzing || tab.isRefreshing}
                  onClick={() => onClose(tab.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <button
        className="dataset-tab-add"
        type="button"
        aria-label="新增数据集"
        title="打开新的 JSON 数据集"
        onClick={onAdd}
      >
        ＋
      </button>
    </nav>
  );
}

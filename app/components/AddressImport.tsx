"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

interface AddressImportProps {
  onAddress: (address: string) => Promise<void>;
}

export function AddressImport({ onAddress }: AddressImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading) setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isLoading, isOpen]);

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    setError("");
    setIsLoading(true);

    try {
      await onAddress(address);
      setAddress("");
      setIsOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取这个文件地址。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="address-import">
      <button
        className="address-toggle-button"
        type="button"
        aria-label="粘贴文件地址"
        title="粘贴文件地址"
        aria-expanded={isOpen}
        aria-controls="file-address-popover"
        onClick={() => {
          setError("");
          setIsOpen((current) => !current);
        }}
      >
        <span aria-hidden="true">⌁</span>
      </button>

      {isOpen ? (
        <form
          id="file-address-popover"
          className="file-address-popover"
          role="dialog"
          aria-labelledby="file-address-heading"
          onSubmit={(event) => void submitAddress(event)}
        >
          <div className="address-popover-heading">
            <div>
              <p className="address-eyebrow">地址导入</p>
              <h2 id="file-address-heading">粘贴文件地址</h2>
            </div>
            <button
              className="address-close-button"
              type="button"
              aria-label="关闭文件地址输入"
              disabled={isLoading}
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <label htmlFor="dataset-address">JSON 文件 URL</label>
          <input
            ref={inputRef}
            id="dataset-address"
            type="text"
            inputMode="url"
            maxLength={2048}
            autoComplete="url"
            placeholder="https://example.com/data.json"
            value={address}
            disabled={isLoading}
            onChange={(event) => setAddress(event.target.value)}
          />
          <p className="address-helper">
            支持 HTTPS；本机服务可用 localhost 地址。目标需允许跨域读取。
          </p>
          {error ? (
            <p className="address-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="address-submit-button"
            type="submit"
            disabled={isLoading || !address.trim()}
          >
            {isLoading ? "正在读取…" : "从地址打开"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

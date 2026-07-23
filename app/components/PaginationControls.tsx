import { TABLE_PAGE_SIZE_OPTIONS } from "../lib/pagination.ts";

interface PaginationControlsProps {
  page: number;
  pageCount: number;
  tablePageSize?: number;
  onPageChange: (page: number) => void;
  onTablePageSizeChange: (pageSize: number) => void;
}

export function PaginationControls({
  page,
  pageCount,
  tablePageSize,
  onPageChange,
  onTablePageSizeChange,
}: PaginationControlsProps) {
  return (
    <div className="pagination-tools">
      {tablePageSize ? (
        <label className="page-size-control">
          <span>每页</span>
          <select
            aria-label="每页记录数"
            value={tablePageSize}
            onChange={(event) => onTablePageSizeChange(Number(event.target.value))}
          >
            {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
              <option value={size} key={size}>{size}</option>
            ))}
          </select>
          <span>条</span>
        </label>
      ) : null}
      <nav className="page-navigation" aria-label="分页导航">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="上一页"
        >
          ←
        </button>
        <label className="page-number-control">
          <span className="visually-hidden">选择页码</span>
          <input
            type="number"
            inputMode="numeric"
            min={pageCount === 0 ? 0 : 1}
            max={pageCount}
            value={page}
            disabled={pageCount === 0}
            aria-label="选择页码"
            onChange={(event) => {
              if (Number.isFinite(event.target.valueAsNumber)) {
                onPageChange(event.target.valueAsNumber);
              }
            }}
          />
        </label>
        <span className="page-count">/ {pageCount} 页</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === 0 || page >= pageCount}
          aria-label="下一页"
        >
          →
        </button>
      </nav>
    </div>
  );
}

export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export interface PaginationWindow {
  page: number;
  pageCount: number;
  start: number;
  end: number;
}

function wholeNumber(value: number, minimum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : minimum;
}

export function paginationForIndex(
  totalItems: number,
  pageSize: number,
  activeIndex: number,
): PaginationWindow {
  const total = wholeNumber(totalItems, 0);
  const size = wholeNumber(pageSize, 1);
  if (total === 0) return { page: 0, pageCount: 0, start: 0, end: 0 };

  const index = Math.min(wholeNumber(activeIndex, 0), total - 1);
  const pageCount = Math.ceil(total / size);
  const page = Math.floor(index / size) + 1;
  const start = (page - 1) * size;
  return { page, pageCount, start, end: Math.min(start + size, total) };
}

export function pageStartIndex(
  totalItems: number,
  pageSize: number,
  requestedPage: number,
): number {
  const total = wholeNumber(totalItems, 0);
  const size = wholeNumber(pageSize, 1);
  if (total === 0) return 0;

  const pageCount = Math.ceil(total / size);
  const page = Math.min(Math.max(wholeNumber(requestedPage, 1), 1), pageCount);
  return (page - 1) * size;
}

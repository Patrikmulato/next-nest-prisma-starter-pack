export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
};

export function parsePagination(pageRaw?: string, limitRaw?: string): PaginationParams {
  const page = Number(pageRaw ?? '1');
  const limit = Number(limitRaw ?? '20');

  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

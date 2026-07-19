/**
 * Parse and normalize page/limit query params.
 */
const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const pageNum = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageLimit = Math.min(
    Math.max(parseInt(query.limit, 10) || defaultLimit, 1),
    maxLimit
  );
  const skip = (pageNum - 1) * pageLimit;

  return { pageNum, pageLimit, skip };
};

/**
 * Build a consistent pagination object for list/feed responses.
 */
const buildPaginationMeta = ({ pageNum, pageLimit, total, count }) => {
  const pages = pageLimit > 0 ? Math.ceil(total / pageLimit) : 0;

  return {
    page: pageNum,
    limit: pageLimit,
    total,
    pages,
    hasMore: skipCount(pageNum, pageLimit) + count < total,
    hasNextPage: pageNum < pages,
    hasPrevPage: pageNum > 1
  };
};

const skipCount = (pageNum, pageLimit) => (pageNum - 1) * pageLimit;

module.exports = {
  parsePagination,
  buildPaginationMeta
};

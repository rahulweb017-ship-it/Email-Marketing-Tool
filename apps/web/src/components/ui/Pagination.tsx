interface PaginationProps {
  page: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: number[];
}

const DEFAULT_PER_PAGE_OPTIONS = [20, 30, 50, 100];

export default function Pagination({ page, total, perPage, onPageChange, onPerPageChange, perPageOptions = DEFAULT_PER_PAGE_OPTIONS }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{total} total</p>
        {onPerPageChange && (
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="px-2 py-1.5 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500"
          >
            {perPageOptions.map((opt) => (
              <option key={opt} value={opt}>{opt} per page</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}

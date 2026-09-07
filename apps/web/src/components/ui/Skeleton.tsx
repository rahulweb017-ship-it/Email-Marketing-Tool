export function SkeletonText({ width = 'w-full', className = '' }: { width?: string; className?: string }) {
  return <div className={`h-4 ${width} shimmer-bg ${className}`} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonText width="w-24" />
          <div className="h-8 w-20 shimmer-bg" />
        </div>
        <div className="h-12 w-12 shimmer-bg rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <SkeletonText width="w-20" />
          <div className="h-8 w-24 shimmer-bg" />
          <SkeletonText width="w-16" />
        </div>
        <div className="h-12 w-12 shimmer-bg rounded-xl" />
      </div>
      <div className="mt-4 h-10 w-full shimmer-bg" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="h-10 w-10 shimmer-bg rounded-full" />
      <div className="flex-1 space-y-2">
        <SkeletonText width="w-48" />
        <SkeletonText width="w-32" />
      </div>
      <SkeletonText width="w-20" />
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 shimmer-bg" />
        <div className="h-10 w-32 shimmer-bg rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 shimmer-bg" />
        <div className="h-10 w-32 shimmer-bg rounded-lg" />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y dark:divide-gray-700">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 shimmer-bg" />
        <div className="flex gap-3">
          <div className="h-10 w-64 shimmer-bg rounded-lg" />
          <div className="h-10 w-32 shimmer-bg rounded-lg" />
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-5 gap-4 p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 shimmer-bg rounded" />
          ))}
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b dark:border-gray-700 last:border-0">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-4 shimmer-bg rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome banner */}
      <div className="h-24 shimmer-bg rounded-2xl" />

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 shimmer-bg rounded-xl" />
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <SkeletonText width="w-48" className="mb-6" />
        <div className="h-72 shimmer-bg" />
      </div>
    </div>
  );
}

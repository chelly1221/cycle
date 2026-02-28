export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="h-8 w-48 bg-gray-800 rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-40 bg-gray-900 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

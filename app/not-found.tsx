export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-strava font-mono text-xs tracking-widest">404</p>
      <h1 className="text-3xl font-bold text-white">Road not found</h1>
      <a href="/" className="text-gray-400 hover:text-white text-sm underline">
        Back to the archive
      </a>
    </div>
  );
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-strava font-mono text-xs tracking-widest">404</p>
      <h1 className="text-3xl font-bold text-white">
        도로를 찾을 수 없습니다
      </h1>
      <a href="/" className="text-gray-400 hover:text-white text-sm underline">
        아카이브로 돌아가기
      </a>
    </div>
  )
}

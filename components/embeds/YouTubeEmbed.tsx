interface Props {
  url: string;
  title?: string;
  fallbackTitle?: string;
  className?: string;
}

function extractVideoId(url: string): string {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /[?&]v=([^?&]+)/,
    /^[a-zA-Z0-9_-]{11}$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return url;
}

export default function YouTubeEmbed({
  url,
  title,
  fallbackTitle = "Ride Film",
  className,
}: Props) {
  const resolvedTitle = title ?? fallbackTitle;
  const videoId = extractVideoId(url);

  return (
    <div className={`relative aspect-video ${className ?? ""}`}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
        title={resolvedTitle}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full rounded-lg"
      />
    </div>
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,          // 1초마다 파일 변경 확인 (polling)
      aggregateTimeout: 300,
    }
    return config
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.strava.com" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "dgtzuqphqg23d.cloudfront.net" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;

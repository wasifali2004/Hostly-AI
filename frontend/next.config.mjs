/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets local tooling isolate dev/build caches when another process owns .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" }
    ]
  }
};

export default nextConfig;

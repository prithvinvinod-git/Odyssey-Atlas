import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.nasa.gov" },
      { protocol: "https", hostname: "**.jpl.nasa.gov" },
      { protocol: "https", hostname: "trek.nasa.gov" },
      { protocol: "https", hostname: "pds.nasa.gov" },
      { protocol: "https", hostname: "naif.jpl.nasa.gov" },
    ],
  },
  async headers() {
    return [
      {
        source: "/public/data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/public/textures/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "github.com" }],
  },
  poweredByHeader: false,
};

export default nextConfig;


import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  env: {
    AI_SDK_LOG_WARNINGS: "false",
  },
};

export default nextConfig;
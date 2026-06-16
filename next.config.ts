import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // hwp.js(및 cfb)가 브라우저에서 Node 코어 모듈을 import하므로 클라이언트 번들에서 stub 처리
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        stream: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;

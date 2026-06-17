import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 업로드(Server Action FormData) 본문 한도. 기본 1MB → 상향.
  // (Vercel 서버리스 요청 본문 한도 ~4.5MB 이내로 설정. 사내 서버 이전 시 더 키울 수 있음)
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
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
      // react-pdf(pdf.js)는 브라우저에서 canvas 네이티브 모듈을 요구하지 않으므로 stub
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;

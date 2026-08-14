import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 사내 k8s(도커) 배포용 — 서버 실행에 필요한 파일만 추린 standalone 출력.
  // Vercel은 이 옵션을 무시하고 자체 서버리스 출력을 쓰므로 기존 배포에 영향 없음.
  output: "standalone",
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

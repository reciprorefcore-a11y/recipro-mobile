import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.11.19'],
  // xlsx/iconv-liteはネイティブNode.jsモジュールとして扱う
  // (Next.jsバンドルに含めるとVercel環境で動作不安定になる)
  serverExternalPackages: ['xlsx', 'iconv-lite'],
};

export default nextConfig;
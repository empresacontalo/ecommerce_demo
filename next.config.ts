import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp'],
  images: {
    // O admin pode informar o link de qualquer foto online (upload padrão fica
    // em data URI, que o otimizador já aceita sem esta regra).
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=self, microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

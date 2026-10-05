import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Camera and microphone are needed only on our own origin.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(self)' }],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'yjs', 
    'y-websocket', 
    'y-codemirror.next', 
    'y-indexeddb',
    'lib0',
    'y-protocols'
  ],
};

export default nextConfig;

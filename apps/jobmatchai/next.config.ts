import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@aurexara/engine',
    '@aurexara/agent-runtime', 
    '@aurexara/ai-core', 
    '@aurexara/config', 
    '@aurexara/events', 
    '@aurexara/knowledge-core', 
    '@aurexara/observability', 
    '@aurexara/security'
  ],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"]
    };
    return config;
  }
};

export default nextConfig;

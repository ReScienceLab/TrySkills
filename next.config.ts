import type { NextConfig } from "next";
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";
import { env, nodeless } from "unenv";

const { alias: turbopackAlias } = env(nodeless, {});

const nextConfig: NextConfig = {
  serverExternalPackages: ["@daytona/sdk", "@opentelemetry/resources", "@opentelemetry/sdk-trace-base"],
  turbopack: {
    resolveAlias: {
      ...turbopackAlias,
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(new NodePolyfillPlugin());
    }
    return config;
  },
};

export default nextConfig;

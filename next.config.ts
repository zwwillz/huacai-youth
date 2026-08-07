import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // EdgeOne Pages deploys this project as a full-stack Next.js application.
  // Standalone output makes the Node SSR/server handler explicit for the
  // EdgeOne OpenNext adapter instead of allowing the build to fall back to
  // a "pure project" when server-handler detection is unstable.
  output: "standalone",
};

export default nextConfig;

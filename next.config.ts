import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Separa los artefactos de `next build` y `next dev` para que nunca colisionen los chunks en `.next`
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
};

export default nextConfig;

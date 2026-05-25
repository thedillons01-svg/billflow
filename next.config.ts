import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ssh2', 'pdfkit', 'sharp'],
};

export default nextConfig;

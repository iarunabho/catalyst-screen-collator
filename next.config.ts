import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_MIXPANEL_TOKEN: process.env.MIXPANEL_TOKEN,
  },
};

export default nextConfig;

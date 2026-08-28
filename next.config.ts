import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Company logo served from the public Supabase Storage bucket.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" }],
  },
};

export default nextConfig;

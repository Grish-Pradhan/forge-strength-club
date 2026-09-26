/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      // Supabase Storage avatars / class covers
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default nextConfig;

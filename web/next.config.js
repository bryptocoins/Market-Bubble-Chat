/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // overlay/feed mutate refs; avoid double-mount churn
};
module.exports = nextConfig;

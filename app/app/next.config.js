/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {
      // Force Turbopack root to this folder
      root: __dirname,
    },
  };
  
  module.exports = nextConfig;
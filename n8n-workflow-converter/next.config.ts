import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable compression for better performance
  compress: true,
  
  // Optimize images
  images: {
    domains: [
      // Add your Supabase project domain
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || '',
      // Add CDN domain if configured
      ...(process.env.NEXT_PUBLIC_CDN_URL ? [process.env.NEXT_PUBLIC_CDN_URL.replace('https://', '')] : [])
    ].filter(Boolean),
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Enable standalone output for Docker deployment
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          ...(process.env.NODE_ENV === 'production' ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload'
            },
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: https:",
                "font-src 'self'",
                "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'"
              ].join('; ')
            }
          ] : [])
        ]
      }
    ]
  },
  
  // Redirects for better SEO
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true
      },

    ]
  },
  
  // Rewrites for API optimization
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health'
      }
    ]
  },
  
  // Webpack configuration for optimization
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all',
            },
            common: {
              name: 'common',
              minChunks: 2,
              priority: -5,
              chunks: 'all',
              enforce: true,
            },
            // Separate chunk for large libraries
            supabase: {
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              name: 'supabase',
              chunks: 'all',
              priority: 10,
            },
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 20,
            },
          },
        },
        // Enable module concatenation
        concatenateModules: true,
        // Enable tree shaking
        usedExports: true,
        sideEffects: false,
      }
    }
    
    // Bundle analyzer in development
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      );
    }
    
    return config
  },
  
  // Server external packages (moved from experimental)
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // Experimental features for better performance
  experimental: {
    // Optimize CSS
    optimizeCss: true,
    // Enable partial prerendering
    ppr: false, // Enable when stable
  },
  
  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // TypeScript configuration
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors. Only enable in emergency situations.
    ignoreBuildErrors: false,
  },
  
  // ESLint configuration
  eslint: {
    // Only run ESLint on these directories during production builds
    dirs: ['src', 'lib', 'components'],
    // Don't fail build on ESLint errors in production
    ignoreDuringBuilds: false,
  },
  
  // Power pack features
  poweredByHeader: false,
  
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

export default nextConfig;

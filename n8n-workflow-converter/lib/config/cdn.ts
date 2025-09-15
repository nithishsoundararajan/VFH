/**
 * CDN and Static Asset Configuration
 * Handles asset optimization and CDN integration for production
 */

export interface CDNConfig {
  enabled: boolean
  baseUrl?: string
  staticAssets: {
    images: boolean
    fonts: boolean
    scripts: boolean
    styles: boolean
  }
  caching: {
    maxAge: number
    staleWhileRevalidate: number
  }
}

/**
 * CDN configuration based on environment
 */
export const cdnConfig: CDNConfig = {
  enabled: !!process.env.NEXT_PUBLIC_CDN_URL,
  baseUrl: process.env.NEXT_PUBLIC_CDN_URL,
  staticAssets: {
    images: true,
    fonts: true,
    scripts: true,
    styles: true
  },
  caching: {
    maxAge: 31536000, // 1 year
    staleWhileRevalidate: 86400 // 1 day
  }
}

/**
 * Get optimized asset URL
 */
export function getAssetUrl(path: string, type: 'image' | 'font' | 'script' | 'style' = 'image'): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  
  // If CDN is enabled and asset type is configured for CDN
  if (cdnConfig.enabled && cdnConfig.baseUrl && cdnConfig.staticAssets[type === 'script' ? 'scripts' : type === 'style' ? 'styles' : type]) {
    return `${cdnConfig.baseUrl}/${cleanPath}`
  }
  
  // Fallback to local path
  return `/${cleanPath}`
}

/**
 * Image optimization configuration
 */
export const imageConfig = {
  domains: [
    // Supabase storage domain
    ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    ] : []),
    // CDN domain
    ...(cdnConfig.baseUrl ? [
      new URL(cdnConfig.baseUrl).hostname
    ] : []),
    // Additional trusted domains
    'images.unsplash.com',
    'avatars.githubusercontent.com'
  ].filter(Boolean),
  
  formats: ['image/webp', 'image/avif'] as const,
  
  sizes: {
    thumbnail: 150,
    small: 300,
    medium: 600,
    large: 1200,
    xlarge: 1920
  },
  
  quality: {
    default: 75,
    high: 90,
    low: 60
  }
}

/**
 * Cache control headers for different asset types
 */
export const cacheHeaders = {
  // Static assets (images, fonts, etc.) - long cache
  static: {
    'Cache-Control': `public, max-age=${cdnConfig.caching.maxAge}, stale-while-revalidate=${cdnConfig.caching.staleWhileRevalidate}`,
    'Vary': 'Accept-Encoding'
  },
  
  // API responses - short cache with revalidation
  api: {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    'Vary': 'Accept-Encoding, Authorization'
  },
  
  // HTML pages - short cache
  html: {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vary': 'Accept-Encoding'
  },
  
  // No cache for sensitive data
  noCache: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
}

/**
 * Asset optimization utilities
 */
export class AssetOptimizer {
  /**
   * Generate responsive image srcSet
   */
  static generateSrcSet(basePath: string, sizes: number[] = [300, 600, 1200]): string {
    return sizes
      .map(size => `${getAssetUrl(basePath, 'image')}?w=${size} ${size}w`)
      .join(', ')
  }
  
  /**
   * Generate optimized image URL with parameters
   */
  static getOptimizedImageUrl(
    path: string, 
    options: {
      width?: number
      height?: number
      quality?: number
      format?: 'webp' | 'avif' | 'jpeg' | 'png'
    } = {}
  ): string {
    const baseUrl = getAssetUrl(path, 'image')
    const params = new URLSearchParams()
    
    if (options.width) params.set('w', options.width.toString())
    if (options.height) params.set('h', options.height.toString())
    if (options.quality) params.set('q', options.quality.toString())
    if (options.format) params.set('f', options.format)
    
    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }
  
  /**
   * Preload critical assets
   */
  static generatePreloadLinks(assets: Array<{
    href: string
    as: 'image' | 'font' | 'script' | 'style'
    type?: string
    crossorigin?: boolean
  }>): string {
    return assets
      .map(asset => {
        const attrs = [
          `rel="preload"`,
          `href="${getAssetUrl(asset.href, asset.as)}"`,
          `as="${asset.as}"`
        ]
        
        if (asset.type) attrs.push(`type="${asset.type}"`)
        if (asset.crossorigin) attrs.push('crossorigin')
        
        return `<link ${attrs.join(' ')} />`
      })
      .join('\n')
  }
}

/**
 * Performance monitoring for assets
 */
export class AssetPerformanceMonitor {
  private static metrics: Map<string, {
    loadTime: number
    size: number
    cached: boolean
  }> = new Map()
  
  /**
   * Track asset loading performance
   */
  static trackAssetLoad(url: string, loadTime: number, size: number, cached: boolean = false) {
    this.metrics.set(url, { loadTime, size, cached })
  }
  
  /**
   * Get performance metrics for assets
   */
  static getMetrics() {
    return Array.from(this.metrics.entries()).map(([url, metrics]) => ({
      url,
      ...metrics
    }))
  }
  
  /**
   * Get slow loading assets
   */
  static getSlowAssets(threshold: number = 1000) {
    return this.getMetrics().filter(metric => metric.loadTime > threshold)
  }
  
  /**
   * Clear metrics
   */
  static clearMetrics() {
    this.metrics.clear()
  }
}

/**
 * Service Worker configuration for asset caching
 */
export const serviceWorkerConfig = {
  enabled: process.env.NODE_ENV === 'production',
  
  cacheStrategies: {
    // Cache first for static assets
    static: {
      pattern: /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/,
      strategy: 'CacheFirst',
      maxAge: cdnConfig.caching.maxAge
    },
    
    // Network first for API calls
    api: {
      pattern: /\/api\//,
      strategy: 'NetworkFirst',
      maxAge: 300 // 5 minutes
    },
    
    // Stale while revalidate for pages
    pages: {
      pattern: /\/(?!api)/,
      strategy: 'StaleWhileRevalidate',
      maxAge: 3600 // 1 hour
    }
  }
}
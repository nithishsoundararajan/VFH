'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ExternalLink, Shield } from 'lucide-react'
import Link from 'next/link'

interface LicenseBadgeProps {
  license: string
  package?: string
  repository?: string
  className?: string
}

export function LicenseBadge({ license, package: packageName, repository, className }: LicenseBadgeProps) {
  const getLicenseColor = (license: string) => {
    switch (license.toLowerCase()) {
      case 'mit':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'apache-2.0':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'bsd-3-clause':
      case 'bsd-2-clause':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'isc':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'gpl-2.0':
      case 'gpl-3.0':
      case 'lgpl-2.1':
      case 'lgpl-3.0':
      case 'agpl-1.0':
      case 'agpl-3.0':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getLicenseUrl = (license: string) => {
    switch (license.toLowerCase()) {
      case 'mit':
        return 'https://opensource.org/licenses/MIT'
      case 'apache-2.0':
        return 'https://www.apache.org/licenses/LICENSE-2.0'
      case 'bsd-3-clause':
        return 'https://opensource.org/licenses/BSD-3-Clause'
      case 'bsd-2-clause':
        return 'https://opensource.org/licenses/BSD-2-Clause'
      case 'isc':
        return 'https://opensource.org/licenses/ISC'
      case 'gpl-2.0':
        return 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'
      case 'gpl-3.0':
        return 'https://www.gnu.org/licenses/gpl-3.0.html'
      default:
        return `https://spdx.org/licenses/${license}.html`
    }
  }

  const isCompatible = (license: string) => {
    const compatibleLicenses = ['mit', 'apache-2.0', 'bsd-3-clause', 'bsd-2-clause', 'isc']
    return compatibleLicenses.includes(license.toLowerCase())
  }

  const tooltipContent = (
    <div className="space-y-2">
      <div className="font-semibold">{license} License</div>
      {packageName && (
        <div className="text-sm">Package: {packageName}</div>
      )}
      <div className="text-sm">
        Compatibility: {isCompatible(license) ? '✅ Compatible' : '⚠️ Needs Review'}
      </div>
      {repository && (
        <Link 
          href={repository} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm"
        >
          <span>View Repository</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link 
            href={getLicenseUrl(license)} 
            target="_blank" 
            rel="noopener noreferrer"
            className={className}
          >
            <Badge 
              variant="outline" 
              className={`${getLicenseColor(license)} cursor-pointer hover:opacity-80 transition-opacity`}
            >
              <Shield className="h-3 w-3 mr-1" />
              {license}
            </Badge>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface LicenseListProps {
  licenses: Array<{
    name: string
    license: string
    repository?: string
  }>
  className?: string
}

export function LicenseList({ licenses, className }: LicenseListProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {licenses.map((pkg, index) => (
        <LicenseBadge
          key={index}
          license={pkg.license}
          package={pkg.name}
          repository={pkg.repository}
        />
      ))}
    </div>
  )
}
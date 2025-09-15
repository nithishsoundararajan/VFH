import { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, Shield, Heart, Code, Database, Palette } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LicenseBadge } from '@/components/attribution/license-badge'

export const metadata: Metadata = {
  title: 'Attribution & Licenses | n8n Workflow Converter',
  description: 'Complete attribution and licensing information for all third-party components used in the n8n Workflow Converter.',
}

const corePackages = [
  {
    name: 'n8n-core',
    license: 'Apache-2.0',
    copyright: 'n8n GmbH',
    website: 'https://n8n.io',
    repository: 'https://github.com/n8n-io/n8n',
    description: 'Core n8n functionality for workflow execution',
    category: 'Workflow Engine'
  },
  {
    name: 'n8n-workflow',
    license: 'Apache-2.0',
    copyright: 'n8n GmbH',
    website: 'https://n8n.io',
    repository: 'https://github.com/n8n-io/n8n',
    description: 'Workflow parsing and execution logic',
    category: 'Workflow Engine'
  },
  {
    name: 'n8n-nodes-base',
    license: 'Apache-2.0',
    copyright: 'n8n GmbH',
    website: 'https://n8n.io',
    repository: 'https://github.com/n8n-io/n8n',
    description: 'Standard node implementations',
    category: 'Workflow Engine'
  }
]

const frameworkPackages = [
  {
    name: 'Next.js',
    license: 'MIT',
    copyright: 'Vercel, Inc.',
    website: 'https://nextjs.org',
    repository: 'https://github.com/vercel/next.js',
    description: 'React framework for production',
    category: 'Frontend Framework'
  },
  {
    name: 'React',
    license: 'MIT',
    copyright: 'Meta Platforms, Inc.',
    website: 'https://reactjs.org',
    repository: 'https://github.com/facebook/react',
    description: 'JavaScript library for building user interfaces',
    category: 'Frontend Framework'
  },
  {
    name: 'TypeScript',
    license: 'Apache-2.0',
    copyright: 'Microsoft Corporation',
    website: 'https://www.typescriptlang.org',
    repository: 'https://github.com/microsoft/TypeScript',
    description: 'TypeScript language support',
    category: 'Development Tools'
  }
]

const backendPackages = [
  {
    name: 'Supabase',
    license: 'Apache-2.0',
    copyright: 'Supabase Inc.',
    website: 'https://supabase.com',
    repository: 'https://github.com/supabase/supabase',
    description: 'Backend-as-a-Service platform',
    category: 'Backend Services'
  },
  {
    name: 'Tailwind CSS',
    license: 'MIT',
    copyright: 'Tailwind Labs Inc.',
    website: 'https://tailwindcss.com',
    repository: 'https://github.com/tailwindlabs/tailwindcss',
    description: 'Utility-first CSS framework',
    category: 'Styling'
  }
]

function PackageCard({ pkg }: { pkg: typeof corePackages[0] }) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Workflow Engine':
        return <Code className="h-5 w-5" />
      case 'Frontend Framework':
        return <Palette className="h-5 w-5" />
      case 'Backend Services':
        return <Database className="h-5 w-5" />
      case 'Development Tools':
        return <Shield className="h-5 w-5" />
      default:
        return <Code className="h-5 w-5" />
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="text-lg">{pkg.name}</CardTitle>
            <div className="flex items-center space-x-2">
              {getCategoryIcon(pkg.category)}
              <Badge variant="secondary">{pkg.category}</Badge>
            </div>
          </div>
          <LicenseBadge license={pkg.license} package={pkg.name} repository={pkg.repository} />
        </div>
        <CardDescription>{pkg.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Copyright</div>
            <div className="text-sm">{pkg.copyright}</div>
          </div>
          
          <div className="flex flex-col space-y-2">
            <Link 
              href={pkg.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
            >
              <span>Website</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            
            <Link 
              href={pkg.repository} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
            >
              <span>Repository</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AttributionPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-bold">Attribution & Licenses</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          We stand on the shoulders of giants. This page acknowledges all the amazing 
          open source projects that make the n8n Workflow Converter possible.
        </p>
      </div>

      {/* Special Thanks to n8n */}
      <Card className="mb-12 border-2 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Heart className="h-6 w-6 text-red-500 fill-current" />
            <CardTitle className="text-2xl">Special Thanks to n8n</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-lg">
              This project would not be possible without the excellent work of the n8n team. 
              We use official n8n packages to ensure compatibility and maintain the same 
              high-quality workflow execution that n8n users expect.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">n8n Attribution Requirements</h3>
              <ul className="space-y-1 text-sm">
                <li>• All generated projects include proper n8n attribution</li>
                <li>• Apache License 2.0 compliance for all n8n components</li>
                <li>• Clear indication that this is an independent project</li>
                <li>• Links to official n8n resources and documentation</li>
              </ul>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <Link 
                href="https://n8n.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>Visit n8n.io</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
              
              <Link 
                href="https://github.com/n8n-io/n8n" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 border border-gray-300 dark:border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span>n8n on GitHub</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core n8n Packages */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Core n8n Packages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {corePackages.map((pkg, index) => (
            <PackageCard key={index} pkg={pkg} />
          ))}
        </div>
      </section>

      {/* Frontend Framework */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Frontend Framework & Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {frameworkPackages.map((pkg, index) => (
            <PackageCard key={index} pkg={pkg} />
          ))}
        </div>
      </section>

      {/* Backend Services */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Backend Services & Styling</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {backendPackages.map((pkg, index) => (
            <PackageCard key={index} pkg={pkg} />
          ))}
        </div>
      </section>

      {/* License Compliance */}
      <section className="mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">License Compliance</CardTitle>
            <CardDescription>
              How we ensure compliance with all open source licenses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Our Commitment</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start space-x-2">
                    <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>All third-party licenses are respected and properly attributed</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>Automated license checking in our CI/CD pipeline</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>Regular audits of dependencies and their licenses</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>Generated projects include proper attribution</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">License Compatibility</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Our MIT license is compatible with the following licenses used by our dependencies:
                </p>
                <div className="flex flex-wrap gap-2">
                  <LicenseBadge license="MIT" />
                  <LicenseBadge license="Apache-2.0" />
                  <LicenseBadge license="BSD-3-Clause" />
                  <LicenseBadge license="ISC" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Additional Resources */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Additional Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Documentation</h3>
                <div className="space-y-2">
                  <Link 
                    href="/legal/licenses" 
                    className="block text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Complete Third-Party Licenses
                  </Link>
                  <Link 
                    href="/docs/LICENSE-ATTRIBUTION.md" 
                    className="block text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    License Attribution Guide
                  </Link>
                  <Link 
                    href="/docs/DEVELOPER-GUIDE.md" 
                    className="block text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Developer Guide
                  </Link>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-3">Legal</h3>
                <div className="space-y-2">
                  <Link 
                    href="/legal/privacy" 
                    className="block text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Privacy Policy
                  </Link>
                  <Link 
                    href="/legal/terms" 
                    className="block text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Terms of Service
                  </Link>
                  <Link 
                    href="https://github.com/your-org/n8n-workflow-converter/blob/main/LICENSE" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <span>MIT License (Full Text)</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
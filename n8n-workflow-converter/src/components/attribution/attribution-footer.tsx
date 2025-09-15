'use client'

import Link from 'next/link'
import { ExternalLink, Heart } from 'lucide-react'

export function AttributionFooter() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Project Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">n8n Workflow Converter</h3>
            <p className="text-sm text-muted-foreground">
              Convert n8n workflows to standalone Node.js projects with ease.
            </p>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Made with</span>
              <Heart className="h-4 w-4 text-red-500 fill-current" />
              <span>by the community</span>
            </div>
          </div>

          {/* Attribution */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Attribution</h3>
            <div className="space-y-2 text-sm">
              <div>
                <Link 
                  href="https://n8n.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <span>Powered by n8n</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <p className="text-muted-foreground">
                  Uses official n8n packages under Apache License 2.0
                </p>
              </div>
              
              <div>
                <Link 
                  href="https://supabase.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                >
                  <span>Built with Supabase</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <p className="text-muted-foreground">
                  Backend services and real-time functionality
                </p>
              </div>
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Legal</h3>
            <div className="space-y-2 text-sm">
              <Link 
                href="/legal/licenses" 
                className="block text-muted-foreground hover:text-foreground"
              >
                Third-Party Licenses
              </Link>
              <Link 
                href="/legal/attribution" 
                className="block text-muted-foreground hover:text-foreground"
              >
                Attribution Details
              </Link>
              <Link 
                href="/legal/privacy" 
                className="block text-muted-foreground hover:text-foreground"
              >
                Privacy Policy
              </Link>
              <Link 
                href="/legal/terms" 
                className="block text-muted-foreground hover:text-foreground"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-muted-foreground">
              © 2024 n8n Workflow Converter. Licensed under MIT License.
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <Link 
                href="https://github.com/your-org/n8n-workflow-converter" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-muted-foreground hover:text-foreground"
              >
                <span>Source Code</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              
              <Link 
                href="/docs" 
                className="text-muted-foreground hover:text-foreground"
              >
                Documentation
              </Link>
              
              <Link 
                href="/support" 
                className="text-muted-foreground hover:text-foreground"
              >
                Support
              </Link>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 pt-6 border-t">
          <p className="text-xs text-muted-foreground text-center">
            This project is not officially affiliated with n8n GmbH. 
            The n8n name and logo are trademarks of n8n GmbH. 
            This is an independent tool that uses publicly available n8n packages.
          </p>
        </div>
      </div>
    </footer>
  )
}
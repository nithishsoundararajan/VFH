# Developer Guide

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Architecture](#project-architecture)
3. [Contributing Guidelines](#contributing-guidelines)
4. [Code Standards](#code-standards)
5. [Testing](#testing)
6. [Debugging](#debugging)
7. [Performance Optimization](#performance-optimization)
8. [Security Considerations](#security-considerations)

## Development Setup

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm**: Version 9 or higher (comes with Node.js)
- **Git**: For version control
- **Supabase CLI**: For local development with Supabase
- **Docker**: Optional, for containerized development

### Environment Setup

1. **Clone the Repository**
```bash
git clone https://github.com/your-org/n8n-workflow-converter.git
cd n8n-workflow-converter
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
VIRUSTOTAL_API_KEY=your-virustotal-key
NEXTAUTH_SECRET=your-nextauth-secret

# AI Providers (Optional)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key

# Development
NODE_ENV=development
```

4. **Supabase Setup**
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

5. **Start Development Server**
```bash
npm run dev
```

### Development Tools

#### VS Code Extensions
- **TypeScript**: Enhanced TypeScript support
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Tailwind CSS IntelliSense**: CSS class suggestions
- **Supabase**: Supabase integration

#### Recommended VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

## Project Architecture

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (auth)/            # Authentication pages
│   ├── dashboard/         # Dashboard pages
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── dashboard/        # Dashboard-specific components
│   ├── auth/             # Authentication components
│   └── shared/           # Shared components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── supabase/         # Supabase client and utilities
│   ├── auth/             # Authentication logic
│   ├── workflow-parsing/ # Workflow parsing logic
│   └── utils/            # General utilities
├── types/                # TypeScript type definitions
└── middleware.ts         # Next.js middleware
```

### Key Components

#### Supabase Integration
```typescript
// lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database'

export const supabase = createClientComponentClient<Database>()
```

#### Authentication
```typescript
// lib/auth/auth-service.ts
export class AuthService {
  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    return data
  }
  
  static async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }
}
```

#### Workflow Processing
```typescript
// lib/workflow-parsing/workflow-parser.ts
export class WorkflowParser {
  static async parseWorkflow(jsonData: any): Promise<ParsedWorkflow> {
    // Validate JSON structure
    this.validateWorkflowStructure(jsonData)
    
    // Extract nodes and connections
    const nodes = this.extractNodes(jsonData.nodes)
    const connections = this.extractConnections(jsonData.connections)
    
    return {
      name: jsonData.name,
      nodes,
      connections,
      triggers: this.extractTriggers(nodes)
    }
  }
}
```

### State Management

The application uses React hooks and Context API for state management:

```typescript
// contexts/auth-context.tsx
interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Implementation...
  
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
```

## Contributing Guidelines

### Git Workflow

1. **Fork the Repository**
2. **Create a Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

3. **Make Changes and Commit**
```bash
git add .
git commit -m "feat: add new workflow parsing feature"
```

4. **Push and Create Pull Request**
```bash
git push origin feature/your-feature-name
```

### Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```bash
feat: add real-time progress tracking
fix: resolve workflow parsing error for complex nodes
docs: update API documentation
test: add unit tests for workflow parser
```

### Pull Request Guidelines

1. **Clear Description**: Explain what changes you made and why
2. **Link Issues**: Reference any related issues
3. **Tests**: Include tests for new features
4. **Documentation**: Update documentation if needed
5. **Screenshots**: Include screenshots for UI changes

### Code Review Process

1. **Automated Checks**: Ensure all CI checks pass
2. **Peer Review**: At least one team member must review
3. **Testing**: Verify functionality works as expected
4. **Documentation**: Check that documentation is updated

## Code Standards

### TypeScript Guidelines

#### Type Definitions
```typescript
// types/workflow.ts
export interface WorkflowNode {
  id: string
  name: string
  type: string
  parameters: Record<string, any>
  position: [number, number]
}

export interface ParsedWorkflow {
  name: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  triggers: WorkflowTrigger[]
}
```

#### Error Handling
```typescript
// lib/errors/workflow-errors.ts
export class WorkflowParsingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'WorkflowParsingError'
  }
}

// Usage
try {
  const workflow = await WorkflowParser.parseWorkflow(data)
} catch (error) {
  if (error instanceof WorkflowParsingError) {
    console.error(`Parsing failed: ${error.message}`, error.details)
  }
  throw error
}
```

### React Component Guidelines

#### Component Structure
```typescript
// components/dashboard/project-card.tsx
interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
  onDownload: (id: string) => void
}

export function ProjectCard({ project, onDelete, onDownload }: ProjectCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  
  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await onDelete(project.id)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Component content */}
      </CardContent>
    </Card>
  )
}
```

#### Custom Hooks
```typescript
// hooks/use-project.ts
export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true)
        const data = await ProjectService.getProject(projectId)
        setProject(data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchProject()
  }, [projectId])
  
  return { project, loading, error }
}
```

### CSS and Styling

#### Tailwind CSS Usage
```typescript
// Use consistent spacing and color schemes
const buttonStyles = {
  base: "px-4 py-2 rounded-md font-medium transition-colors",
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300"
}

// Component with conditional styling
<button 
  className={cn(
    buttonStyles.base,
    variant === 'primary' ? buttonStyles.primary : buttonStyles.secondary,
    disabled && "opacity-50 cursor-not-allowed"
  )}
>
  {children}
</button>
```

## Testing

### Test Structure

```
src/
├── __tests__/
│   ├── e2e/              # End-to-end tests
│   ├── integration/      # Integration tests
│   └── utils/            # Test utilities
├── components/
│   └── __tests__/        # Component tests
└── lib/
    └── __tests__/        # Unit tests
```

### Unit Testing

```typescript
// lib/__tests__/workflow-parser.test.ts
import { WorkflowParser } from '../workflow-parsing/workflow-parser'

describe('WorkflowParser', () => {
  describe('parseWorkflow', () => {
    it('should parse a valid workflow', async () => {
      const mockWorkflow = {
        name: 'Test Workflow',
        nodes: [
          {
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            parameters: { url: 'https://api.example.com' }
          }
        ],
        connections: {}
      }
      
      const result = await WorkflowParser.parseWorkflow(mockWorkflow)
      
      expect(result.name).toBe('Test Workflow')
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].type).toBe('n8n-nodes-base.httpRequest')
    })
    
    it('should throw error for invalid workflow', async () => {
      const invalidWorkflow = { invalid: true }
      
      await expect(WorkflowParser.parseWorkflow(invalidWorkflow))
        .rejects.toThrow('Invalid workflow structure')
    })
  })
})
```

### Component Testing

```typescript
// components/__tests__/project-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectCard } from '../dashboard/project-card'

const mockProject = {
  id: '1',
  name: 'Test Project',
  status: 'completed',
  createdAt: new Date().toISOString()
}

describe('ProjectCard', () => {
  it('renders project information', () => {
    render(
      <ProjectCard 
        project={mockProject}
        onDelete={jest.fn()}
        onDownload={jest.fn()}
      />
    )
    
    expect(screen.getByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
  })
  
  it('calls onDelete when delete button is clicked', () => {
    const onDelete = jest.fn()
    
    render(
      <ProjectCard 
        project={mockProject}
        onDelete={onDelete}
        onDownload={jest.fn()}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledWith('1')
  })
})
```

### Integration Testing

```typescript
// lib/__tests__/supabase-integration.test.ts
import { createClient } from '@supabase/supabase-js'
import { ProjectService } from '../services/project-service'

describe('ProjectService Integration', () => {
  let supabase: any
  
  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )
  })
  
  it('should create and retrieve a project', async () => {
    const projectData = {
      name: 'Integration Test Project',
      workflowJson: { nodes: [], connections: {} }
    }
    
    const created = await ProjectService.createProject(projectData)
    expect(created.id).toBeDefined()
    
    const retrieved = await ProjectService.getProject(created.id)
    expect(retrieved.name).toBe(projectData.name)
  })
})
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- workflow-parser.test.ts

# Run E2E tests
npm run test:e2e
```

## Debugging

### Development Tools

#### Browser DevTools
- **React DevTools**: Inspect React component tree
- **Network Tab**: Monitor API requests
- **Console**: View logs and errors
- **Application Tab**: Inspect localStorage and cookies

#### VS Code Debugging

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Next.js: debug client-side",
      "type": "pwa-chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

#### Logging

```typescript
// lib/utils/logger.ts
export class Logger {
  static info(message: string, data?: any) {
    console.log(`[INFO] ${message}`, data)
  }
  
  static error(message: string, error?: Error) {
    console.error(`[ERROR] ${message}`, error)
  }
  
  static debug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data)
    }
  }
}
```

### Common Issues

#### Supabase Connection Issues
```typescript
// Check Supabase connection
const { data, error } = await supabase
  .from('projects')
  .select('count')
  .single()

if (error) {
  console.error('Supabase connection failed:', error)
}
```

#### Authentication Problems
```typescript
// Debug auth state
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session)
})
```

## Performance Optimization

### Code Splitting

```typescript
// Dynamic imports for large components
const AnalyticsDashboard = dynamic(
  () => import('../components/analytics/analytics-dashboard'),
  { 
    loading: () => <div>Loading analytics...</div>,
    ssr: false 
  }
)
```

### Memoization

```typescript
// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return calculateComplexValue(data)
}, [data])

// Memoize callback functions
const handleClick = useCallback((id: string) => {
  onItemClick(id)
}, [onItemClick])
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_generation_logs_project_id ON generation_logs(project_id);
```

### Bundle Analysis

```bash
# Analyze bundle size
npm run build
npm run analyze
```

## Security Considerations

### Input Validation

```typescript
// Validate user inputs
import { z } from 'zod'

const ProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  workflowJson: z.object({
    nodes: z.array(z.any()),
    connections: z.record(z.any())
  })
})

export function validateProject(data: unknown) {
  return ProjectSchema.parse(data)
}
```

### Authentication Middleware

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  return res
}
```

### Environment Variables

```typescript
// lib/config/env.ts
import { z } from 'zod'

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  VIRUSTOTAL_API_KEY: z.string().optional()
})

export const env = EnvSchema.parse(process.env)
```

For more detailed information, see our [Security Documentation](./SECURITY.md) and [Deployment Guide](./DEPLOYMENT.md).
# VFH Development Workspace

This repository contains the complete development workspace for the VFH (Visual Flow Hub) project ecosystem, including the n8n Workflow Converter and related tools.

## 🚀 Projects

### n8n Workflow Converter
A comprehensive tool for converting n8n workflows into standalone, executable Node.js codebases.

**Location**: `n8n-workflow-converter/`

**Key Features**:
- Convert n8n JSON workflows to standalone Node.js projects
- AI-enhanced code generation with multiple provider support
- Real-time progress tracking and collaboration
- Comprehensive security and compliance features
- Performance optimization and analytics
- Full-text search and project management

## 📋 Project Documentation

- **[Product Requirements Document (PRD)](VFH%20PRD.md)** - Complete product specifications
- **[Functional Requirements Document (FRD)](VFH%20FRD%20.md)** - Detailed functional requirements
- **[Software Requirements Document (SRD)](Software%20Requirements%20Document%20(SRD))** - Technical specifications
- **[Best Practices](best-practices.md)** - Development guidelines and standards
- **[Project Documentation Rules](project-docs-rules.md)** - Documentation standards

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Supabase (PostgreSQL), Edge Functions
- **AI Integration**: OpenAI, Anthropic, Google Gemini, OpenRouter
- **Infrastructure**: Docker, GitHub Actions, Multiple deployment platforms
- **Testing**: Jest, Playwright, E2E testing suite

### Key Components
- **Workflow Parser**: Converts n8n JSON to executable code
- **AI Code Generator**: Enhanced code generation with multiple AI providers
- **Real-time Collaboration**: Live progress tracking and notifications
- **Security Layer**: Comprehensive security and compliance features
- **Analytics Engine**: Performance monitoring and usage analytics

## 🛠️ Development Setup

### Prerequisites
- Node.js 20+
- Docker (optional)
- Supabase CLI (for database management)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vfh-workspace
   ```

2. **Navigate to the main project**
   ```bash
   cd n8n-workflow-converter
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

## 📁 Directory Structure

```
vfh-workspace/
├── .kiro/                          # Kiro IDE configuration
├── n8n-workflow-converter/         # Main application
│   ├── src/                        # Source code
│   ├── supabase/                   # Database migrations & functions
│   ├── docs/                       # Project documentation
│   ├── scripts/                    # Utility scripts
│   └── deployment/                 # Deployment configurations
├── docs/                           # Workspace documentation
├── best-practices.md               # Development guidelines
├── VFH PRD.md                     # Product requirements
└── README.md                      # This file
```

## 🚀 Deployment

The project supports multiple deployment platforms:

- **Vercel** (Recommended for Next.js)
- **Railway** (Full-stack with database)
- **DigitalOcean App Platform**
- **AWS** (CloudFormation templates included)
- **Docker** (Self-hosted)

See the [deployment documentation](n8n-workflow-converter/docs/DEPLOYMENT.md) for detailed instructions.

## 🔒 Security & Compliance

- **GDPR Compliance**: Full data protection and privacy controls
- **Security Monitoring**: Comprehensive audit logging and threat detection
- **Session Management**: Secure user session handling
- **File Security**: Virus scanning and quarantine system
- **Rate Limiting**: API protection and abuse prevention

## 📊 Features

### Core Functionality
- ✅ n8n workflow JSON parsing and validation
- ✅ Standalone Node.js code generation
- ✅ Multiple AI provider integration
- ✅ Real-time progress tracking
- ✅ Project collaboration features
- ✅ File management and downloads

### Advanced Features
- ✅ Performance optimization and caching
- ✅ Full-text search capabilities
- ✅ Analytics and usage tracking
- ✅ Security and compliance tools
- ✅ Multi-platform deployment support
- ✅ Comprehensive testing suite

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# Security tests
npm run test:security
```

## 📈 Monitoring & Analytics

- **Performance Monitoring**: Real-time performance metrics
- **Error Tracking**: Comprehensive error logging and analysis
- **Usage Analytics**: User behavior and feature adoption tracking
- **System Health**: Infrastructure monitoring and alerting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](n8n-workflow-converter/LICENSE) file for details.

## 🆘 Support

- **Documentation**: [User Guide](n8n-workflow-converter/docs/USER-GUIDE.md)
- **API Reference**: [API Documentation](n8n-workflow-converter/docs/API-DOCUMENTATION.md)
- **Troubleshooting**: [Troubleshooting Guide](n8n-workflow-converter/docs/TROUBLESHOOTING.md)
- **Developer Guide**: [Developer Documentation](n8n-workflow-converter/docs/DEVELOPER-GUIDE.md)

## 🎯 Roadmap

- [ ] Enhanced AI model support
- [ ] Advanced workflow optimization
- [ ] Multi-language code generation
- [ ] Enterprise features and SSO
- [ ] Advanced analytics and reporting
- [ ] Mobile application support

---

**Built with ❤️ for the n8n community**
# Deployment Checklist

This checklist ensures all necessary steps are completed before deploying to production.

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests pass (unit, integration, e2e)
- [ ] Code coverage meets minimum threshold (80%+)
- [ ] ESLint and Prettier checks pass
- [ ] TypeScript compilation successful
- [ ] No console.log statements in production code
- [ ] All TODO/FIXME comments reviewed and addressed

### Security
- [ ] Security scan completed (npm audit, Snyk, CodeQL)
- [ ] No hardcoded secrets or API keys
- [ ] Environment variables properly configured
- [ ] HTTPS enforced in production
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] Input validation in place
- [ ] File upload security (VirusTotal integration)

### Performance
- [ ] Lighthouse audit scores meet thresholds
  - [ ] Performance: 80+
  - [ ] Accessibility: 90+
  - [ ] Best Practices: 90+
  - [ ] SEO: 80+
- [ ] Bundle size optimized
- [ ] Images optimized and compressed
- [ ] CDN configured (if applicable)
- [ ] Caching strategies implemented

### Database
- [ ] Database migrations tested
- [ ] Backup created before migration
- [ ] Migration rollback plan prepared
- [ ] Row Level Security (RLS) policies verified
- [ ] Database indexes optimized
- [ ] Connection pooling configured

### Infrastructure
- [ ] Production environment configured
- [ ] Environment variables set
- [ ] Monitoring and alerting configured
- [ ] Health checks implemented
- [ ] Log aggregation setup
- [ ] Error tracking configured (Sentry)
- [ ] Backup strategy in place

### Documentation
- [ ] README.md updated
- [ ] API documentation current
- [ ] Deployment guide updated
- [ ] User documentation complete
- [ ] License compliance verified
- [ ] Attribution requirements met

## Deployment Steps

### 1. Pre-Deployment Verification
```bash
# Run full test suite
npm run test:coverage
npm run test:e2e

# Security checks
npm run security:scan
npm run license-validate

# Build verification
npm run build:production

# Database migration dry run
npm run db:migrate:dry
```

### 2. Database Preparation
```bash
# Create backup
npm run db:backup production-$(date +%Y%m%d_%H%M%S)

# Check migration status
npm run db:status

# Apply migrations (if needed)
npm run db:migrate
```

### 3. Deployment Execution
```bash
# Deploy via GitHub Actions (recommended)
git push origin main

# Or manual deployment
npm run deploy:production
```

### 4. Post-Deployment Verification
```bash
# Health checks
curl -f https://n8n-converter.com/api/health
curl -f https://n8n-converter.com/api/health/database
curl -f https://n8n-converter.com/api/health/storage

# Smoke tests
npm run test:e2e -- --grep="smoke"

# Performance check
npm run lighthouse
```

## Post-Deployment Checklist

### Immediate (0-15 minutes)
- [ ] Application starts successfully
- [ ] Health checks pass
- [ ] Database connectivity verified
- [ ] External services accessible
- [ ] Authentication working
- [ ] File upload/download functional
- [ ] Critical user flows tested

### Short-term (15 minutes - 1 hour)
- [ ] Performance metrics within acceptable range
- [ ] Error rates normal
- [ ] Log aggregation working
- [ ] Monitoring alerts configured
- [ ] User feedback channels monitored
- [ ] Support team notified

### Medium-term (1-24 hours)
- [ ] Performance trends analyzed
- [ ] User adoption metrics reviewed
- [ ] Error patterns identified
- [ ] Capacity utilization monitored
- [ ] Backup verification completed

## Rollback Procedures

### Immediate Rollback (Critical Issues)
1. **Vercel Rollback**
   ```bash
   # Via Vercel CLI
   vercel rollback [deployment-url]
   
   # Via Vercel Dashboard
   # Navigate to deployments and promote previous version
   ```

2. **Database Rollback** (if needed)
   ```bash
   # Restore from backup
   npm run db:restore [backup-filename]
   
   # Or rollback to specific version
   npm run db:rollback [version]
   ```

### Gradual Rollback (Non-Critical Issues)
1. **Feature Flags**: Disable problematic features
2. **Traffic Routing**: Route traffic to previous version
3. **Monitoring**: Increase monitoring frequency

## Emergency Contacts

### Technical Team
- **Lead Developer**: [contact-info]
- **DevOps Engineer**: [contact-info]
- **Database Administrator**: [contact-info]

### External Services
- **Vercel Support**: [support-info]
- **Supabase Support**: [support-info]
- **CDN Provider**: [support-info]

## Deployment Environments

### Staging
- **URL**: https://staging-n8n-converter.vercel.app
- **Purpose**: Final testing before production
- **Auto-deploy**: On push to `develop` branch

### Production
- **URL**: https://n8n-converter.com
- **Purpose**: Live user-facing application
- **Deploy**: Manual approval required

## Monitoring and Alerting

### Key Metrics to Monitor
- **Response Time**: < 2 seconds average
- **Error Rate**: < 1% of requests
- **Uptime**: > 99.9%
- **Database Performance**: < 500ms query time
- **Memory Usage**: < 80% of available
- **CPU Usage**: < 70% average

### Alert Thresholds
- **Critical**: Response time > 5 seconds, Error rate > 5%
- **Warning**: Response time > 3 seconds, Error rate > 2%
- **Info**: Deployment completed, Backup created

### Alert Channels
- **Slack**: #alerts, #deployments
- **Email**: [team-email]
- **PagerDuty**: [escalation-policy]

## Compliance and Governance

### Security Compliance
- [ ] OWASP Top 10 vulnerabilities addressed
- [ ] Data encryption in transit and at rest
- [ ] Access controls implemented
- [ ] Audit logging enabled

### Privacy Compliance
- [ ] GDPR compliance verified
- [ ] Data retention policies implemented
- [ ] User consent mechanisms in place
- [ ] Data export/deletion capabilities available

### License Compliance
- [ ] All dependencies have compatible licenses
- [ ] Attribution requirements met
- [ ] License files included
- [ ] Third-party notices updated

## Success Criteria

### Technical Success
- [ ] All health checks pass
- [ ] Performance metrics within SLA
- [ ] No critical errors in logs
- [ ] All integrations functional

### Business Success
- [ ] User workflows complete successfully
- [ ] Conversion rates maintained or improved
- [ ] Support ticket volume normal
- [ ] User satisfaction scores stable

### Operational Success
- [ ] Monitoring and alerting functional
- [ ] Team can respond to issues
- [ ] Documentation up to date
- [ ] Runbooks tested and accessible

---

**Note**: This checklist should be reviewed and updated regularly to reflect changes in the application, infrastructure, and deployment processes.
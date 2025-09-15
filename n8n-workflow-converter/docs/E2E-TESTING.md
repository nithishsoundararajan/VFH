# End-to-End Testing Documentation

This document describes the comprehensive end-to-end testing suite for the n8n Workflow Converter application.

## Overview

The E2E testing suite covers four main areas:

1. **Complete User Workflows** - Full user journey from registration to download
2. **Collaborative Features** - Project sharing and multi-user scenarios
3. **Error Handling** - Error scenarios and recovery mechanisms
4. **Performance Testing** - Load testing and performance validation

## Test Structure

```
src/__tests__/e2e/
├── complete-workflow.test.ts    # Complete user workflow tests
├── collaboration.test.ts        # Collaboration and sharing tests
├── error-handling.test.ts       # Error scenarios and recovery tests
├── performance.test.ts          # Performance and load tests
├── test-runner.ts              # Test runner and reporting utilities
├── fixtures/
│   └── test-data.ts            # Test data and configurations
└── utils/
    └── test-helpers.ts         # Test helper functions and utilities
```

## Running Tests

### Individual Test Suites

```bash
# Run complete workflow tests
npm run test:e2e:complete

# Run collaboration tests
npm run test:e2e:collaboration

# Run error handling tests
npm run test:e2e:errors

# Run performance tests
npm run test:e2e:performance
```

### Comprehensive Test Execution

```bash
# Run all E2E tests with detailed reporting
npm run test:e2e:all

# Run tests across multiple environments
npm run test:e2e:cross-env

# Run tests with UI mode for debugging
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed
```

### Standard Playwright Commands

```bash
# Run all E2E tests
npm run test:e2e

# Generate and view test report
npx playwright show-report
```

## Test Categories

### 1. Complete User Workflow Tests

**File:** `complete-workflow.test.ts`

Tests the complete user journey including:
- User registration and authentication
- Workflow file upload and validation
- Project configuration
- Real-time code generation monitoring
- Project download and verification
- Dashboard navigation and project management
- Analytics tracking verification
- Performance requirement validation

**Key Test Cases:**
- Full workflow from registration to download
- Complex multi-node workflow processing
- Performance requirements compliance
- Analytics data collection verification

### 2. Collaborative Features Tests

**File:** `collaboration.test.ts`

Tests multi-user scenarios and sharing functionality:
- Project sharing with read/write permissions
- Real-time collaboration during code generation
- Permission management and access control
- Public sharing with tokens
- Concurrent project modifications
- Share revocation and access management

**Key Test Cases:**
- Share project with read permissions
- Share project with write permissions
- Real-time collaboration monitoring
- Permission management workflows
- Public sharing functionality
- Concurrent modification handling

### 3. Error Handling Tests

**File:** `error-handling.test.ts`

Tests error scenarios and recovery mechanisms:
- Malformed workflow JSON handling
- Network failure recovery
- Authentication session management
- File storage error handling
- Real-time connection failures
- Rate limiting and retry mechanisms
- Security threat detection
- Service timeout handling

**Key Test Cases:**
- Malformed workflow graceful handling
- Network failure recovery
- Code generation failure handling
- Authentication session expiry
- File storage failure recovery
- Real-time connection resilience
- Rate limiting compliance
- Malware detection response
- Service timeout recovery

### 4. Performance Tests

**File:** `performance.test.ts`

Tests application performance under various conditions:
- Page load performance validation
- Large file handling efficiency
- Concurrent user session management
- Memory usage optimization
- Real-time update performance
- Analytics rendering performance
- File download performance
- UI responsiveness during heavy operations

**Key Test Cases:**
- Page load performance requirements
- Large workflow file handling
- Concurrent user sessions
- Memory usage during long sessions
- Real-time updates with multiple projects
- Analytics performance with large datasets
- Concurrent file download performance
- UI responsiveness under load

## Test Data and Fixtures

### Test Users

The test suite uses dynamically generated test users to avoid conflicts:

```typescript
const TEST_USERS = {
  primary: {
    email: `test-primary-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    fullName: 'Primary Test User'
  },
  secondary: {
    email: `test-secondary-${Date.now()}@example.com`,
    password: 'TestPassword456!',
    fullName: 'Secondary Test User'
  }
};
```

### Sample Workflows

- **Simple Workflow**: Basic HTTP request workflow for quick testing
- **Complex Workflow**: Multi-node workflow with various node types
- **Malformed Workflow**: Invalid workflow for error testing

### Performance Thresholds

```typescript
const PERFORMANCE_THRESHOLDS = {
  pageLoad: 3000,        // 3 seconds
  workflowUpload: 5000,  // 5 seconds
  codeGeneration: 30000, // 30 seconds
  fileDownload: 10000    // 10 seconds
};
```

## Test Helpers

The `TestHelpers` class provides reusable methods for common test operations:

- `registerUser()` - Register new test user
- `loginUser()` - Login with test credentials
- `uploadWorkflow()` - Upload workflow JSON file
- `configureProject()` - Configure project settings
- `startCodeGeneration()` - Initiate code generation
- `waitForGenerationComplete()` - Wait for generation completion
- `downloadProject()` - Download generated project
- `shareProject()` - Share project with other users
- `verifyRealTimeUpdates()` - Verify real-time functionality
- `measurePerformance()` - Measure operation performance
- `cleanup()` - Clean up test data

## Environment Configuration

### Test Environment Variables

```bash
# Base URL for testing (default: http://localhost:3000)
TEST_BASE_URL=http://localhost:3000

# Staging environment URL
STAGING_URL=https://staging.example.com

# Production environment URL (for smoke tests)
PRODUCTION_URL=https://app.example.com

# Supabase test configuration
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
```

### Browser Configuration

The tests run on multiple browsers and devices:
- Desktop Chrome, Firefox, Safari
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

## Continuous Integration

### GitHub Actions Integration

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e:all
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Reporting

### Automated Reports

The test runner generates comprehensive reports including:
- Test execution summary
- Performance metrics
- Error details and stack traces
- Environment information
- Success/failure rates

### Report Locations

- **HTML Report**: `playwright-report/index.html`
- **JSON Report**: `test-results/e2e-report.json`
- **Screenshots**: `test-results/screenshots/`
- **Videos**: `test-results/videos/`

## Debugging Tests

### Local Debugging

```bash
# Run tests with visible browser
npm run test:e2e:headed

# Run tests with Playwright UI
npm run test:e2e:ui

# Run specific test file with debug mode
npx playwright test src/__tests__/e2e/complete-workflow.test.ts --debug
```

### Debug Configuration

```typescript
// Enable debug mode in test
test.use({
  trace: 'on',
  screenshot: 'on',
  video: 'on'
});
```

## Best Practices

### Test Isolation

- Each test creates unique user accounts
- Tests clean up their own data
- No shared state between tests
- Independent test execution

### Error Handling

- Comprehensive error scenarios coverage
- Graceful failure handling
- Retry mechanisms for flaky operations
- Clear error reporting

### Performance

- Performance thresholds validation
- Load testing with concurrent users
- Memory usage monitoring
- Real-time update efficiency

### Maintenance

- Regular test data cleanup
- Dynamic test data generation
- Environment-specific configurations
- Comprehensive documentation

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout values for slow operations
2. **Flaky Tests**: Add proper wait conditions and retry logic
3. **Authentication Issues**: Verify test user credentials and session management
4. **Performance Failures**: Check system resources and network conditions

### Debug Commands

```bash
# Check Playwright installation
npx playwright --version

# Install browsers
npx playwright install

# Run tests with verbose output
npx playwright test --reporter=line

# Generate trace files
npx playwright test --trace=on
```

## Requirements Coverage

This E2E testing suite fulfills **Requirement 15.5** by providing:

✅ **Complete User Workflow Testing**
- Registration to download journey
- Multi-step workflow validation
- Real-time progress monitoring

✅ **Collaborative Features Testing**
- Project sharing functionality
- Multi-user scenarios
- Permission management

✅ **Error Scenario Testing**
- Comprehensive error handling
- Recovery mechanism validation
- Resilience testing

✅ **Performance and Load Testing**
- Performance threshold validation
- Concurrent user testing
- Resource usage monitoring

The test suite ensures the application meets all functional and non-functional requirements while providing comprehensive coverage of user scenarios and edge cases.
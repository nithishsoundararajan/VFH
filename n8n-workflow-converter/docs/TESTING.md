# Testing Guide

This document explains how to run tests for the n8n Workflow Converter project.

## Setup

The project uses Jest as the testing framework with React Testing Library for component testing.

### Dependencies

The following testing dependencies are installed:

```json
{
  "devDependencies": {
    "jest": "^30.1.2",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.5.2",
    "jest-environment-jsdom": "^30.1.2",
    "@types/jest": "^29.5.14"
  }
}
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test File
```bash
npm test -- src/lib/validation/__tests__/configuration.test.ts
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Structure

### Unit Tests
- **Configuration Validation**: `src/lib/validation/__tests__/configuration.test.ts`
  - Tests input sanitization
  - Tests validation rules
  - Tests error handling

### Component Tests
- **Workflow Configuration**: `src/components/dashboard/__tests__/workflow-configuration.test.tsx`
  - Tests form rendering
  - Tests user interactions
  - Tests validation feedback

## Configuration

### Jest Configuration
The project uses Next.js Jest configuration with custom settings:

```javascript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

### Test Setup
Global test setup is configured in `jest.setup.js`:

```javascript
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      // ... other router methods
    }
  },
  // ... other navigation hooks
}))
```

## Writing Tests

### Example Unit Test
```typescript
import { ConfigurationValidator } from '../configuration';

describe('ConfigurationValidator', () => {
  it('should sanitize project name', () => {
    const result = ConfigurationValidator.sanitizeProjectName('Test@Project!');
    expect(result).toBe('testproject');
  });
});
```

### Example Component Test
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowConfiguration } from '../workflow-configuration';

describe('WorkflowConfiguration', () => {
  it('should render form', () => {
    render(<WorkflowConfiguration {...props} />);
    expect(screen.getByText('Configure Project')).toBeInTheDocument();
  });
});
```

## Best Practices

### Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names that explain the expected behavior
- Follow the Arrange-Act-Assert pattern

### Mocking
- Mock external dependencies (APIs, libraries)
- Use Jest's built-in mocking capabilities
- Keep mocks simple and focused

### Assertions
- Use specific assertions that clearly express expectations
- Prefer semantic queries (`getByRole`, `getByLabelText`) over generic ones
- Test user-visible behavior, not implementation details

## Troubleshooting

### Common Issues

#### Module Resolution
If you encounter module resolution errors, ensure:
- The `moduleNameMapper` in Jest config is correct
- Import paths use the `@/` alias consistently
- Dependencies are properly installed

#### Component Testing
For component testing issues:
- Ensure all UI components are properly mocked
- Check that React Testing Library is correctly set up
- Verify that the test environment is `jsdom`

#### TypeScript Errors
For TypeScript-related test errors:
- Ensure `@types/jest` is installed
- Check that test files have proper TypeScript configuration
- Verify that Jest can handle TypeScript files

## Coverage

The project aims for high test coverage, especially for:
- Critical business logic (validation, sanitization)
- User-facing components
- API endpoints
- Error handling

Coverage reports are generated in the `coverage/` directory and include:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage
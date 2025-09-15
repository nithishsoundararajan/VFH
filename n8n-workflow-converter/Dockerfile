# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Install dependencies only when needed
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci && npm cache clean --force

# Development stage
FROM base AS development

# Install additional development tools
RUN apk add --no-cache \
    git \
    openssh-client \
    && rm -rf /var/cache/apk/*

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Create non-root user for development
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Create directories with proper permissions
RUN mkdir -p /app/logs /app/storage /app/backups && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose ports (3000 for app, 9229 for debugger)
EXPOSE 3000 9229

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start development server with debugger
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build application
RUN npm run build

# Production dependencies stage
FROM base AS prod-deps

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Production image
FROM base AS production

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy additional files needed for production
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json

# Create directories for logs, storage, and backups
RUN mkdir -p /app/logs /app/storage /app/backups && \
    chown -R nextjs:nodejs /app/logs /app/storage /app/backups

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]

# Default target is production
FROM production
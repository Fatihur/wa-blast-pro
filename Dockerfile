# Multi-stage build for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy frontend package files
COPY package*.json ./
RUN npm ci --only=production

# Copy frontend source
COPY . .

# Build frontend
RUN npm run build

# Multi-stage build for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app

# Copy backend package files
COPY server/package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY server/ .

# Build backend
RUN npm run build

# Final production image
FROM node:20-alpine
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy backend built files and dependencies
COPY --from=backend-builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/package.json ./

# Copy frontend built files
COPY --from=frontend-builder --chown=nodejs:nodejs /app/dist ./public

# Create necessary directories
RUN mkdir -p logs uploads wa-session && \
    chown -R nodejs:nodejs logs uploads wa-session

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]

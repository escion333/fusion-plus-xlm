FROM node:18-alpine

WORKDIR /app

# Copy package files from root
COPY package*.json ./
COPY tsconfig.resolver.json ./tsconfig.json

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npx tsc -p tsconfig.json

# Expose port
EXPOSE 3001

# Start the service
CMD ["node", "dist/services/resolver/index.js"]
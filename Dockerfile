# Cloud Run automatically detects and uses this Dockerfile
# It delegates to docker/server.Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN npm install --production --prefix server

# Install additional dependencies if needed
WORKDIR /app/server
RUN npm install --production

# Expose port
EXPOSE 5003

# Start server
CMD ["node", "server.js"]

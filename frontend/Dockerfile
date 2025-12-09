# Frontend Dockerfile - Development with hot-reload
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source files
COPY . .

# Expose Vite dev server port
EXPOSE 3000

# Start development server with hot-reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


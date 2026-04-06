FROM node:20-alpine

WORKDIR /app

# Install root dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install client dependencies
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm ci

# Copy source code
COPY . .

# Build client
RUN cd client && npm run build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/index.js"]

# Single image that runs both the API (Express + ws) and the Vite dev server.
# Node 20 so we have a modern toolchain; build tools are needed to compile the
# better-sqlite3 native addon.
FROM node:20-bookworm-slim

WORKDIR /app

# Native build deps for better-sqlite3.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching). Workspace manifests must be
# present for npm to resolve the workspaces.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install

# App source (mounted over in dev via docker-compose, baked in otherwise).
COPY . .

# 4100 = API + WebSocket, 5180 = Vite UI
EXPOSE 4100 5180

CMD ["npm", "run", "dev"]

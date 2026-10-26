FROM node:22-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* variables are inlined into the client bundle at build time,
# not read at container runtime: pass the production API origin/prefix via
# --build-arg, or the dev defaults baked into src/lib/api.ts apply instead.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_PREFIX
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_API_PREFIX=${NEXT_PUBLIC_API_PREFIX}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3001
CMD ["node", "server.js"]

# VeriVision frontend — Next.js. Not strictly needed if you deploy this on
# Vercel (it builds Next.js natively, no Dockerfile required there); this
# is for self-hosting the frontend on the same host as the backend, e.g.
# via docker-compose. See ../DEPLOYMENT.md.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked in at build time: Next.js inlines NEXT_PUBLIC_* vars into the
# client bundle, so this must be the backend's real public URL by the
# time `next build` runs — passed in via docker-compose or --build-arg.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]

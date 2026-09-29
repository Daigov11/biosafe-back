# Build desde la raíz del repo: docker build -f backend/Dockerfile .
FROM node:22-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY backend/package*.json backend/
RUN cd backend && npm install

FROM deps AS build
COPY prisma ./prisma
COPY backend ./backend
RUN cd backend && npm run prisma:generate
RUN cd backend && npm run build

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/backend/package*.json ./backend/
COPY --from=build /repo/backend/node_modules ./backend/node_modules
COPY --from=build /repo/backend/dist ./backend/dist
COPY --from=build /repo/backend/generated ./backend/generated
COPY --from=build /repo/prisma ./prisma

WORKDIR /repo/backend
EXPOSE 4100
CMD ["sh", "-c", "npm run prisma:deploy && npm run start"]

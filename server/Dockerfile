# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY migrations ./migrations
COPY data ./data
COPY src ./src
COPY tsconfig.json ./

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "start"]

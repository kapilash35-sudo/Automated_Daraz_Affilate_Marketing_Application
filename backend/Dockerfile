FROM node:22-alpine AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache openssl

# Install npm packages
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src/

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]


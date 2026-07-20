# Build Stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copiar manifests de dependências
COPY package.json bun.lock tsconfig.json ./

# Instalar dependências
RUN bun install --frozen-lockfile

# Copiar código-fonte e prompts
COPY src ./src
COPY prompts ./prompts

# Production Stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3020

# Copiar dependências e código do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3020

# Executar a aplicação com Bun
CMD ["bun", "run", "src/index.ts"]

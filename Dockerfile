FROM oven/bun:1.3.14-alpine AS builder

WORKDIR /app

COPY package.json bun.lock .
COPY patches patches
COPY example/package.json example/package.json
COPY library/package.json library/package.json

# https://github.com/oven-sh/bun/issues/4938
RUN echo 'net.ipv6.conf.all.disable_ipv6 = 1' >> /etc/sysctl.conf || true

RUN bun i

COPY . .

RUN bun run build

# Production stage

FROM verekia/nginx-brotli:1.30.0

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/example/out /usr/share/nginx/html

EXPOSE 80

FROM node:24-alpine

WORKDIR /app

RUN npm init -y && npm install hono @hono/node-server pg tsx

COPY app.ts server.ts ./

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]

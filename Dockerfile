FROM node:22.16.0-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
ENV PORT=3000 NODE_ENV=production DB_PATH=/app/data/unitask.sqlite
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]

FROM node:22.14.0-alpine3.21
WORKDIR /app
COPY --chown=node:node apps/storage/package.json ./package.json
COPY --chown=node:node apps/storage/server ./server
COPY --chown=node:node apps/storage/web ./web
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=8174 STORAGE_ROOT=/data STORAGE_CONFIG=/config/config.json NODE_ENV=production
EXPOSE 8174
CMD ["node", "server/main.mjs"]

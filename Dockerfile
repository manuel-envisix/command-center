FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY app/package.json app/
COPY push/package.json push/
RUN npm ci
COPY app ./app
RUN npm run build -w app

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
COPY package.json package-lock.json ./
COPY app/package.json app/
RUN npm ci -w app --omit=dev
COPY app/server ./app/server
COPY --from=build /app/app/dist ./app/dist
EXPOSE 3000
VOLUME ["/data"]
CMD ["npm", "run", "start:prod", "-w", "app"]

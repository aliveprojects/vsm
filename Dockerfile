FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm install
COPY . .
RUN npm run build -w frontend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json package-lock.json* ./
COPY backend ./backend
COPY frontend/package.json frontend/
COPY --from=build /app/frontend/dist ./frontend/dist
RUN npm install --omit=dev -w backend
EXPOSE 8787
CMD ["npm", "start", "-w", "backend"]

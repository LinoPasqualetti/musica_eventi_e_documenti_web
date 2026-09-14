FROM node:20-slim

WORKDIR /app

# ---- BACKEND ----
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./

# ---- FRONTEND (build già pronta) ----
WORKDIR /app/frontend
COPY frontend/dist/ ./dist/

# ---- AVVIO ----
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "src/index.js"]

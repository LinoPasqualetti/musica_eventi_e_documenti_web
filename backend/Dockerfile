FROM node:20-slim

WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze di produzione
RUN npm ci --omit=dev

# Copia il resto del codice
COPY . .

# Esponi la porta
EXPOSE 3000

# Avvia l'app
CMD ["node", "src/index.js"]

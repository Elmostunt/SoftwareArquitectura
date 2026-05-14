# ── Etapa 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos primero para aprovechar caché de capas
COPY package*.json ./
RUN npm install

# Copiar código fuente y compilar
COPY . .
RUN npm run build

# ── Etapa 2: Producción con Nginx ────────────────────────────────
FROM nginx:1.27-alpine AS production

# Copiar archivos estáticos generados
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de Nginx para SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run usa el puerto 8080 por convención
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

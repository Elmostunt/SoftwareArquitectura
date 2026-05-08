# ── Etapa 1: Compilar el proyecto React ──────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copia solo los archivos de dependencias primero (optimiza caché de Docker)
COPY package.json ./
RUN npm install

# Copia el resto del código fuente y compila
COPY . .
RUN npm run build

# ── Etapa 2: Servir los archivos estáticos con Nginx ─────────
FROM nginx:alpine

# Copia el resultado del build al directorio de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run enruta el tráfico al puerto 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

# ── Etapa 1: Compilar el proyecto React ──────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# VITE_API_URL siempre es /api — nginx hace el proxy al ALB
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Etapa 2: Servir los archivos estáticos con Nginx ─────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Reemplaza el placeholder con la URL real del ALB en nginx.conf
ARG API_PROXY_URL=http://localhost:8000
RUN sed -i "s|PLACEHOLDER_API_URL|${API_PROXY_URL}|g" /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

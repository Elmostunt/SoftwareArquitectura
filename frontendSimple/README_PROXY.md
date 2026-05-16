# Solución Mixed Content — Proxy Nginx hacia el ALB de AWS

## El problema

Cloud Run sirve el frontend con **HTTPS** (obligatorio).
El Load Balancer de AWS expone el backend con **HTTP**.

Cuando el browser intenta hacer `fetch("http://alb-dns/avistamientos")` desde una
página HTTPS, el navegador lo bloquea directamente:

```
Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested
an insecure resource 'http://...'. This request has been blocked.
```

Esto ocurre en todos los navegadores modernos sin excepción.

---

## La solución: Nginx como proxy inverso

En lugar de que el browser llame directo al ALB, nginx recibe la petición
dentro del contenedor y la reenvía al ALB de servidor a servidor.

```
Browser → HTTPS → Cloud Run (nginx) → HTTP → ALB → EC2 FastAPI
```

El browser solo habla HTTPS con Cloud Run. El salto HTTP ocurre dentro de la
infraestructura, donde el navegador no interviene.

---

## Cambios realizados

### 1. `nginx.conf` — bloque proxy

Se agregó un `location /api/` que reenvía al ALB.
El placeholder `PLACEHOLDER_API_URL` se reemplaza con la URL real durante el build.

```nginx
location /api/ {
    proxy_pass PLACEHOLDER_API_URL/;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

El `/` al final de `proxy_pass` hace que nginx elimine el prefijo `/api/` antes
de reenviar, es decir:
- Browser llama: `https://cloud-run/api/avistamientos`
- Nginx reenvía: `http://alb-dns/avistamientos`

### 2. `Dockerfile` — reemplazo del placeholder

La URL del ALB se inyecta en `nginx.conf` en tiempo de build usando `sed`:

```dockerfile
ARG API_PROXY_URL=http://localhost:8000
RUN sed -i "s|PLACEHOLDER_API_URL|${API_PROXY_URL}|g" /etc/nginx/conf.d/default.conf
```

`VITE_API_URL` queda fijo en `/api` — el frontend siempre llama a rutas relativas
y nginx resuelve a dónde van.

```dockerfile
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
```

### 3. `cloudbuild.yaml` — nueva sustitución

Se reemplazó `_VITE_API_URL` por `_API_PROXY_URL`:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'API_PROXY_URL=$_API_PROXY_URL'
      - '--tag'
      - '$_IMAGE'
      - '.'
substitutions:
  _API_PROXY_URL: 'http://LOAD_BALANCER_DNS_AQUI'
  _IMAGE: 'us-central1-docker.pkg.dev/PROJECT_ID/ovnis-repo/ovnis-frontend'
```

---

## Cómo hacer el build y deploy

```bash
export PROJECT_ID=$(gcloud config get-value project)
export ALB_DNS="http://<DNS-del-Load-Balancer>"
```

**Build:**
```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_API_PROXY_URL="$ALB_DNS",_IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend" \
  .
```

**Deploy:**
```bash
gcloud run deploy ovnis-frontend \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Verificar que el proxy funciona

Desde el browser, abre las DevTools (F12) → pestaña Network.
Las peticiones al backend deben aparecer como:

```
Request URL: https://<cloud-run-url>/api/avistamientos
Status: 200
```

Si ves la URL del ALB directamente en el Request URL, el build no tomó los cambios
— verifica que hiciste `git pull` antes del build.

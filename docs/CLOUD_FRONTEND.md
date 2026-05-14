# Opción B — Frontend React en GCP Compute Engine con Nginx

## Arquitectura de esta guía

```
Internet
   │
   ▼  puerto 80
┌────────────────────────────────────┐
│         Google Cloud (GCP)         │
│                                    │
│  ┌──────────────────────────┐      │
│  │  VM Compute Engine       │      │
│  │  Ubuntu 22.04            │      │
│  │  Nginx :80               │      │
│  │  React (dist/)           │      │
│  └──────────────────────────┘      │
└────────────────────────────────────┘
         │ API calls (HTTP)
         ▼
┌─────────────────────────────┐
│         AWS                 │
│  ALB :80 → EC2 :8000        │
│  FastAPI + RDS MySQL        │
└─────────────────────────────┘
```

> El frontend es un build estático (HTML + JS + CSS) servido con **Nginx**.
> Las llamadas a la API viajan desde el navegador del usuario hacia el **ALB de AWS** (puerto 80).
> El frontend lee la URL del backend desde la variable de entorno `VITE_API_URL`.

---

## Requisitos previos

- Haber completado el backend en AWS (ver [AWS_AMAZONLINUX_ALB.md](AWS_AMAZONLINUX_ALB.md))
- Tener el **DNS del Load Balancer** de AWS (ej: `ovnis-alb-xxx.us-east-1.elb.amazonaws.com`)
- Acceso al proyecto GCP del profesor

---

## Paso 1 — Crear la VM en GCP Compute Engine

1. GCP Console → **Compute Engine → VM instances → Create Instance**
2. Configurar:

| Campo        | Valor                                      |
|--------------|--------------------------------------------|
| Name         | `ovnis-react-tunombre`                     |
| Region       | `us-central1`                              |
| Machine type | `e2-micro`                                 |
| Boot disk    | Ubuntu 22.04 LTS                           |
| Firewall     | ✅ Allow HTTP traffic                      |

3. Clic en **Create** y esperar ~1 minuto
4. Anotar la **External IP** de la VM

---

## Paso 2 — Conectarse a la VM

Desde la consola GCP, clic en el botón **SSH** junto a tu VM.

O desde tu terminal con `gcloud`:
```bash
gcloud compute ssh ovnis-react-tunombre --zone=us-central1-a
```

---

## Paso 3 — Instalar Node.js y Nginx

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verificar versiones
node --version    # debe ser v20.x
npm --version
```

---

## Paso 4 — Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd SoftwareArquitectura/frontendSimple
```

---

## Paso 5 — Configurar la URL del backend ⚠️ PASO CRÍTICO

```bash
cp .env.example .env.local
nano .env.local
```

Reemplazar el placeholder con el **DNS del Load Balancer de AWS**:
```
VITE_API_URL=http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com
```

> El DNS del ALB lo encuentras en: **AWS Console → EC2 → Load Balancers → ovnis-alb → DNS name**
> No uses la IP del EC2 directamente. El ALB es el punto de entrada al backend.

Guardar: `Ctrl+O`, Enter, `Ctrl+X`

---

## Paso 6 — Instalar dependencias y compilar

```bash
npm install
npm run build
```

> `npm run build` genera la carpeta `dist/` con el sitio estático.
> Vite bake dentro del JS la URL del backend definida en `.env.local`.

---

## Paso 7 — Copiar el build a Nginx

```bash
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
```

---

## Paso 8 — Configurar Nginx para React Router

```bash
sudo nano /etc/nginx/sites-available/default
```

Reemplazar el bloque `location /` con:
```nginx
server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|svg|ico)$ {
        expires 1d;
        add_header Cache-Control "public";
    }
}
```

Aplicar:
```bash
sudo nginx -t          # verificar sintaxis
sudo systemctl reload nginx
```

---

## Paso 9 — Verificar en el navegador

```
http://<EXTERNAL_IP_DE_TU_VM>
```

Deberías ver la tabla de avistamientos de OVNIs cargada desde AWS.
Si ves un error "Error al conectar con la API", revisa que `VITE_API_URL` está correctamente configurado y que el ALB responde.

```bash
# Verificar desde la VM que el backend es alcanzable
curl http://ovnis-alb-xxx.us-east-1.elb.amazonaws.com/health
# Esperado: {"status":"ok"}
```

---

## Actualizar tras cambios en el código

Si modificas el código fuente, debes recompilar y volver a copiar:

```bash
cd ~/SoftwareArquitectura/frontendSimple
npm run build
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
```

---

## Tabla de puertos necesarios

| Componente         | Puerto | Acceso desde          | Motivo                          |
|--------------------|--------|-----------------------|---------------------------------|
| VM Nginx           | 80     | Internet (0.0.0.0/0)  | El usuario accede al frontend   |
| ALB de AWS         | 80     | Internet (0.0.0.0/0)  | El navegador llama al backend   |
| EC2 FastAPI        | 8000   | Solo desde ALB        | El ALB enruta el tráfico        |
| RDS MySQL          | 3306   | Solo desde EC2        | Base de datos privada           |

---

## Solución de problemas

| Problema | Causa probable | Solución |
|----------|----------------|----------|
| `Error al conectar con la API` | URL del ALB incorrecta en `.env.local` | Verificar `VITE_API_URL` y reconstruir con `npm run build` |
| `Failed to fetch` | CORS bloqueado o URL incorrecta | Verificar que el backend tiene `allow_origins=["*"]` |
| Tabla vacía sin error | Backend sin datos | Cargar `seed.sql` en la RDS |
| Sitio no carga | Nginx caído o build no copiado | `sudo systemctl status nginx`, revisar `/var/www/html/` |
| `404` en rutas directas | Nginx sin `try_files` | Verificar configuración del Paso 8 |

---

## Comandos de diagnóstico rápido

```bash
# Estado de Nginx
sudo systemctl status nginx

# Logs de Nginx en tiempo real
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Verificar que Nginx escucha en puerto 80
ss -tlnp | grep 80

# Verificar conectividad al backend desde la VM
curl http://<DNS_ALB>/health
```

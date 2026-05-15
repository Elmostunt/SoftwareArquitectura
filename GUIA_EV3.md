# Evaluación 3 — Arquitectura Multicloud: AWS + GCP
### Sistema de Avistamiento de OVNIs

---

## Visión general de la arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                          INTERNET                                   │
└───────────────┬─────────────────────────────┬───────────────────────┘
                │ HTTPS                        │ HTTP
                ▼                              ▼
┌───────────────────────────┐    ┌─────────────────────────────────┐
│     GOOGLE CLOUD (GCP)    │    │         AMAZON WEB SERVICES     │
│                           │    │                                 │
│  ┌─────────────────────┐  │    │  ┌───────────────────────────┐  │
│  │    Cloud Run        │  │    │  │  Application Load Balancer│  │
│  │  ovnis-frontend     │  │    │  │  ovnis-alb  :80           │  │
│  │  nginx :8080        │  │    │  └─────────────┬─────────────┘  │
│  │                     │  │    │                │ :8000           │
│  │  /api/* ────────────┼──┼────┼────────────────▼                │
│  │  (proxy inverso)    │  │    │  ┌─────────────────────────────┐│
│  └─────────────────────┘  │    │  │  EC2 Amazon Linux 2023      ││
│   Imagen en:              │    │  │  FastAPI + uvicorn :8000    ││
│   Artifact Registry       │    │  └─────────────┬───────────────┘│
│                           │    │                │ :3306           │
└───────────────────────────┘    │  ┌─────────────▼───────────────┐│
                                 │  │  RDS MySQL (privado)        ││
                                 │  │  ovnis_db                   ││
                                 │  └─────────────────────────────┘│
                                 └─────────────────────────────────┘
```

**Flujo de una petición completa:**
```
Browser → HTTPS → Cloud Run (nginx) → HTTP → ALB → EC2 (FastAPI) → RDS (MySQL)
```

> El proxy nginx en Cloud Run resuelve el problema de Mixed Content:
> el browser solo habla HTTPS con GCP; el salto HTTP al ALB ocurre servidor a servidor.

---

## PARTE 1 — AWS: Base de datos RDS

> Documentación detallada: `docs/AWS_AMAZONLINUX_ALB.md` — Parte 1 y 2

### Diagrama de Security Groups (crear ANTES que los recursos)

```
Internet
   │
   ▼ :80
┌──────────────────────────────────────────────────────────┐
│  ovnis-sg-alb                                            │
│  Inbound:  HTTP 80  desde 0.0.0.0/0                      │
│  Outbound: todo                                          │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼ :8000 (solo desde ovnis-sg-alb)
┌──────────────────────────────────────────────────────────┐
│  ovnis-sg-ec2                                            │
│  Inbound:  SSH  22    desde tu IP                        │
│  Inbound:  TCP  8000  desde SG-ID de ovnis-sg-alb        │
│  Outbound: todo                                          │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼ :3306 (solo desde ovnis-sg-ec2)
┌──────────────────────────────────────────────────────────┐
│  ovnis-sg-rds                                            │
│  Inbound:  MySQL 3306  desde SG-ID de ovnis-sg-ec2       │
└──────────────────────────────────────────────────────────┘
```

### Paso 1.1 — Crear los 3 Security Groups

Ir a: **EC2 → Security Groups → Create security group**

**SG-1: `ovnis-sg-alb`**

| Dirección | Tipo | Puerto | Origen |
|-----------|------|--------|--------|
| Inbound | HTTP | 80 | `0.0.0.0/0` |
| Outbound | All | All | `0.0.0.0/0` |

**SG-2: `ovnis-sg-ec2`**

| Dirección | Tipo | Puerto | Origen |
|-----------|------|--------|--------|
| Inbound | SSH | 22 | My IP |
| Inbound | Custom TCP | 8000 | SG-ID de `ovnis-sg-alb` |
| Outbound | All | All | `0.0.0.0/0` |

**SG-3: `ovnis-sg-rds`**

| Dirección | Tipo | Puerto | Origen |
|-----------|------|--------|--------|
| Inbound | MySQL/Aurora | 3306 | SG-ID de `ovnis-sg-ec2` |

### Paso 1.2 — Crear instancia RDS MySQL

Ir a: **RDS → Create database**

| Campo | Valor |
|-------|-------|
| Engine | MySQL 8.0 |
| Template | **Free tier** |
| DB instance identifier | `ovnis-db` |
| Master username | `admin` |
| Master password | (elige una contraseña segura, anótala) |
| Instance class | `db.t3.micro` |
| Storage | 20 GB gp2 |
| VPC | Default VPC |
| Public access | **No** |
| VPC security groups | `ovnis-sg-rds` |

En **Additional configuration → Initial database name**: escribir `ovnis_db`

Clic **Create database** — tarda ~5 minutos.

### Paso 1.3 — Anotar el Endpoint

Una vez creada la instancia, copiar el **Endpoint**:
```
ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
```
Lo necesitarás en el script de la EC2.

---

## PARTE 2 — AWS: Instancia EC2 con el backend

> Documentación detallada: `docs/AWS_AMAZONLINUX_ALB.md` — Parte 3 y 4
> Script de instalación automática/manual : `backend/userdata.sh`

### Paso 2.1 — Lanzar la instancia EC2

Ir a: **EC2 → Launch instances**

| Campo | Valor |
|-------|-------|
| Name | `ovnis-backend` |
| AMI | **Amazon Linux 2023 AMI** (HVM, 64-bit x86) |
| Instance type | `t2.micro` (Free Tier) |
| Key pair | Crear nuevo o usar existente (.pem) |
| VPC | Default VPC (mismo que RDS) |
| Subnet | Cualquier subnet pública |
| Auto-assign Public IP | **Enable** |
| Security group | `ovnis-sg-ec2` |

### Paso 2.2 — Pegar el User Data (instalación automática)

Antes de lanzar, expandir **Advanced details → User data**.

Abrir `backend/userdata.sh`, completar los 3 valores en la sección CONFIGURACIÓN:

```bash
REPO_URL="https://github.com/TU_USUARIO/TU_REPO.git"
DB_HOST="ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com"   # endpoint RDS
DB_PASSWORD="TuContraseñaSegura"
```

Pegar el script completo en el campo User data y clic **Launch instance**.

El script realiza automáticamente:
```
[1/6] Instala Python, git, cliente MySQL
[2/6] Clona el repositorio
[3/6] Crea entorno virtual e instala dependencias Python
[4/6] Genera el archivo .env con las credenciales RDS
[5/6] Carga schema.sql y seed.sql en RDS (14 registros)
[6/6] Configura y arranca el servicio systemd ovnis-api
```

### Paso 2.3 — Conectarse a la EC2 por SSH

```bash
chmod 400 tu-clave.pem
ssh -i tu-clave.pem ec2-user@<IP_PUBLICA_EC2>
```

> En Amazon Linux el usuario es `ec2-user`, no `ubuntu`.

### Paso 2.4 — Verificar el log de instalación

```bash
cat /tmp/userdata-ovnis.log
```

Al final del log debe aparecer:
```
================================================================
 Instalación completada: ...
 API disponible en: http://<IP>:8000
================================================================
```

### Paso 2.5 — Verificar que el servicio está corriendo

```bash
sudo systemctl status ovnis-api
```

Resultado esperado:
```
● ovnis-api.service - OVNIs FastAPI Backend
   Active: active (running) ...
```

Si el servicio falló, revisar el error:
```bash
sudo journalctl -u ovnis-api -n 50 --no-pager
```

---

## PARTE 3 — AWS: Target Group y Load Balancer

> Documentación detallada: `docs/AWS_AMAZONLINUX_ALB.md` — Parte 5

### Flujo de tráfico con el ALB

```
Internet :80
     │
     ▼
┌────────────┐    listener     ┌──────────────┐    forward     ┌──────────────┐
│    ALB     │ ─── HTTP:80 ──► │  Target Group│ ──── :8000 ──► │   EC2        │
│  ovnis-alb │                 │   ovnis-tg   │                │ ovnis-backend│
└────────────┘                 └──────────────┘                └──────────────┘
                                     │
                               health check
                               GET /health → 200 OK
```

### Paso 3.1 — Crear el Target Group

Ir a: **EC2 → Target Groups → Create target group**

| Campo | Valor |
|-------|-------|
| Target type | **Instances** |
| Name | `ovnis-tg` |
| Protocol | HTTP |
| Port | **8000** |
| VPC | Default VPC |
| Health check protocol | HTTP |
| Health check path | `/health` |

Clic **Next** → en **Register targets** seleccionar el EC2 `ovnis-backend` → **Include as pending below** → **Create target group**.

### Paso 3.2 — Crear el Application Load Balancer

Ir a: **EC2 → Load Balancers → Create load balancer → Application Load Balancer**

| Campo | Valor |
|-------|-------|
| Name | `ovnis-alb` |
| Scheme | **Internet-facing** |
| IP address type | IPv4 |
| VPC | Default VPC |
| Availability Zones | Seleccionar **al menos 2** subnets públicas |
| Security groups | `ovnis-sg-alb` |

En **Listeners and routing**:

| Listener | Puerto | Acción |
|----------|--------|--------|
| HTTP | 80 | Forward to `ovnis-tg` |

Clic **Create load balancer** — tarda ~2 minutos.

### Paso 3.3 — Verificar que el Target está Healthy

Ir a: **EC2 → Target Groups → ovnis-tg → pestaña Targets**

El estado debe cambiar de `initial` → `healthy` en ~1 minuto.

Si aparece `unhealthy`, revisar:
- El servicio `ovnis-api` debe estar activo en la EC2
- El SG del EC2 debe permitir puerto 8000 desde el SG del ALB

### Paso 3.4 — Anotar el DNS del ALB

Ir a: **EC2 → Load Balancers → ovnis-alb** → copiar **DNS name**:
```
ovnis-alb-1234567890.us-east-1.elb.amazonaws.com
```

---

## PARTE 4 — Pruebas al backend desde el ALB

> Referencia de endpoints: `backend/README.md`

### Pruebas con curl (desde tu máquina o la EC2)

Reemplaza `<ALB_DNS>` con el DNS copiado en el paso anterior.

**Health check:**
```bash
curl http://<ALB_DNS>/health
# Esperado: {"status":"ok"}
```

**Listar avistamientos (debe devolver 14 registros del seed):**
```bash
curl http://<ALB_DNS>/avistamientos
```

**Crear un avistamiento:**
```bash
curl -X POST http://<ALB_DNS>/avistamientos \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-05-15",
    "hora": "22:30",
    "ubicacion": "Santiago, Chile",
    "cantidad": 3,
    "forma": "Disco",
    "observaciones": "Luces rojas intermitentes",
    "registrado_por": "Tu Nombre"
  }'
# Esperado: HTTP 201 + JSON del registro creado
```

**Obtener un avistamiento por ID:**
```bash
curl http://<ALB_DNS>/avistamientos/1
```

**Eliminar un avistamiento:**
```bash
curl -X DELETE http://<ALB_DNS>/avistamientos/1
# Esperado: {"mensaje":"Avistamiento eliminado correctamente"}
```

**Swagger UI (en el navegador):**
```
http://<ALB_DNS>/docs
```

---

## PARTE 5 — GCP: Frontend en Cloud Run

> Documentación detallada: `frontendSimple/README_CLOUDRUN.md`
> Explicación del proxy: `frontendSimple/README_PROXY.md`

### Por qué se necesita el proxy nginx

```
SIN PROXY (falla):
Browser ──HTTPS──► Cloud Run
Browser ──HTTP───► ALB  ← BLOQUEADO por Mixed Content

CON PROXY (funciona):
Browser ──HTTPS──► Cloud Run (nginx) ──HTTP──► ALB
                        └── proxy interno, el browser no interviene
```

### Paso 5.1 — Abrir Cloud Shell en GCP

Ir a **console.cloud.google.com** → clic en el ícono de Cloud Shell (terminal).

### Paso 5.2 — Configurar el proyecto

```bash
gcloud config set project <ID_DE_TU_PROYECTO>
gcloud config get-value project   # verificar
```

### Paso 5.3 — Habilitar APIs necesarias

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

### Paso 5.4 — Crear repositorio en Artifact Registry

```bash
gcloud artifacts repositories create ovnis-repo \
  --repository-format=docker \
  --location=us-central1
```

Verificar:
```bash
gcloud artifacts repositories list --location=us-central1
```

### Paso 5.5 — Clonar el repositorio y posicionarse en el frontend

```bash
git clone https://github.com/TU_USUARIO/TU_REPO.git
cd SoftwareArquitectura/frontendSimple
```

### Paso 5.6 — Definir variables de entorno

```bash
export PROJECT_ID=$(gcloud config get-value project)
export ALB_DNS="http://<DNS_DEL_ALB_COPIADO_EN_PARTE_3>"
```

Verificar:
```bash
echo $PROJECT_ID
echo $ALB_DNS
```

### Paso 5.7 — Construir la imagen con Cloud Build

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_API_PROXY_URL="$ALB_DNS",_IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend" \
  .
```

Lo que ocurre internamente durante el build:

```
Cloud Build ejecuta el Dockerfile en 2 etapas:

Etapa 1 — Node.js build
  VITE_API_URL=/api  ← fijo, nginx hace el proxy
  npm install
  npm run build  → genera dist/

Etapa 2 — Nginx
  Copia dist/ al servidor web
  sed reemplaza PLACEHOLDER_API_URL con $ALB_DNS en nginx.conf
  Expone puerto 8080
```

El proceso tarda entre 2 y 4 minutos.

### Paso 5.8 — Desplegar en Cloud Run

```bash
gcloud run deploy ovnis-frontend \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

Al terminar, el comando muestra la URL pública:
```
Service URL: https://ovnis-frontend-xxxxxxxxxx-uc.a.run.app
```

### Paso 5.9 — Verificar en el navegador

Abrir la URL del paso anterior. La aplicación debe:
1. Cargar la tabla con los 14 avistamientos del seed
2. Permitir crear un nuevo avistamiento con el formulario
3. Permitir eliminar registros

**Verificar el proxy con DevTools (F12 → Network):**

Las peticiones al backend deben verse así:
```
Request URL: https://ovnis-frontend-xxx.run.app/api/avistamientos
Status: 200 OK
```

Si ves directamente la URL del ALB en las peticiones, el proxy no está activo — verifica que hiciste `git pull` antes del build.

---

## Resumen de comandos de diagnóstico

### AWS — EC2

```bash
# Estado del servicio
sudo systemctl status ovnis-api

# Logs en tiempo real
sudo journalctl -u ovnis-api -f

# Últimas 50 líneas de log
sudo journalctl -u ovnis-api -n 50 --no-pager

# Verificar que el puerto 8000 está activo
ss -tlnp | grep 8000

# Probar API desde la propia EC2
curl http://localhost:8000/health
curl http://localhost:8000/avistamientos

# Reiniciar el servicio
sudo systemctl restart ovnis-api
```

### AWS — RDS (desde la EC2)

```bash
# Verificar conectividad
mysql -h <ENDPOINT_RDS> -u admin -pTuContraseña \
  -e "SELECT COUNT(*) FROM ovnis_db.avistamientos;"
```

### GCP — Cloud Run

```bash
# Ver logs del servicio
gcloud run services logs read ovnis-frontend --region us-central1

# Obtener la URL del servicio
gcloud run services describe ovnis-frontend \
  --region us-central1 \
  --format='value(status.url)'

# Listar revisiones desplegadas
gcloud run revisions list --service ovnis-frontend --region us-central1
```

---

## Tabla de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| EC2 no arranca el servicio | Error en imports de Python | `sudo journalctl -u ovnis-api -n 50` para ver el error |
| Target Group `unhealthy` | Puerto 8000 bloqueado o servicio caído | Verificar SG y `systemctl status ovnis-api` |
| ALB devuelve 503 | Todos los targets unhealthy | Ver pestaña Targets en el TG |
| `Failed to fetch` en el browser | Mixed Content (HTTPS→HTTP) | Verificar que nginx.conf tiene el bloque `/api/` proxy |
| `ModuleNotFoundError` en EC2 | Imports con rutas locales de desarrollo | Verificar que `main.py` usa `import models` sin prefijos de ruta |
| Cloud Build falla en push | Repositorio de Artifact Registry no creado | Ejecutar el paso 5.4 |
| `Unknown database` en RDS | DB_NAME con guión o base no creada | Usar `ovnis_db` (guión bajo), no `ovnis-db` |

---

## Archivos de referencia del proyecto

| Archivo | Contenido |
|---------|-----------|
| `backend/userdata.sh` | Script de instalación automática para EC2 User Data |
| `backend/README.md` | Todos los endpoints con ejemplos curl |
| `backend/.env.example` | Plantilla de variables de entorno |
| `database/schema.sql` | Definición de tablas (incluye `CREATE DATABASE`) |
| `database/seed.sql` | 14 registros de prueba |
| `docs/AWS_BACKEND_RDS.md` | Guía detallada EC2 + RDS |
| `docs/AWS_AMAZONLINUX_ALB.md` | Guía detallada EC2 + ALB + Security Groups |
| `frontendSimple/README_CLOUDRUN.md` | Guía paso a paso Cloud Run |
| `frontendSimple/README_PROXY.md` | Explicación del proxy nginx y Mixed Content |

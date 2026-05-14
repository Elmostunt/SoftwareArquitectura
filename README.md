# Sistema de Registro de Avistamiento de OVNIs
## Evaluación — Arquitectura Multicloud · INACAP

Aplicación CRUD distribuida en dos nubes: **backend en AWS**, **frontend en Google Cloud**.

---

## Arquitectura general

```
┌──────────────────────────────────────────────────────────────────┐
│                      USUARIO (Navegador)                         │
└────────────────────┬─────────────────────────┬───────────────────┘
                     │  sirve HTML/JS/CSS       │  API calls (JSON)
                     ▼                          ▼
        ┌────────────────────┐     ┌─────────────────────────────┐
        │   Google Cloud     │     │            AWS              │
        │   ─────────────    │     │  ────────────────────────── │
        │   VM / Cloud Run   │     │  Application Load Balancer  │
        │   frontend         │     │  :80                        │
        │   (Apache/Nginx/   │     │         │                   │
        │    Docker)         │     │         ▼                   │
        └────────────────────┘     │  EC2 Amazon Linux 2023      │
                                   │  FastAPI + uvicorn :8000    │
                                   │         │                   │
                                   │         ▼                   │
                                   │  RDS MySQL :3306 (privado)  │
                                   └─────────────────────────────┘
```

**El frontend NUNCA habla directamente con el EC2.**
Siempre usa el **DNS del Load Balancer** (ALB) como punto de entrada al backend.

---

## Orden de despliegue

```
1. RDS MySQL  →  2. EC2 + FastAPI  →  3. ALB  →  4. Frontend (elegir opción)
```

Seguir este orden es obligatorio: cada paso depende del anterior.

---

## Estructura del repositorio

```
SoftwareArquitectura/
├── README.md                       ← Esta guía
├── database/
│   ├── schema.sql                  ← Crea la tabla avistamientos
│   └── seed.sql                    ← 7 registros de prueba
├── backend/
│   ├── main.py                     ← FastAPI: endpoints CRUD
│   ├── database.py                 ← Conexión SQLAlchemy → RDS
│   ├── models.py                   ← Modelo ORM
│   ├── schemas.py                  ← Validación Pydantic
│   ├── requirements.txt            ← Dependencias Python
│   └── .env.example                ← Plantilla de variables de entorno
├── frontendHTML/
│   ├── index.html                  ← Frontend HTML puro (Opción A)
│   └── README.md                   ← Guía: HTML + Apache en Compute Engine
├── frontendSimple/
│   ├── src/
│   │   ├── App.jsx                 ← Componente principal (llama a la API)
│   │   ├── api.js                  ← Funciones fetch al backend
│   │   └── components/             ← Tabla y formulario
│   ├── .env.example                ← Plantilla VITE_API_URL
│   ├── Dockerfile                  ← Para despliegue en Cloud Run
│   ├── nginx.conf                  ← Config Nginx para el contenedor
│   ├── README.md                   ← Guía: React + Docker local
│   └── README_CLOUDRUN.md          ← Guía: React + Cloud Run (Opción C)
└── docs/
    ├── AWS_AMAZONLINUX_ALB.md      ← Guía principal: EC2 + ALB (usar esta)
    ├── AWS_BACKEND_RDS.md          ← Guía alternativa: EC2 sin ALB
    └── CLOUD_FRONTEND.md           ← Guía: React + Nginx en Compute Engine (Opción B)
```

---

## PASO 1 — Base de datos en AWS RDS

**Guía detallada:** [docs/AWS_AMAZONLINUX_ALB.md — Parte 1 y 2](docs/AWS_AMAZONLINUX_ALB.md)

### Resumen

1. AWS Console → **RDS → Create database**

| Campo                  | Valor                          |
|------------------------|--------------------------------|
| Engine                 | MySQL 8.0                      |
| Template               | Free tier                      |
| DB instance identifier | `ovnis-db`                     |
| Master username        | `admin`                        |
| Master password        | (elige una contraseña segura)  |
| Instance class         | `db.t3.micro`                  |
| Public access          | **No**                         |
| VPC security groups    | `ovnis-sg-rds` (ver guía)      |

2. En **Additional configuration → Initial database name**: escribir `ovnis_db`
3. Clic **Create database** — tarda ~5 minutos
4. **Anotar el Endpoint** cuando esté disponible:
   ```
   ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
   ```

> **Punto de control:** el Endpoint de RDS está anotado y el estado es "Available".

---

## PASO 2 — Backend en AWS EC2 + ALB

**Guía detallada:** [docs/AWS_AMAZONLINUX_ALB.md](docs/AWS_AMAZONLINUX_ALB.md)

### Resumen

**Crear Security Groups primero** (ver sección "Parte 1" de la guía):
- `ovnis-sg-alb` — permite HTTP :80 desde Internet
- `ovnis-sg-ec2` — permite :8000 solo desde `ovnis-sg-alb`
- `ovnis-sg-rds` — permite :3306 solo desde `ovnis-sg-ec2`

**Lanzar EC2 con Amazon Linux 2023:**

```bash
# Conectarse por SSH (usuario es ec2-user, no ubuntu)
chmod 400 tu-clave.pem
ssh -i tu-clave.pem ec2-user@<IP_PUBLICA_EC2>
```

**Instalar dependencias y desplegar el backend:**

```bash
# Actualizar sistema
sudo dnf update -y
sudo dnf install -y python3 python3-pip git mariadb105

# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd SoftwareArquitectura/backend

# Crear entorno virtual e instalar dependencias
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
nano .env
```

Completar `.env`:
```
DB_HOST=ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=ovnis_db
DB_USER=admin
DB_PASSWORD=TuContraseñaSegura
```

**Cargar el esquema y datos iniciales:**

```bash
# Desde la raíz del repo (cd ~/SoftwareArquitectura)
mysql -h <ENDPOINT_RDS> -u admin -p ovnis_db < database/schema.sql
mysql -h <ENDPOINT_RDS> -u admin -p ovnis_db < database/seed.sql
```

**Crear servicio systemd y verificar:**

```bash
# Probar manualmente primero
cd ~/SoftwareArquitectura/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
# Ctrl+C para detener
```

Ver la guía completa para configurar el servicio systemd (arranque automático).

> **Punto de control:** `curl http://<IP_EC2>:8000/health` responde `{"status":"ok"}`

---

## PASO 3 — Application Load Balancer en AWS

**Guía detallada:** [docs/AWS_AMAZONLINUX_ALB.md — Parte 5](docs/AWS_AMAZONLINUX_ALB.md)

### Resumen

**Crear Target Group:**
- EC2 → Target Groups → Create target group
- Target type: **Instances** | Port: **8000** | Health check path: `/health`
- Registrar el EC2 `ovnis-backend`

**Crear Load Balancer:**
- EC2 → Load Balancers → Create → **Application Load Balancer**
- Scheme: **Internet-facing** | Security group: `ovnis-sg-alb`
- Listener: HTTP :80 → Forward to `ovnis-tg`

**Anotar el DNS del ALB:**
```
ovnis-alb-1234567890.us-east-1.elb.amazonaws.com
```

> **Punto de control:** `curl http://<DNS_ALB>/avistamientos` devuelve los 7 registros en JSON.

---

## PASO 4 — Frontend en Google Cloud (elegir una opción)

### Opción A — HTML puro + Apache en Compute Engine

**Guía:** [frontendHTML/README.md](frontendHTML/README.md)

La opción más simple. Un solo archivo `index.html` servido por Apache.

```
GCP Compute Engine → Ubuntu → Apache → index.html
                                         ↓
                              API_BASE_URL = DNS del ALB
```

**Pasos clave:**
1. Crear VM Ubuntu en GCP (`e2-micro`, Allow HTTP)
2. Instalar Apache: `sudo apt install -y apache2`
3. Clonar el repo y copiar el HTML: `sudo cp SoftwareArquitectura/frontendHTML/index.html /var/www/html/`
4. Editar `/var/www/html/index.html` y reemplazar `LOAD_BALANCER_DNS_AQUI` con el DNS del ALB
5. Abrir `http://<IP_VM>` en el navegador

---

### Opción B — React + Nginx en Compute Engine

**Guía:** [docs/CLOUD_FRONTEND.md](docs/CLOUD_FRONTEND.md)

Frontend React compilado con Vite y servido por Nginx.

```
GCP Compute Engine → Ubuntu → Node.js build → dist/ → Nginx
                                VITE_API_URL = DNS del ALB
```

**Pasos clave:**
1. Crear VM Ubuntu en GCP (`e2-micro`, Allow HTTP)
2. Instalar Node.js 20 y Nginx
3. Clonar el repo: `cd SoftwareArquitectura/frontendSimple`
4. Crear `.env.local` con el DNS del ALB:
   ```
   VITE_API_URL=http://ovnis-alb-xxx.us-east-1.elb.amazonaws.com
   ```
5. Compilar y desplegar:
   ```bash
   npm install
   npm run build
   sudo cp -r dist/* /var/www/html/
   ```
6. Abrir `http://<IP_VM>` en el navegador

---

### Opción C — React + Docker en Cloud Run

**Guía:** [frontendSimple/README_CLOUDRUN.md](frontendSimple/README_CLOUDRUN.md)

La URL del ALB se pasa como build argument al construir la imagen Docker.
Cloud Run proporciona HTTPS automático y URL fija.

```
Cloud Build → Dockerfile (ARG VITE_API_URL) → Artifact Registry → Cloud Run
```

**Pasos clave:**
1. Activar servicios GCP: Cloud Run, Artifact Registry, Cloud Build
2. Crear repositorio Docker en Artifact Registry
3. Guardar el DNS del ALB:
   ```bash
   export ALB_DNS="http://ovnis-alb-xxx.us-east-1.elb.amazonaws.com"
   export PROJECT_ID=$(gcloud config get-value project)
   ```
4. Construir y subir la imagen:
   ```bash
   gcloud builds submit \
     --tag us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend \
     --substitutions=_VITE_API_URL="$ALB_DNS" \
     .
   ```
5. Desplegar en Cloud Run:
   ```bash
   gcloud run deploy ovnis-frontend \
     --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend \
     --platform managed --region us-central1 --allow-unauthenticated
   ```

---

## Verificación de la integración completa

Una vez desplegado todo, verificar el flujo end-to-end:

```bash
# 1. Verificar que el backend responde (via ALB)
curl http://<DNS_ALB>/health
# Esperado: {"status":"ok"}

# 2. Verificar que la base de datos tiene datos
curl http://<DNS_ALB>/avistamientos
# Esperado: lista de 7 avistamientos en JSON

# 3. Crear un nuevo avistamiento desde el formulario del frontend
# Verificar que aparece en la tabla al recargar

# 4. Abrir Swagger para explorar la API
http://<DNS_ALB>/docs
```

---

## Endpoints de la API

| Método | Ruta                  | Descripción               |
|--------|-----------------------|---------------------------|
| GET    | `/avistamientos`      | Listar todos              |
| GET    | `/avistamientos/{id}` | Obtener uno por ID        |
| POST   | `/avistamientos`      | Crear nuevo               |
| PUT    | `/avistamientos/{id}` | Actualizar completo       |
| DELETE | `/avistamientos/{id}` | Eliminar                  |
| GET    | `/docs`               | Swagger UI (documentación)|
| GET    | `/health`             | Estado del servicio       |

### Payload POST / PUT

```json
{
  "fecha":          "2024-03-20",
  "hora":           "22:15",
  "ubicacion":      "Cerro El Plomo, Santiago",
  "cantidad":       1,
  "forma":          "Disco",
  "observaciones":  "Objeto luminoso que se desplazaba en silencio",
  "registrado_por": "Juan Pérez"
}
```

---

## Solución de problemas frecuentes

| Síntoma | Causa más probable | Solución |
|---------|-------------------|---------|
| `{"detail":"..."}` en la API | Error de conexión a RDS | Verificar `.env` (endpoint, usuario, contraseña) |
| `Target unhealthy` en el ALB | Backend no corre en el EC2 | `sudo systemctl status ovnis-api` en el EC2 |
| `Error al conectar con la API` en el frontend | URL del ALB incorrecta | Verificar `VITE_API_URL` o `API_BASE_URL` y reconstruir |
| Tabla vacía sin error | RDS sin datos | Ejecutar `database/seed.sql` en RDS |
| Error CORS en el navegador | Backend no tiene CORS configurado | Verificar `allow_origins=["*"]` en `backend/main.py` |
| `Access denied` en MySQL | Credenciales incorrectas en `.env` | Verificar usuario/contraseña del master RDS |
| Frontend no carga (`502`) | Nginx mal configurado o caído | `sudo systemctl status nginx`, revisar `/var/www/html/` |

---

## Seguridad de la arquitectura

```
Internet
   │
   ▼ :80  → [ovnis-sg-alb: permite 80 desde 0.0.0.0/0]
   │
┌──▼──── ALB ─────────────────┐
│  ovnis-alb (DNS público)    │
└──────────┬──────────────────┘
           │
           ▼ :8000  → [ovnis-sg-ec2: permite 8000 SOLO desde ovnis-sg-alb]
┌──────────▼──────────────────┐
│  EC2 Amazon Linux           │
│  ovnis-backend              │
└──────────┬──────────────────┘
           │
           ▼ :3306  → [ovnis-sg-rds: permite 3306 SOLO desde ovnis-sg-ec2]
┌──────────▼──────────────────┐
│  RDS MySQL                  │
│  ovnis-db (sin IP pública)  │
└─────────────────────────────┘
```

- El EC2 **nunca** acepta tráfico de Internet directamente (solo desde el ALB)
- La RDS **nunca** es accesible desde Internet (solo desde el EC2)
- El ALB es el único punto de entrada público al backend

---

## Resumen visual de opciones de frontend

| Opción | Tecnología | Plataforma GCP | HTTPS | Dificultad |
|--------|-----------|----------------|-------|------------|
| A — HTML + Apache | HTML puro | Compute Engine | No | ⭐ Fácil |
| B — React + Nginx | React/Vite | Compute Engine | No | ⭐⭐ Medio |
| C — React + Cloud Run | React/Docker | Cloud Run | Sí (automático) | ⭐⭐⭐ Avanzado |

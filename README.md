# Sistema de Registro de Avistamiento de OVNIs
## Despliegue Multicloud: Backend en AWS · Frontend en Google Cloud Run

---

## Arquitectura

```
                        ┌─────────────────────────────────────┐
                        │         GOOGLE CLOUD (GCP)           │
                        │                                      │
  Usuario               │  Cloud Run                          │
  Navegador ────HTTPS──►│  ovnis-frontend                     │
                        │  nginx:8080 + React                 │
                        │                                      │
                        └──────────────┬──────────────────────┘
                                       │ API calls HTTP
                                       ▼
                        ┌─────────────────────────────────────┐
                        │              AWS                     │
                        │                                      │
                        │  Application Load Balancer :80       │
                        │  ovnis-alb (DNS público)             │
                        │              │                       │
                        │              ▼ :8000 (interno)       │
                        │  EC2 Amazon Linux 2023               │
                        │  FastAPI + uvicorn                   │
                        │              │                       │
                        │              ▼ :3306 (privado)       │
                        │  RDS MySQL 8.0                       │
                        │  ovnis-db (sin IP pública)           │
                        │                                      │
                        └─────────────────────────────────────┘
```

### Reglas de seguridad de red

- El EC2 **nunca** acepta tráfico de Internet directo — solo desde el ALB.
- La RDS **nunca** es accesible desde Internet — solo desde el EC2.
- Cloud Run tiene HTTPS automático con URL fija provista por Google.

---

## Estructura del repositorio

```
SoftwareArquitectura/
├── README.md                    ← Esta guía (todo en un solo archivo)
├── database/
│   ├── schema.sql               ← Crea la tabla avistamientos en RDS
│   └── seed.sql                 ← 7 registros de prueba
├── backend/
│   ├── main.py                  ← FastAPI: rutas CRUD + CORS
│   ├── database.py              ← Conexión SQLAlchemy → RDS MySQL
│   ├── models.py                ← Modelo ORM Avistamiento
│   ├── schemas.py               ← Validación Pydantic
│   ├── requirements.txt         ← Dependencias Python
│   └── .env.example             ← Plantilla de variables de entorno
└── frontendSimple/
    ├── src/                     ← Código fuente React
    ├── Dockerfile               ← Build multietapa: Node → nginx
    ├── nginx.conf               ← nginx en puerto 8080 (Cloud Run)
    ├── cloudbuild.yaml          ← Configuración Cloud Build con build args
    ├── package.json
    └── .env.example             ← Plantilla VITE_API_URL
```

---

## Orden de despliegue

```
PASO 1 → Security Groups (AWS)
PASO 2 → RDS MySQL (AWS)
PASO 3 → EC2 + Backend (AWS)
PASO 4 → Application Load Balancer (AWS)
PASO 5 → Anotar DNS del ALB  ← dato que necesita el frontend
PASO 6 → Cloud Run (GCP)
PASO 7 → Verificación end-to-end
```

---

## Herramientas necesarias en tu máquina local

| Herramienta | Para qué | Instalación |
|-------------|----------|-------------|
| `gcloud` CLI | Desplegar en GCP | [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) |
| `git` | Clonar el repositorio | Incluido en macOS / `sudo dnf install git` |
| Cliente SSH | Conectarse al EC2 | Incluido en macOS y Linux |

---

## PASO 0 — Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd SoftwareArquitectura
```

---

## PASO 1 — Security Groups en AWS

Los Security Groups controlan qué tráfico puede entrar a cada recurso.
Deben crearse **antes** de crear cualquier instancia.

Ir a: **AWS Console → EC2 → Security Groups → Create security group**
VPC: usar la **Default VPC** en los tres.

### SG-1: `ovnis-sg-alb` (para el Load Balancer)

| Dirección | Tipo        | Puerto | Origen       |
|-----------|-------------|--------|--------------|
| Inbound   | HTTP        | 80     | `0.0.0.0/0`  |
| Outbound  | All traffic | All    | `0.0.0.0/0`  |

### SG-2: `ovnis-sg-ec2` (para el EC2)

| Dirección | Tipo        | Puerto | Origen                          |
|-----------|-------------|--------|---------------------------------|
| Inbound   | SSH         | 22     | My IP                           |
| Inbound   | Custom TCP  | 8000   | **SG-ID de `ovnis-sg-alb`**     |
| Outbound  | All traffic | All    | `0.0.0.0/0`                     |

> En el campo Source del puerto 8000, seleccionar "Custom" y pegar el ID del SG anterior
> (tiene el formato `sg-xxxxxxxxxxxxxxxxx`). Así solo el ALB puede llamar al EC2.

### SG-3: `ovnis-sg-rds` (para RDS)

| Dirección | Tipo          | Puerto | Origen                          |
|-----------|---------------|--------|---------------------------------|
| Inbound   | MySQL/Aurora  | 3306   | **SG-ID de `ovnis-sg-ec2`**     |

> **Punto de control:** tienes los 3 Security Groups creados y anotados sus IDs.

---

## PASO 2 — RDS MySQL en AWS

### 2.1 Crear la instancia

1. **AWS Console → RDS → Create database**

| Campo                        | Valor                              |
|------------------------------|------------------------------------|
| Engine                       | MySQL 8.0                          |
| Template                     | **Free tier**                      |
| DB instance identifier       | `ovnis-db`                         |
| Master username               | `admin`                            |
| Master password              | (elige una contraseña segura)      |
| Instance class               | `db.t3.micro`                      |
| Storage                      | 20 GB gp2                          |
| VPC                          | Default VPC                        |
| Public access                | **No**                             |
| VPC security groups          | `ovnis-sg-rds`                     |

2. Expandir **Additional configuration** → **Initial database name**: escribir `ovnis_db`
3. Clic **Create database** — tarda entre 5 y 10 minutos

### 2.2 Anotar el Endpoint

Una vez que el estado cambie a **Available**:
- Clic en la instancia `ovnis-db`
- Copiar el valor de **Endpoint** (columna "Endpoint & port"):

```
ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
```

> **Punto de control:** tienes el Endpoint de RDS anotado y el estado es "Available".

---

## PASO 3 — EC2 Amazon Linux 2023 + Backend

El backend se instala automáticamente usando el **User Data** de EC2: un script que AWS ejecuta en el primer arranque de la instancia. No necesitas hacer SSH ni configurar nada a mano.

### 3.1 Preparar el script de inicio

El archivo `backend/userdata.sh` del repositorio contiene el script completo.
Ábrelo y reemplaza los **3 valores** al inicio del archivo:

```bash
REPO_URL="https://github.com/USUARIO/REPOSITORIO.git"   # URL del repo
DB_HOST="ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com"  # Endpoint RDS (Paso 2)
DB_PASSWORD="TuContraseñaSegura"                          # Contraseña RDS (Paso 2)
```

> Deja el resto del script sin cambios.
> El script instala las dependencias, clona el repo, carga el esquema y los datos en RDS,
> y arranca FastAPI como un servicio que se reinicia automáticamente.

Copia todo el contenido del script (desde `#!/bin/bash` hasta la última línea).

### 3.2 Lanzar el EC2 con el User Data

1. **AWS Console → EC2 → Launch instances**

| Campo                | Valor                                       |
|----------------------|---------------------------------------------|
| Name                 | `ovnis-backend`                             |
| AMI                  | **Amazon Linux 2023 AMI** (HVM, 64-bit x86) |
| Instance type        | `t2.micro` (Free Tier)                      |
| Key pair             | Crear nuevo → descargar el `.pem`           |
| VPC                  | Default VPC (mismo que RDS)                 |
| Subnet               | Cualquier subnet pública                    |
| Auto-assign IP       | Enable                                      |
| Security group       | `ovnis-sg-ec2`                              |

2. Expandir **Advanced details** (al final de la página)
3. Ir al campo **User data** → seleccionar **"As text"**
4. Pegar el contenido del script `userdata.sh` (con los 3 valores ya reemplazados)
5. Clic **Launch instance**

Anotar la **Public IPv4 address** del EC2 cuando aparezca en la lista de instancias.

### 3.3 Verificar que el script corrió correctamente

El script tarda entre **3 y 5 minutos** en completarse (la mayor parte es `dnf update`).
El EC2 puede aparecer como "Running" antes de que el script termine — esperar ese tiempo antes de verificar.

**Opción A — sin SSH (ver el log desde la consola AWS):**

1. EC2 → seleccionar `ovnis-backend` → clic **Actions → Monitor and troubleshoot → Get system log**
2. Buscar las líneas del script al final del log:
   ```
   [1/6] Instalando dependencias del sistema...
   [2/6] Clonando repositorio...
   ...
   Instalación completada: ...
   API disponible en: http://X.X.X.X:8000
   ```

**Opción B — con SSH:**

```bash
chmod 400 tu-clave.pem
ssh -i tu-clave.pem ec2-user@<IP_PUBLICA_EC2>

# Ver el log completo del script
sudo cat /var/log/userdata-ovnis.log

# Ver el estado del servicio FastAPI
sudo systemctl status ovnis-api
```

**Verificar desde tu máquina local:**

```bash
curl http://<IP_PUBLICA_EC2>:8000/health
# Esperado: {"status":"ok"}
```

> **Punto de control:** el endpoint `/health` responde `{"status":"ok"}`.
> Si falla, revisar el log con `sudo cat /var/log/userdata-ovnis.log` dentro del EC2.

---

## PASO 4 — Application Load Balancer en AWS

### 4.1 Crear el Target Group

El Target Group define hacia qué instancia y puerto reenvía el ALB el tráfico.

1. **AWS Console → EC2 → Target Groups → Create target group**

| Campo              | Valor              |
|--------------------|--------------------|
| Target type        | **Instances**      |
| Name               | `ovnis-tg`         |
| Protocol           | HTTP               |
| Port               | **8000**           |
| VPC                | Default VPC        |
| Health check path  | `/health`          |

2. Clic **Next**
3. En **Register targets**: marcar el EC2 `ovnis-backend` → clic **Include as pending below**
4. Clic **Create target group**

### 4.2 Crear el Application Load Balancer

1. **AWS Console → EC2 → Load Balancers → Create load balancer**
2. Seleccionar **Application Load Balancer** → clic **Create**

| Campo               | Valor                                               |
|---------------------|-----------------------------------------------------|
| Name                | `ovnis-alb`                                         |
| Scheme              | **Internet-facing**                                 |
| IP address type     | IPv4                                                |
| VPC                 | Default VPC                                         |
| Availability Zones  | Seleccionar **al menos 2 subnets públicas**         |
| Security groups     | `ovnis-sg-alb`                                      |

3. En **Listeners and routing**:

| Protocolo | Puerto | Acción predeterminada          |
|-----------|--------|--------------------------------|
| HTTP      | 80     | Forward to → `ovnis-tg`        |

4. Clic **Create load balancer** — tarda ~2 minutos

### 4.3 Anotar el DNS del ALB

1. **EC2 → Load Balancers** → seleccionar `ovnis-alb`
2. Copiar el valor de **DNS name** (columna en la tabla):

```
ovnis-alb-1234567890.us-east-1.elb.amazonaws.com
```

Este valor se usará en el Paso 6 para configurar el frontend.

### 4.4 Verificar que el ALB funciona

Esperar ~2 minutos a que el health check pase. Luego desde tu máquina local:

```bash
curl http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com/health
# Esperado: {"status":"ok"}

curl http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com/avistamientos
# Esperado: lista de 7 avistamientos en JSON
```

Si el health check no pasa, ir a **EC2 → Target Groups → ovnis-tg → Targets** y
verificar que el estado es **healthy**. Si dice "unhealthy", revisar el Paso 3.8.

> **Punto de control:** el ALB responde en `/health` y `/avistamientos`. Tienes el DNS anotado.

---

## PASO 5 — Preparar variables para GCP

Abrir una terminal en tu máquina local y definir estas variables.
Usarlas en todos los comandos del Paso 6.

```bash
# DNS del ALB de AWS (anotado en el Paso 4.3)
export ALB_DNS="http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com"

# ID del proyecto en GCP (lo entrega el profesor o lo ves en la consola GCP)
export PROJECT_ID="nombre-del-proyecto-gcp"
```

Verificar que están seteadas:
```bash
echo $ALB_DNS
echo $PROJECT_ID
```

---

## PASO 6 — Frontend en Google Cloud Run

### 6.1 Autenticarse en GCP

```bash
gcloud auth login
```

> Abre el navegador para que inicies sesión con tu cuenta de Gmail de GCP.

```bash
gcloud config set project $PROJECT_ID
```

Verificar:
```bash
gcloud config get-value project
# Debe mostrar el ID del proyecto
```

### 6.2 Habilitar los servicios necesarios

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

> Puede tardar hasta 1 minuto. No continuar hasta que termine.

### 6.3 Crear el repositorio Docker en Artifact Registry

```bash
gcloud artifacts repositories create ovnis-repo \
  --repository-format=docker \
  --location=us-central1
```

### 6.4 Construir la imagen Docker con Cloud Build

Entrar a la carpeta del frontend:

```bash
cd frontendSimple
```

Ejecutar Cloud Build usando el archivo `cloudbuild.yaml` ya incluido en el repositorio:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=\
_VITE_API_URL="$ALB_DNS",\
_IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend" \
  .
```

> Este comando envía el código fuente a Cloud Build, que:
> 1. Ejecuta `npm install` dentro de un contenedor Node.js 20
> 2. Ejecuta `npm run build` con la URL del ALB incrustada en el JavaScript
> 3. Empaqueta el resultado en una imagen nginx:alpine que escucha en el puerto 8080
> 4. Sube la imagen a Artifact Registry
>
> Tarda entre 3 y 5 minutos. Los logs aparecen en tiempo real.

### 6.5 Desplegar en Cloud Run

```bash
gcloud run deploy ovnis-frontend \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

> Al terminar, el comando imprime la URL del servicio:
> ```
> Service URL: https://ovnis-frontend-xxxxxxxxxx-uc.a.run.app
> ```
> Esa es la URL pública del frontend con HTTPS activo.

Guardar la URL:
```bash
export FRONTEND_URL=$(gcloud run services describe ovnis-frontend \
  --region us-central1 \
  --format='value(status.url)')
echo $FRONTEND_URL
```

---

## PASO 7 — Verificación end-to-end

### Verificar el backend (desde tu máquina local)

```bash
# Health check
curl http://$ALB_DNS_SIN_HTTP/health
# Esperado: {"status":"ok"}

# Listar avistamientos
curl http://$ALB_DNS_SIN_HTTP/avistamientos
# Esperado: JSON con 7 avistamientos

# Swagger UI (en el navegador)
# http://<DNS_ALB>/docs
```

### Verificar el frontend (en el navegador)

1. Abrir la URL de Cloud Run: `https://ovnis-frontend-xxxxxxxxxx-uc.a.run.app`
2. Debe cargar la tabla con los 7 avistamientos de prueba
3. Crear un nuevo avistamiento con el botón "+ Nuevo avistamiento"
4. Verificar que aparece en la tabla al guardar
5. Editar un registro y confirmar que el cambio persiste
6. Eliminar un registro y confirmar que desaparece

> **Punto de control final:** puedes crear, editar y eliminar avistamientos desde Cloud Run,
> y los cambios persisten en RDS porque pasan por el ALB → EC2 → MySQL.

---

## Endpoints de la API

| Método | Ruta                    | Descripción                     |
|--------|-------------------------|---------------------------------|
| GET    | `/`                     | Info de la API                  |
| GET    | `/health`               | Estado del servicio             |
| GET    | `/avistamientos`        | Listar todos                    |
| GET    | `/avistamientos/{id}`   | Obtener uno por ID              |
| POST   | `/avistamientos`        | Crear nuevo (status 201)        |
| PUT    | `/avistamientos/{id}`   | Actualizar completo             |
| DELETE | `/avistamientos/{id}`   | Eliminar                        |
| GET    | `/docs`                 | Swagger UI interactivo          |

### Ejemplo de body para POST y PUT

```json
{
  "fecha":          "2024-03-20",
  "hora":           "22:15",
  "ubicacion":      "Cerro El Plomo, Santiago",
  "cantidad":       1,
  "forma":          "Disco",
  "observaciones":  "Objeto luminoso desplazándose en silencio",
  "registrado_por": "Juan Pérez"
}
```

---

## Actualizar el despliegue tras cambios

Si modificas el código del frontend, debes reconstruir y redesplegar:

```bash
cd frontendSimple

gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=\
_VITE_API_URL="$ALB_DNS",\
_IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend" \
  .

gcloud run deploy ovnis-frontend \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend \
  --region us-central1
```

> Cloud Run hace el cambio sin tiempo de inactividad (zero-downtime).

Si modificas el backend, conectarte al EC2 por SSH y ejecutar:

```bash
chmod 400 tu-clave.pem
ssh -i tu-clave.pem ec2-user@<IP_EC2>

# Dentro del EC2:
cd ~/SoftwareArquitectura
git pull
cd backend
source venv/bin/activate
pip install -r requirements.txt   # solo si cambiaron dependencias
sudo systemctl restart ovnis-api
sudo systemctl status ovnis-api
```

---

## Diagnóstico de problemas

### El Target Group muestra "Unhealthy"

Primero verificar que el script de inicio terminó correctamente:

```bash
# Conectarse por SSH al EC2
chmod 400 tu-clave.pem
ssh -i tu-clave.pem ec2-user@<IP_EC2>

# Ver el log completo del script de inicio
sudo cat /var/log/userdata-ovnis.log
# Debe terminar con: "Instalación completada"

# Ver el estado del servicio FastAPI
sudo systemctl status ovnis-api

# Ver los últimos logs del backend
sudo journalctl -u ovnis-api -n 50 --no-pager

# Verificar que el puerto 8000 está escuchando
ss -tlnp | grep 8000

# Probar el endpoint directamente desde el EC2
curl http://localhost:8000/health
```

### El ALB responde 503 o no responde

- El health check falla si el backend no está corriendo.
- Ir a **EC2 → Target Groups → ovnis-tg → Targets** y verificar el estado.
- Si aparece "draining" o "unhealthy", el problema está en el EC2 (ver arriba).

### Error de conexión a RDS

```bash
# Desde el EC2 — probar conexión directa a MySQL
mysql -h <ENDPOINT_RDS> -u admin -p -e "SELECT 'Conexion OK';"

# Buscar errores SQLAlchemy en los logs del backend
sudo journalctl -u ovnis-api -f | grep -iE "error|sqlalchemy|can't connect"
```

Causas frecuentes:
- Contraseña incorrecta en `.env`
- El Security Group de RDS no tiene regla para `ovnis-sg-ec2`
- El nombre de la base de datos en `.env` no coincide con el creado en RDS

### El frontend muestra "Error al conectar con la API"

La URL del ALB está mal incrustada en el JavaScript. Verificar:

```bash
# Desde la terminal local
curl https://<URL_CLOUDRUN>/   # debe cargar el HTML

# Revisar qué URL tiene el JS del frontend
# Abrir devtools del navegador → Red → una llamada a /avistamientos → ver la URL
```

Si la URL es incorrecta, repetir los pasos 6.4 y 6.5 con el valor correcto de `$ALB_DNS`.

### Error CORS al llamar a la API

El backend tiene `allow_origins=["*"]` en `main.py`, lo que permite cualquier origen.
Si aun así ves error CORS en el navegador:
- Verificar que la URL del ALB en el frontend no tiene barra `/` al final.
- Verificar que el ALB responde sin errores: `curl http://<DNS_ALB>/avistamientos`.

### Cloud Build falla

```bash
# Ver el último build
gcloud builds list --limit=1

# Ver logs del build fallido
gcloud builds log <BUILD_ID>
```

Causas frecuentes:
- `cloudbuild.yaml` no está en la carpeta `frontendSimple/`
- El repositorio de Artifact Registry no fue creado (Paso 6.3)
- Las APIs de GCP no están habilitadas (Paso 6.2)

---

## Comandos de operación (resumen rápido)

### EC2 — gestión del servicio

```bash
sudo systemctl status  ovnis-api    # estado actual
sudo systemctl restart ovnis-api    # reiniciar
sudo systemctl stop    ovnis-api    # detener
sudo journalctl -u ovnis-api -f     # logs en tiempo real
ss -tlnp | grep 8000                # verificar que el puerto escucha
```

### GCP — gestión de Cloud Run

```bash
# Ver URL del servicio
gcloud run services describe ovnis-frontend --region us-central1 --format='value(status.url)'

# Ver estado del servicio
gcloud run services list --region us-central1

# Ver revisiones desplegadas
gcloud run revisions list --service ovnis-frontend --region us-central1

# Eliminar el servicio (al terminar el laboratorio)
gcloud run services delete ovnis-frontend --region us-central1
```

---

## Resumen de valores que debes anotar durante el proceso

| Dato                  | Dónde encontrarlo                                         | Ejemplo |
|-----------------------|-----------------------------------------------------------|---------|
| Endpoint RDS          | RDS → instancia → Connectivity & security → Endpoint      | `ovnis-db.abc123.us-east-1.rds.amazonaws.com` |
| IP pública EC2        | EC2 → Instances → Public IPv4 address                     | `54.123.45.67` |
| DNS del ALB           | EC2 → Load Balancers → ovnis-alb → DNS name               | `ovnis-alb-1234567890.us-east-1.elb.amazonaws.com` |
| ID del proyecto GCP   | Consola GCP → selector de proyecto en la barra superior   | `mi-proyecto-123456` |
| URL de Cloud Run      | Salida del comando `gcloud run deploy` o `gcloud run services describe` | `https://ovnis-frontend-xxxx-uc.a.run.app` |

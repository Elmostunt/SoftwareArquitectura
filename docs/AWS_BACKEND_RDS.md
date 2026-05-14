# Guía de Instalación — Backend (FastAPI) en AWS EC2 + RDS MySQL

## Arquitectura de esta guía

```
Internet
   │
   ▼
┌──────────────────────────────────┐
│          AWS (Región)            │
│                                  │
│  ┌─────────────┐                 │
│  │   EC2 t2.   │  :8000 (API)   │
│  │  micro/free │◄───────────────┼── Peticiones del Frontend
│  │  FastAPI    │                 │
│  └──────┬──────┘                 │
│         │ puerto 3306            │
│  ┌──────▼──────┐                 │
│  │  RDS MySQL  │                 │
│  │  (privado)  │                 │
│  └─────────────┘                 │
└──────────────────────────────────┘
```

> **Regla de seguridad clave:** RDS **nunca** debe ser accesible desde Internet.
> Solo el EC2 (dentro del mismo VPC) puede conectarse a RDS por el puerto 3306.

> **Nota:** Esta guía configura acceso directo al EC2 en el puerto 8000.
> Para un esquema con Load Balancer (recomendado), ver [AWS_AMAZONLINUX_ALB.md](AWS_AMAZONLINUX_ALB.md).

---

## Parte 1 — Crear la base de datos en RDS

### 1.1 Crear instancia RDS

1. Ir a AWS Console → **RDS → Create database**
2. Configurar:

| Campo              | Valor sugerido (Free Tier)        |
|--------------------|-----------------------------------|
| Engine             | MySQL 8.0                         |
| Template           | **Free tier**                     |
| DB instance ID     | `ovnis-db`                        |
| Master username    | `admin`                           |
| Master password    | (elige una contraseña segura)     |
| Instance class     | `db.t3.micro`                     |
| Storage            | 20 GB gp2 (mínimo)                |
| VPC                | Default VPC                       |
| Public access      | **No** ← importante               |

3. En **Additional configuration → Initial database name**: escribir `ovnis_db`
4. Clic en **Create database** (tarda ~5 minutos)

### 1.2 Anotar el endpoint

Una vez creada, ir a la instancia RDS y copiar el valor de **Endpoint**:
```
ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
```
Este valor va en la variable `DB_HOST` del backend.

### 1.3 Configurar Security Group de RDS

1. En RDS → instancia → **VPC security groups** → editar inbound rules
2. Agregar regla:
   - **Type:** MySQL/Aurora
   - **Port:** 3306
   - **Source:** ID del Security Group del EC2 (NO poner `0.0.0.0/0`)

---

## Parte 2 — Crear la instancia EC2

### 2.1 Lanzar EC2

1. AWS Console → **EC2 → Launch instances**
2. Configurar:

| Campo              | Valor sugerido                   |
|--------------------|----------------------------------|
| Name               | `ovnis-backend`                  |
| AMI                | Ubuntu Server 22.04 LTS          |
| Instance type      | `t2.micro` (Free Tier)           |
| Key pair           | Crear o usar existente (.pem)    |
| VPC                | Same Default VPC que RDS         |
| Auto-assign IP     | **Enable**                       |

3. En **Security Group**, crear nuevo con estas reglas:

| Tipo         | Protocolo | Puerto | Origen        |
|--------------|-----------|--------|---------------|
| SSH          | TCP       | 22     | My IP         |
| Custom TCP   | TCP       | 8000   | 0.0.0.0/0    |

4. Clic en **Launch instance**

### 2.2 Conectarse al EC2

```bash
# En tu máquina local (ajusta la ruta del .pem y la IP pública del EC2)
chmod 400 tu-clave.pem
ssh -i tu-clave.pem ubuntu@<IP_PUBLICA_EC2>
```

---

## Parte 3 — Instalar y configurar el backend

Todos estos comandos se ejecutan **dentro del EC2** (via SSH).

### 3.1 Instalar dependencias del sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git mysql-client
```

### 3.2 Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd SoftwareArquitectura
```

### 3.3 Crear entorno virtual e instalar dependencias

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3.4 Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Completar el archivo `.env`:
```
DB_HOST=<ENDPOINT_RDS_COPIADO_ANTES>
DB_PORT=3306
DB_NAME=ovnis_db
DB_USER=admin
DB_PASSWORD=<TU_CONTRASEÑA_RDS>
```

Guardar: `Ctrl+O`, Enter, `Ctrl+X`

### 3.5 Cargar el esquema y datos de prueba

```bash
# Desde la raíz del repo clonado (cd ~/SoftwareArquitectura)
mysql -h <ENDPOINT_RDS> -u admin -p ovnis_db < database/schema.sql
mysql -h <ENDPOINT_RDS> -u admin -p ovnis_db < database/seed.sql
```

### 3.6 Probar el backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

Verificar en el navegador:
```
http://<IP_PUBLICA_EC2>:8000
http://<IP_PUBLICA_EC2>:8000/docs        ← Swagger UI
http://<IP_PUBLICA_EC2>:8000/avistamientos
```

---

## Parte 4 — Ejecutar como servicio (producción)

Para que el backend se reinicie automáticamente si el EC2 se reinicia:

```bash
sudo nano /etc/systemd/system/ovnis-api.service
```

Contenido del archivo:
```ini
[Unit]
Description=OVNIs FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/SoftwareArquitectura/backend
EnvironmentFile=/home/ubuntu/SoftwareArquitectura/backend/.env
ExecStart=/home/ubuntu/SoftwareArquitectura/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Activar el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ovnis-api
sudo systemctl start ovnis-api

# Verificar estado
sudo systemctl status ovnis-api

# Ver logs en tiempo real
sudo journalctl -u ovnis-api -f
```

---

## Parte 5 — Consideraciones de conectividad multicloud

### 5.1 El frontend (en otra nube) llama al backend por Internet

El flujo de red es:

```
Frontend (GCP) ──── HTTP ────► EC2 puerto 8000 ──► RDS puerto 3306
```

**Lo que debes asegurar:**

| Componente | Acción requerida |
|------------|-----------------|
| EC2 Security Group | Puerto 8000 abierto en Inbound para `0.0.0.0/0` |
| RDS Security Group | Puerto 3306 abierto **solo para el EC2** (por SG ID) |
| EC2 IP Pública | Usar IP pública o Elastic IP del EC2 en la config del frontend |
| CORS en FastAPI | `allow_origins=["*"]` ya configurado en `main.py` |

### 5.2 Usar Elastic IP (recomendado en clases)

La IP pública del EC2 cambia cada reinicio. Para fijarla:

1. AWS Console → **EC2 → Elastic IPs → Allocate**
2. Clic en la IP creada → **Associate** → seleccionar el EC2
3. Usar esa IP fija en la config del frontend (`VITE_API_URL`)

### 5.3 Verificar conectividad

```bash
# Desde el EC2, verificar conexión a RDS:
mysql -h <ENDPOINT_RDS> -u admin -p -e "SELECT 'Conexión OK';"

# Desde tu máquina local, verificar que el API responde:
curl http://<IP_EC2>:8000/health
```

---

## Resumen de variables de entorno

| Variable     | Descripción                           | Ejemplo                                      |
|--------------|---------------------------------------|----------------------------------------------|
| `DB_HOST`    | Endpoint de RDS                       | `ovnis-db.abc123.us-east-1.rds.amazonaws.com` |
| `DB_PORT`    | Puerto MySQL                          | `3306`                                       |
| `DB_NAME`    | Nombre de la base de datos            | `ovnis_db`                                   |
| `DB_USER`    | Usuario RDS                           | `admin`                                      |
| `DB_PASSWORD`| Contraseña RDS                        | `MiPass123!`                                 |

---

## Comandos de diagnóstico rápido

```bash
# Estado del servicio
sudo systemctl status ovnis-api

# Últimas 50 líneas de log
sudo journalctl -u ovnis-api -n 50

# Verificar que el puerto 8000 está escuchando
ss -tlnp | grep 8000

# Reiniciar el servicio
sudo systemctl restart ovnis-api
```

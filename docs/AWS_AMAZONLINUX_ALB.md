# Guía — Backend FastAPI en EC2 Amazon Linux 2023 + Application Load Balancer

## Arquitectura objetivo

```
Internet
   │
   ▼  puerto 80
┌──────────────────────────────────────────────────────┐
│                      AWS VPC                         │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │       Application Load Balancer (ALB)        │     │
│  │       DNS: ovnis-alb-xxx.us-east-1.elb.amazonaws.com │
│  └──────────────────┬──────────────────────────┘     │
│                     │ puerto 8000 (interno)           │
│  ┌──────────────────▼──────────────────────────┐     │
│  │           EC2 Amazon Linux 2023              │     │
│  │           FastAPI + uvicorn :8000            │     │
│  └──────────────────┬──────────────────────────┘     │
│                     │ puerto 3306 (interno)           │
│  ┌──────────────────▼──────────────────────────┐     │
│  │           RDS MySQL (privado)                │     │
│  └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Regla clave de seguridad:**
- El ALB recibe tráfico de Internet (puerto 80).
- El EC2 **solo** acepta tráfico desde el ALB (no desde Internet directamente).
- RDS **solo** acepta tráfico desde el EC2.

---

## Parte 1 — Security Groups (crear primero)

Crear los tres Security Groups **antes** de crear los recursos.
Ir a: **EC2 → Security Groups → Create security group**

### SG-1: `ovnis-sg-alb` (para el Load Balancer)

| Dirección | Tipo       | Puerto | Origen        |
|-----------|------------|--------|---------------|
| Inbound   | HTTP       | 80     | `0.0.0.0/0`   |
| Outbound  | All traffic | All   | `0.0.0.0/0`   |

### SG-2: `ovnis-sg-ec2` (para el EC2)

| Dirección | Tipo       | Puerto | Origen                      |
|-----------|------------|--------|-----------------------------|
| Inbound   | SSH        | 22     | My IP (tu IP)               |
| Inbound   | Custom TCP | 8000   | SG-ID de `ovnis-sg-alb`     |
| Outbound  | All traffic | All   | `0.0.0.0/0`                 |

> El puerto 8000 del EC2 solo acepta conexiones que vengan del ALB, no de Internet.

### SG-3: `ovnis-sg-rds` (para RDS)

| Dirección | Tipo         | Puerto | Origen                      |
|-----------|--------------|--------|-----------------------------|
| Inbound   | MySQL/Aurora | 3306   | SG-ID de `ovnis-sg-ec2`     |

---

## Parte 2 — Crear RDS MySQL

1. **RDS → Create database**

| Campo                  | Valor                                     |
|------------------------|-------------------------------------------|
| Engine                 | MySQL 8.0                                 |
| Template               | Free tier                                 |
| DB instance identifier | `ovnis-db`                                |
| Master username        | `admin`                                   |
| Master password        | (elige una contraseña segura)             |
| Instance class         | `db.t3.micro`                             |
| Storage                | 20 GB gp2                                 |
| VPC                    | Default VPC                               |
| Public access          | **No**                                    |
| VPC security groups    | `ovnis-sg-rds`                            |

2. En **Additional configuration → Initial database name**: escribir `ovnis_db`
3. Clic **Create database** (tarda ~5 min)
4. Copiar el **Endpoint** cuando esté disponible:
   ```
   ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
   ```

---

## Parte 3 — Crear EC2 con Amazon Linux 2023

### 3.1 Lanzar la instancia

1. **EC2 → Launch instances**

| Campo           | Valor                                         |
|-----------------|-----------------------------------------------|
| Name            | `ovnis-backend`                               |
| AMI             | **Amazon Linux 2023 AMI** (HVM, 64-bit x86)   |
| Instance type   | `t2.micro` (Free Tier)                        |
| Key pair        | Crear nuevo o usar existente (.pem)            |
| VPC             | Default VPC (mismo que RDS)                   |
| Subnet          | Cualquier subnet pública                      |
| Auto-assign IP  | Enable                                        |
| Security group  | `ovnis-sg-ec2`                                |

2. Clic en **Launch instance**

### 3.2 Conectarse por SSH

```bash
# En tu máquina local
chmod 400 tu-clave.pem
ssh -i tu-clave.pem ec2-user@<IP_PUBLICA_EC2>
```

> En Amazon Linux el usuario es `ec2-user`, no `ubuntu`.

---

## Parte 4 — Instalar el backend (dentro del EC2)

### 4.1 Actualizar el sistema e instalar dependencias

```bash
sudo dnf update -y
sudo dnf install -y python3 python3-pip git
```

Verificar versiones:
```bash
python3 --version   # debe ser 3.9+
pip3 --version
```

### 4.2 Instalar cliente MySQL (para cargar el esquema)

```bash
sudo dnf install -y mariadb105
```

> `mariadb105` provee el cliente compatible con MySQL 8.

### 4.3 Subir el código del backend

**Opción A — desde Git (recomendado):**
```bash
git clone <URL_DEL_REPOSITORIO>
cd SoftwareArquitectura/backend
```

**Opción B — copiar desde tu máquina local:**
```bash
# Ejecutar en tu máquina local, NO en el EC2
scp -i tu-clave.pem -r ./backend ec2-user@<IP_EC2>:~/backend
scp -i tu-clave.pem ./database/schema.sql ec2-user@<IP_EC2>:~/schema.sql
scp -i tu-clave.pem ./database/seed.sql   ec2-user@<IP_EC2>:~/seed.sql
```

### 4.4 Crear entorno virtual e instalar dependencias Python

```bash
cd ~/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Verificar que todo instaló:
```bash
pip list | grep -E "fastapi|uvicorn|sqlalchemy|pymysql"
```

### 4.5 Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Completar con los datos de RDS:
```
DB_HOST=ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=ovnis_db
DB_USER=admin
DB_PASSWORD=TuContraseñaSegura
```

Guardar: `Ctrl+O` → Enter → `Ctrl+X`

### 4.6 Cargar esquema y datos iniciales en RDS

Si usaste **Opción A (git clone)**:
```bash
# Desde la raíz del repo clonado
cd ~/SoftwareArquitectura
mysql -h <ENDPOINT_RDS> -u admin -p ovnis_db < database/schema.sql
mysql -h <ENDPOINT_RDS> -u admin -p ovnis_db < database/seed.sql
```

Si usaste **Opción B (scp)**:
```bash
mysql -h <ENDPOINT_RDS> -u admin -p ovnis_db < ~/schema.sql
mysql -h <ENDPOINT_RDS> -u admin -p ovnis_db < ~/seed.sql
```

Verificar:
```bash
mysql -h <ENDPOINT_RDS> -u admin -p -e "SELECT COUNT(*) FROM ovnis_db.avistamientos;"
```

### 4.7 Probar el backend manualmente

```bash
cd ~/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

Desde tu máquina local:
```bash
curl http://<IP_EC2>:8000/health
# Esperado: {"status":"ok"}
```

Detener con `Ctrl+C` una vez verificado.

### 4.8 Crear servicio systemd (arranque automático)

```bash
sudo nano /etc/systemd/system/ovnis-api.service
```

Pegar este contenido:
```ini
[Unit]
Description=OVNIs FastAPI Backend
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/SoftwareArquitectura/backend
EnvironmentFile=/home/ec2-user/SoftwareArquitectura/backend/.env
ExecStart=/home/ec2-user/SoftwareArquitectura/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> Si usaste la Opción B (scp) y el código está en `~/backend/`, ajusta las rutas:
> `WorkingDirectory=/home/ec2-user/backend`
> `EnvironmentFile=/home/ec2-user/backend/.env`
> `ExecStart=/home/ec2-user/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000`

Guardar: `Ctrl+O` → Enter → `Ctrl+X`

Activar y arrancar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ovnis-api
sudo systemctl start ovnis-api
```

Verificar estado:
```bash
sudo systemctl status ovnis-api
# Debe mostrar: Active: active (running)

# Ver logs en tiempo real
sudo journalctl -u ovnis-api -f
```

---

## Parte 5 — Crear el Application Load Balancer (ALB)

### 5.1 Crear el Target Group

El Target Group le dice al ALB hacia qué instancia y puerto enviar el tráfico.

1. **EC2 → Target Groups → Create target group**

| Campo           | Valor                        |
|-----------------|------------------------------|
| Target type     | **Instances**                |
| Name            | `ovnis-tg`                   |
| Protocol        | HTTP                         |
| Port            | **8000**                     |
| VPC             | Default VPC                  |
| Health check path | `/health`                  |

2. Clic **Next**
3. En **Register targets**: seleccionar el EC2 `ovnis-backend` → **Include as pending below**
4. Clic **Create target group**

### 5.2 Crear el Application Load Balancer

1. **EC2 → Load Balancers → Create load balancer → Application Load Balancer**

| Campo           | Valor                                        |
|-----------------|----------------------------------------------|
| Name            | `ovnis-alb`                                  |
| Scheme          | **Internet-facing**                          |
| IP address type | IPv4                                         |
| VPC             | Default VPC                                  |
| Availability Zones | Seleccionar **al menos 2** subnets públicas |
| Security groups | `ovnis-sg-alb`                               |

2. En **Listeners and routing**:

| Listener | Protocolo | Puerto | Acción                          |
|----------|-----------|--------|----------------------------------|
| HTTP     | HTTP      | 80     | Forward to → `ovnis-tg`         |

3. Clic **Create load balancer** (tarda ~2 minutos)

### 5.3 Obtener el DNS del Load Balancer

1. Ir a **EC2 → Load Balancers** → seleccionar `ovnis-alb`
2. Copiar el valor de **DNS name**:
   ```
   ovnis-alb-1234567890.us-east-1.elb.amazonaws.com
   ```
3. Este es el valor que va en el frontend:
   ```js
   var API_BASE_URL = 'http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com';
   ```

### 5.4 Verificar el ALB

```bash
# Desde tu máquina local o navegador:
curl http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com/health
# Esperado: {"status":"ok"}

curl http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com/avistamientos
# Esperado: lista de avistamientos en JSON
```

---

## Parte 6 — Actualizar el frontend con el DNS del ALB

Editar [frontendHTML/index.html](../frontendHTML/index.html), línea donde está `API_BASE_URL`:

```js
// ANTES (placeholder)
var API_BASE_URL = 'http://LOAD_BALANCER_DNS_AQUI';

// DESPUÉS (DNS real del ALB)
var API_BASE_URL = 'http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com';
```

Volver a copiar el archivo a la VM de Google Cloud:
```bash
sudo cp <ruta>/frontendHTML/index.html /var/www/html/index.html
```

---

## Verificación de Security Groups (resumen visual)

```
Internet
   │
   ▼ :80  ──► [ovnis-sg-alb: permite 80 desde 0.0.0.0/0]
   │
┌──▼──── ALB ────┐
│  ovnis-alb     │
└──────┬─────────┘
       │
       ▼ :8000  ──► [ovnis-sg-ec2: permite 8000 SOLO desde ovnis-sg-alb]
┌──────▼──────────┐
│  EC2            │
│  ovnis-backend  │
└──────┬──────────┘
       │
       ▼ :3306  ──► [ovnis-sg-rds: permite 3306 SOLO desde ovnis-sg-ec2]
┌──────▼──────────┐
│  RDS MySQL      │
│  ovnis-db       │
└─────────────────┘
```

---

## Diagnóstico rápido

### El health check del ALB falla (Target unhealthy)

```bash
# Dentro del EC2 — verificar que el servicio está corriendo
sudo systemctl status ovnis-api

# Verificar que el puerto 8000 está escuchando
ss -tlnp | grep 8000

# Probar el endpoint de health directamente desde el EC2
curl http://localhost:8000/health
```

### La API no responde desde el exterior

```bash
# Verificar que el Security Group del EC2 permite el SG del ALB
# Consola AWS → EC2 → ovnis-backend → Security → Security groups → Inbound rules
# Debe haber una regla: TCP 8000 desde el SG-ID de ovnis-sg-alb

# Ver logs del backend
sudo journalctl -u ovnis-api -n 50 --no-pager
```

### Error de conexión a RDS

```bash
# Desde el EC2 — verificar conectividad a RDS
mysql -h <ENDPOINT_RDS> -u admin -p -e "SELECT 'Conexion OK';"

# Ver logs del backend buscando errores de DB
sudo journalctl -u ovnis-api -f | grep -i "error\|sqlalchemy\|mysql"
```

### Comandos de control del servicio

```bash
sudo systemctl start   ovnis-api   # iniciar
sudo systemctl stop    ovnis-api   # detener
sudo systemctl restart ovnis-api   # reiniciar
sudo systemctl status  ovnis-api   # estado actual
sudo journalctl -u ovnis-api -f    # logs en tiempo real
```

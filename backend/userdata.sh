#!/bin/bash
# ================================================================
# EC2 User Data — Backend OVNIs FastAPI
# Amazon Linux 2023 · Python 3 · FastAPI · RDS MySQL
# ================================================================

# ── CONFIGURACIÓN — reemplazar estos 3 valores ───────────────
REPO_URL="https://github.com/Elmostunt/SoftwareArquitectura.git"
DB_HOST="database-1.c0jgqmwe6uhd.us-east-1.rds.amazonaws.com"
DB_PASSWORD="Inacap2028"

DB_PORT="3306"
DB_NAME="ovnis_db"
DB_USER="admin"
APP_PORT="8000"
# ─────────────────────────────────────────────────────────────

# Redirigir toda la salida al log
exec > /var/log/userdata-ovnis.log 2>&1
set -e

echo "================================================================"
echo " OVNIs Backend — inicio de instalación: $(date)"
echo "================================================================"

# 1. Actualizar sistema e instalar dependencias
echo ""
echo "[1/6] Instalando dependencias del sistema..."

sudo dnf update -y
sudo dnf install -y python3 python3-pip git mariadb105

python3 --version
echo "  OK"

# 2. Clonar repositorio
echo ""
echo "[2/6] Clonando repositorio..."

cd /home/ec2-user
sudo git clone https://github.com/Elmostunt/SoftwareArquitectura.git
sudo chown -R ec2-user:ec2-user SoftwareArquitectura

echo "  OK — clonado en /home/ec2-user/SoftwareArquitectura"

# 3. Crear entorno virtual e instalar dependencias Python
echo ""
echo "[3/6] Instalando dependencias Python..."

cd /home/ec2-user/SoftwareArquitectura/backend

python3 -m venv venv
source venv/bin/activate

pip install --quiet -r requirements.txt

echo "  OK — entorno virtual en backend/venv/"

# 4. Crear archivo .env
echo ""
echo "[4/6] Creando archivo .env..."

sudo tee /home/ec2-user/SoftwareArquitectura/backend/.env > /dev/null << EOF
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
EOF

sudo chown ec2-user:ec2-user /home/ec2-user/SoftwareArquitectura/backend/.env
sudo chmod 600 /home/ec2-user/SoftwareArquitectura/backend/.env

echo "  OK — credenciales guardadas en backend/.env"

# 5. Cargar schema y seed en RDS
echo ""
echo "[5/6] Cargando base de datos en RDS..."

cd /home/ec2-user/SoftwareArquitectura

mysql -h "${DB_HOST}" -P "${DB_PORT}" --protocol=TCP -u "${DB_USER}" -p"${DB_PASSWORD}" < database/schema.sql
echo "  schema.sql OK"

mysql -h "${DB_HOST}" -P "${DB_PORT}" --protocol=TCP -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < database/seed.sql
echo "  seed.sql OK"

ROWS=$(mysql -h "${DB_HOST}" -P "${DB_PORT}" --protocol=TCP -u "${DB_USER}" -p"${DB_PASSWORD}" -se \
  "SELECT COUNT(*) FROM ${DB_NAME}.avistamientos;" 2>/dev/null)

echo "  Filas cargadas: ${ROWS}"

# 6. Crear servicio systemd
echo ""
echo "[6/6] Configurando servicio ovnis-api..."

sudo tee /etc/systemd/system/ovnis-api.service > /dev/null << 'SERVICEEOF'
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
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable ovnis-api
sudo systemctl start ovnis-api

sleep 3

sudo systemctl is-active --quiet ovnis-api && echo "  servicio activo" || echo "  ERROR: servicio no arrancó"

# Obtener IP pública
TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" \
-H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || echo "")

PUBLIC_IP=$(curl -sf \
-H "X-aws-ec2-metadata-token: ${TOKEN}" \
http://169.254.169.254/latest/meta-data/public-ipv4 || echo "IP no disponible")

echo ""
echo "================================================================"
echo " Instalación completada: $(date)"
echo " API disponible en: http://${PUBLIC_IP}:${APP_PORT}"
echo " Swagger UI:        http://${PUBLIC_IP}:${APP_PORT}/docs"
echo " Health check:      http://${PUBLIC_IP}:${APP_PORT}/health"
echo "================================================================"
#!/bin/bash
# ================================================================
# EC2 User Data — Backend OVNIs FastAPI
# Amazon Linux 2023 · Python 3 · FastAPI · RDS MySQL
# ================================================================
#
# INSTRUCCIONES:
#   1. Copiar este script completo
#   2. Reemplazar los 3 valores de la sección CONFIGURACIÓN
#   3. Al crear el EC2, expandir "Advanced details"
#      y pegar el script en el campo "User data"
#   4. Lanzar el EC2 — el script se ejecuta solo en el primer arranque
#
# Para ver los logs del script mientras corre (o después):
#   sudo cat /var/log/userdata-ovnis.log
#
# Para ver el estado de la API después de que el EC2 esté listo:
#   sudo systemctl status ovnis-api
# ================================================================

# ── CONFIGURACIÓN — reemplazar estos 3 valores ───────────────
REPO_URL="https://github.com/USUARIO/REPOSITORIO.git"
DB_HOST="ovnis-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com"
DB_PASSWORD="TuContraseñaSegura"

# No modificar si usaste los nombres sugeridos en la guía
DB_PORT="3306"
DB_NAME="ovnis_db"
DB_USER="admin"
APP_PORT="8000"
# ─────────────────────────────────────────────────────────────

# Redirigir toda la salida al log para poder revisar si algo falla
exec > /var/log/userdata-ovnis.log 2>&1
set -e

echo "================================================================"
echo " OVNIs Backend — inicio de instalación: $(date)"
echo "================================================================"

# 1. Actualizar el sistema e instalar dependencias del SO
echo ""
echo "[1/6] Instalando dependencias del sistema..."
dnf update -y
dnf install -y python3 python3-pip git mariadb105

python3 --version
echo "  OK"

# 2. Clonar el repositorio
echo ""
echo "[2/6] Clonando repositorio..."
cd /home/ec2-user
git clone "$REPO_URL" SoftwareArquitectura
chown -R ec2-user:ec2-user SoftwareArquitectura
echo "  OK — clonado en /home/ec2-user/SoftwareArquitectura"

# 3. Crear entorno virtual Python e instalar dependencias
echo ""
echo "[3/6] Instalando dependencias Python..."
cd /home/ec2-user/SoftwareArquitectura/backend
python3 -m venv venv
source venv/bin/activate
pip install --quiet -r requirements.txt
echo "  OK — entorno virtual en backend/venv/"

# 4. Crear el archivo .env con las credenciales de RDS
echo ""
echo "[4/6] Creando archivo .env..."
cat > /home/ec2-user/SoftwareArquitectura/backend/.env << EOF
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
EOF
chown ec2-user:ec2-user /home/ec2-user/SoftwareArquitectura/backend/.env
chmod 600 /home/ec2-user/SoftwareArquitectura/backend/.env
echo "  OK — credenciales guardadas en backend/.env"

# 5. Cargar el esquema y los datos de prueba en RDS
echo ""
echo "[5/6] Cargando base de datos en RDS..."
cd /home/ec2-user/SoftwareArquitectura

# schema.sql ya contiene CREATE DATABASE IF NOT EXISTS + USE, no pasar DB_NAME
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" < database/schema.sql
echo "  schema.sql OK"

# seed.sql carga datos en la base ya creada
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < database/seed.sql
echo "  seed.sql OK"

# Verificar que los datos se cargaron
ROWS=$(mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" -se \
  "SELECT COUNT(*) FROM ${DB_NAME}.avistamientos;" 2>/dev/null)
echo "  Filas cargadas: ${ROWS}"

# 6. Crear el servicio systemd para que uvicorn corra en segundo plano
echo ""
echo "[6/6] Configurando servicio ovnis-api..."
cat > /etc/systemd/system/ovnis-api.service << 'SERVICEEOF'
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

systemctl daemon-reload
systemctl enable ovnis-api
systemctl start ovnis-api

# Esperar un momento y verificar que el servicio arrancó
sleep 3
systemctl is-active --quiet ovnis-api && echo "  servicio activo" || echo "  ERROR: servicio no arrancó"

# Obtener la IP pública del EC2 (metadata de instancia)
TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || echo "")
PUBLIC_IP=$(curl -sf -H "X-aws-ec2-metadata-token: ${TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4 || echo "IP no disponible")

echo ""
echo "================================================================"
echo " Instalación completada: $(date)"
echo " API disponible en: http://${PUBLIC_IP}:${APP_PORT}"
echo " Swagger UI:        http://${PUBLIC_IP}:${APP_PORT}/docs"
echo " Health check:      http://${PUBLIC_IP}:${APP_PORT}/health"
echo "================================================================"

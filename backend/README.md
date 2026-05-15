# API Avistamiento de OVNIs — Backend FastAPI

API REST construida con FastAPI + SQLAlchemy sobre MySQL en AWS RDS.

---

## Obtener la IP pública de la EC2

```bash
curl -sf \
  -H "X-aws-ec2-metadata-token: $(curl -sf -X PUT http://169.254.169.254/latest/api/token \
      -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')" \
  http://169.254.169.254/latest/meta-data/public-ipv4
```

---

## Probar desde la misma EC2 (localhost)

### Health check
```bash
curl http://localhost:8000/health
```

### Raíz
```bash
curl http://localhost:8000/
```

### Listar todos los avistamientos
```bash
curl http://localhost:8000/avistamientos
```

### Obtener un avistamiento por ID
```bash
curl http://localhost:8000/avistamientos/1
```

### Crear un avistamiento
```bash
curl -X POST http://localhost:8000/avistamientos \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-05-15",
    "hora": "22:30",
    "ubicacion": "Santiago, Chile",
    "cantidad": 3,
    "forma": "Disco",
    "observaciones": "Luces rojas intermitentes",
    "registrado_por": "Juan Pérez"
  }'
```

### Actualizar un avistamiento
```bash
curl -X PUT http://localhost:8000/avistamientos/1 \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-05-15",
    "hora": "23:00",
    "ubicacion": "Valparaíso, Chile",
    "cantidad": 5,
    "forma": "Triángulo",
    "observaciones": "Objeto silencioso de gran tamaño",
    "registrado_por": "María López"
  }'
```

### Eliminar un avistamiento
```bash
curl -X DELETE http://localhost:8000/avistamientos/1
```

---

## Probar desde fuera de la EC2 (reemplazar IP)

Reemplaza `<IP>` con la IP pública obtenida arriba.

### Health check
```bash
curl http://<IP>:8000/health
```

### Listar todos los avistamientos
```bash
curl http://<IP>:8000/avistamientos
```

### Obtener un avistamiento por ID
```bash
curl http://<IP>:8000/avistamientos/1
```

### Crear un avistamiento
```bash
curl -X POST http://<IP>:8000/avistamientos \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-05-15",
    "hora": "22:30",
    "ubicacion": "Santiago, Chile",
    "cantidad": 3,
    "forma": "Disco",
    "observaciones": "Luces rojas intermitentes",
    "registrado_por": "Juan Pérez"
  }'
```

### Actualizar un avistamiento
```bash
curl -X PUT http://<IP>:8000/avistamientos/1 \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-05-15",
    "hora": "23:00",
    "ubicacion": "Valparaíso, Chile",
    "cantidad": 5,
    "forma": "Triángulo",
    "observaciones": "Objeto silencioso de gran tamaño",
    "registrado_por": "María López"
  }'
```

### Eliminar un avistamiento
```bash
curl -X DELETE http://<IP>:8000/avistamientos/1
```

---

## Swagger UI

Interfaz visual para explorar y probar todos los endpoints:

```
http://<IP>:8000/docs
```

---

## Ver logs del servicio en la EC2

```bash
# Estado del servicio
sudo systemctl status ovnis-api

# Logs en tiempo real
sudo journalctl -u ovnis-api -f

# Últimas 50 líneas
sudo journalctl -u ovnis-api -n 50 --no-pager
```

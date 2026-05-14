# Frontend React — Google Cloud Run

**Curso:** Arquitectura Multicloud · INACAP  
**Objetivo:** Desplegar una aplicación React en Google Cloud Run usando Docker, ejecutando cada comando desde Cloud Shell.

---

## Requisitos previos

- Cuenta de Google con acceso a [Google Cloud Console](https://console.cloud.google.com)
- Un proyecto de GCP creado (el docente indicará el Project ID)
- Sin instalaciones locales — todo se hace desde el navegador

---

## Paso 1 — Abrir Cloud Shell

1. Ingresa a **[console.cloud.google.com](https://console.cloud.google.com)**
2. En la barra superior, haz clic en el ícono **`>_`** (Activate Cloud Shell)
3. Espera que la terminal aparezca en la parte inferior de la pantalla

> Cloud Shell ya tiene instalado `gcloud`, `docker`, `node` y `git`. No necesitas instalar nada.

---

## Paso 2 — Clonar el repositorio

En la terminal de Cloud Shell, ejecuta:

```bash
git clone https://github.com/USUARIO/REPOSITORIO.git
```

Luego entra a la carpeta del proyecto:

```bash
cd REPOSITORIO/frontend_cloud_run
```

Verifica que los archivos están ahí:

```bash
ls
```

Deberías ver: `Dockerfile`, `nginx.conf`, `src/`, `package.json`, etc.

---

## Paso 3 — Configurar el proyecto de GCP

Reemplaza `TU-PROJECT-ID` con el ID de tu proyecto (el docente lo entrega):

```bash
gcloud config set project TU-PROJECT-ID
```

Verifica que quedó configurado correctamente:

```bash
gcloud config get-value project
```

---

## Paso 4 — Habilitar las APIs necesarias

Cloud Run, Artifact Registry y Cloud Build requieren que sus APIs estén activas:

```bash
gcloud services enable run.googleapis.com
```

```bash
gcloud services enable artifactregistry.googleapis.com
```

```bash
gcloud services enable cloudbuild.googleapis.com
```

> Cada comando puede tardar 10–20 segundos. Espera que termine antes de ejecutar el siguiente.

---

## Paso 5 — Crear el repositorio de imágenes Docker

Artifact Registry es el servicio de GCP para almacenar imágenes Docker.

```bash
gcloud artifacts repositories create inacap-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Repositorio Docker INACAP"
```

Confirma que se creó:

```bash
gcloud artifacts repositories list --location=us-central1
```

---

## Paso 6 — Construir la imagen Docker en la nube

En lugar de construir localmente, usamos **Cloud Build** para que GCP construya la imagen directamente.

Primero define la URL completa de tu imagen (reemplaza `TU-PROJECT-ID`):

```bash
export PROJECT_ID=$(gcloud config get-value project)
export IMAGE_URL="us-central1-docker.pkg.dev/$PROJECT_ID/inacap-repo/inacap-frontend:latest"
```

Verifica que la variable quedó correcta:

```bash
echo $IMAGE_URL
```

Ahora construye y sube la imagen (este comando puede tardar 2–3 minutos):

```bash
gcloud builds submit --tag $IMAGE_URL .
```

> Cloud Build lee el `Dockerfile`, compila la app React y guarda la imagen en Artifact Registry.

Verifica que la imagen quedó guardada:

```bash
gcloud artifacts docker images list us-central1-docker.pkg.dev/$PROJECT_ID/inacap-repo
```

---

## Paso 7 — Desplegar en Cloud Run

```bash
gcloud run deploy inacap-frontend \
  --image=$IMAGE_URL \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080
```

Cuando pregunte **"Do you want to continue?"** escribe `Y` y presiona Enter.

Al terminar verás una línea como esta:

```
Service URL: https://inacap-frontend-xxxxxxxxxx-uc.a.run.app
```

**Copia esa URL** — es la dirección pública de tu aplicación.

---

## Paso 8 — Verificar en el navegador

Abre una nueva pestaña en tu navegador y pega la URL que copiaste en el paso anterior.

Deberías ver la aplicación React funcionando con:
- El título **"Frontend en Cloud Run"**
- Un contador interactivo
- Tarjetas con información sobre las tecnologías usadas

---

## Paso 9 — Revisar el servicio desplegado

Desde Cloud Shell puedes consultar información de tu servicio:

Ver la URL de tu servicio:
```bash
gcloud run services describe inacap-frontend \
  --region=us-central1 \
  --format="value(status.url)"
```

Ver los logs del contenedor:
```bash
gcloud run services logs read inacap-frontend \
  --region=us-central1 \
  --tail=30
```

Ver cuántas revisiones (versiones) tienes desplegadas:
```bash
gcloud run revisions list \
  --service=inacap-frontend \
  --region=us-central1
```

---

## Cómo funciona el Dockerfile

```
# Etapa 1 — Build
FROM node:20-alpine AS builder
  → Instala dependencias (npm install)
  → Compila React (npm run build)
  → Genera archivos estáticos en /dist

# Etapa 2 — Producción
FROM nginx:1.27-alpine
  → Copia solo la carpeta /dist
  → Sirve los archivos con Nginx en el puerto 8080
  → Imagen final ~25 MB (sin Node.js)
```

Este patrón se llama **multi-stage build**: la imagen de producción es pequeña porque descarta todo lo que solo se necesita para compilar.

---

## Resumen de comandos

| # | Comando | Qué hace |
|---|---|---|
| 1 | `git clone ...` | Descarga el proyecto |
| 2 | `gcloud config set project ID` | Apunta al proyecto GCP |
| 3 | `gcloud services enable ...` | Activa las APIs |
| 4 | `gcloud artifacts repositories create ...` | Crea el registro Docker |
| 5 | `gcloud builds submit --tag ... .` | Construye y sube la imagen |
| 6 | `gcloud run deploy ...` | Despliega el contenedor |

---

## Solución de problemas

**No aparece la URL al final del deploy**
```bash
gcloud run services describe inacap-frontend \
  --region=us-central1 \
  --format="value(status.url)"
```

**Error "Permission denied" en las APIs**  
Asegúrate de haber ejecutado los tres comandos `gcloud services enable` del Paso 4.

**El build falla**  
Verifica que estás dentro de la carpeta correcta:
```bash
pwd
ls Dockerfile
```

**No sé mi Project ID**
```bash
gcloud projects list
```

---

## Limpiar recursos al terminar

Para no generar costos, elimina el servicio cuando termines la práctica:

```bash
gcloud run services delete inacap-frontend --region=us-central1
```

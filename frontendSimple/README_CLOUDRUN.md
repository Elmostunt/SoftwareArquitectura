# Frontend Simple — Despliegue en Google Cloud Run

Cloud Run ejecuta contenedores Docker sin necesidad de administrar servidores.
La URL pública se genera automáticamente con HTTPS incluido.

A diferencia del despliegue en Compute Engine, aquí **no se configura ninguna VM**:
Google administra toda la infraestructura y el servicio escala automáticamente.

---

## Requisitos previos

- Cuenta en Google Cloud con un proyecto activo
- `gcloud` CLI instalado en tu máquina local → [Instrucciones](https://cloud.google.com/sdk/docs/install)
- Docker instalado en tu máquina local → [Instrucciones](https://docs.docker.com/get-docker/)

---

## Paso 1 — Autenticarse y configurar el proyecto

```bash
gcloud auth login
```
> Abre el navegador para que inicies sesión con tu cuenta de Google Cloud.
> Después de autenticarte, `gcloud` usará esas credenciales para todos los comandos.

```bash
gcloud config set project <ID_DE_TU_PROYECTO>
```
> Le indica a `gcloud` en qué proyecto de GCP trabajar.
> El ID del proyecto lo encuentras en la consola de GCP, en la barra superior (ej: `mi-proyecto-123456`).
> No confundir con el nombre del proyecto; el ID es único y no tiene espacios.

```bash
gcloud config get-value project
```
> Verifica que el proyecto quedó configurado correctamente.
> Debe mostrar el ID que acabas de escribir.

---

## Paso 2 — Habilitar los servicios necesarios

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```
> Activa tres APIs de GCP que se necesitan para este despliegue:
> - `run.googleapis.com` — el servicio de Cloud Run donde se ejecutará el contenedor.
> - `artifactregistry.googleapis.com` — el registro privado donde se guardará la imagen Docker.
> - `cloudbuild.googleapis.com` — el servicio que construye la imagen Docker en la nube (sin necesitar Docker local).
> Este comando puede tardar hasta 1 minuto.

---

## Paso 3 — Crear el repositorio en Artifact Registry

```bash
gcloud artifacts repositories create ovnis-repo \
  --repository-format=docker \
  --location=us-central1
```
> Crea un repositorio de imágenes Docker dentro de Artifact Registry.
> `ovnis-repo` es el nombre del repositorio (puedes cambiarlo).
> `--repository-format=docker` indica que almacenará imágenes Docker.
> `--location=us-central1` es la región donde se guardará (debe coincidir con la región de Cloud Run).

---

## Paso 4 — Configurar la URL del backend ⚠️ PASO CRÍTICO

La URL del Load Balancer de AWS debe pasarse en el momento de construir la imagen.
Usamos un **build argument** de Docker para que nginx la use como destino del proxy inverso.
El frontend siempre llama a `/api/*` (URL relativa); nginx recibe esa petición y la reenvía al ALB de AWS.

Guardar el DNS del ALB en una variable:
```bash
export ALB_DNS="http://ovnis-alb-1234567890.us-east-1.elb.amazonaws.com"
```
> Reemplaza el valor con el DNS real de tu Load Balancer.
> Lo encuentras en: **AWS Console → EC2 → Load Balancers → ovnis-alb → DNS name**

---

## Paso 5 — Construir y subir la imagen Docker

Este proyecto ya incluye el `Dockerfile` y `nginx.conf` necesarios.
Usamos **Cloud Build** para construir la imagen directamente en la nube, sin necesitar Docker instalado localmente.

Primero guarda el ID del proyecto:
```bash
export PROJECT_ID=$(gcloud config get-value project)
```

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_API_PROXY_URL="$ALB_DNS",_IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend" \
  .
```
> `--config cloudbuild.yaml` indica a Cloud Build que use el archivo de configuración incluido en el proyecto.
> `_API_PROXY_URL` pasa la URL del ALB a nginx (para que haga el proxy inverso) y `_IMAGE` define el nombre completo de la imagen en Artifact Registry.
> El `Dockerfile` fija `VITE_API_URL=/api` para que el frontend siempre llame a rutas relativas; nginx resuelve a dónde van.
> Este proceso tarda entre 2 y 4 minutos.

> **Alternativa con Docker local** (si tienes Docker instalado en tu máquina):
> ```bash
> docker build --build-arg API_PROXY_URL="$ALB_DNS" -t ovnis-frontend .
> ```

---

## Paso 6 — Desplegar en Cloud Run

```bash
gcloud run deploy ovnis-frontend \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```
> Crea el servicio en Cloud Run a partir de la imagen que subiste.
> - `ovnis-frontend` — nombre del servicio en Cloud Run.
> - `--image` — ruta completa a la imagen en Artifact Registry (la misma del paso anterior).
> - `--platform managed` — Cloud Run administrado por Google (sin Kubernetes propio).
> - `--region us-central1` — región donde corre el servicio.
> - `--allow-unauthenticated` — hace el servicio **público**: cualquier persona con la URL puede acceder sin login.
>
> Al terminar, el comando imprime la URL pública del servicio. Ejemplo:
> `Service URL: https://ovnis-frontend-xxxxxxxxxx-uc.a.run.app`

---

## Paso 7 — Verificar

Abrir la URL que mostró el comando anterior en el navegador:
```
https://ovnis-frontend-xxxxxxxxxx-uc.a.run.app
```
> La URL cambia en cada proyecto. Cópiala directamente de la salida del comando anterior.
> La aplicación debe mostrar la tabla de avistamientos de OVNIs cargados desde AWS, con HTTPS activo.

Para consultar la URL en cualquier momento:
```bash
gcloud run services describe ovnis-frontend \
  --region us-central1 \
  --format='value(status.url)'
```

---

## Paso 8 — Actualizar el despliegue (tras cambios en el código)

Si modificas algo en el código fuente, debes reconstruir la imagen y redesplegar:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_API_PROXY_URL="$ALB_DNS",_IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend" \
  .
```

```bash
gcloud run deploy ovnis-frontend \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-frontend \
  --region us-central1
```
> Cloud Run hace el cambio sin tiempo de inactividad (zero-downtime).

---

## Solución de problemas

| Síntoma | Solución |
|---------|----------|
| `Permission denied` al habilitar APIs | Verificar que tienes rol de Owner o Editor en el proyecto |
| `Build failed` en Cloud Build | Revisar los logs con `gcloud builds list` y `gcloud builds log <ID>` |
| La URL devuelve `403 Forbidden` | Falta el flag `--allow-unauthenticated` al desplegar |
| La URL devuelve `404` en rutas internas | Verificar que `nginx.conf` tiene `try_files $uri $uri/ /index.html` |
| Imagen no encontrada al desplegar | El tag de la imagen en `--image` no coincide con el que se usó en `builds submit` |

---

## Comparación: Compute Engine vs Cloud Run

| Aspecto             | Compute Engine                  | Cloud Run                          |
|---------------------|---------------------------------|------------------------------------|
| Administración      | Tú gestionas la VM y Nginx      | Google gestiona todo               |
| Costo en reposo     | La VM cobra aunque no haya tráfico | Solo cobra por solicitudes recibidas |
| HTTPS               | Manual (necesitas Certbot)      | Automático e incluido              |
| URL                 | IP pública (cambia al reiniciar)| URL fija con dominio de Google     |
| Escalado            | Manual                          | Automático                         |
| Tiempo de despliegue| ~10 minutos (VM + Nginx + build)| ~3 minutos (solo build + deploy)   |

---

## Comandos útiles

```bash
gcloud run services list --region us-central1 --filter="metadata.name:ovnis-frontend"
```
> Lista todos los servicios de Cloud Run en la región.

```bash
gcloud run services describe ovnis-frontend --region us-central1
```
> Muestra detalles completos del servicio: URL, imagen, configuración y estado.

```bash
gcloud run revisions list --service ovnis-frontend --region us-central1
```
> Lista todas las versiones desplegadas del servicio.
> Cloud Run guarda el historial de revisiones, lo que permite hacer rollback si algo falla.

```bash
gcloud run services delete ovnis-frontend --region us-central1
```
> Elimina el servicio de Cloud Run completamente.
> Útil para no generar costos cuando el laboratorio termina.

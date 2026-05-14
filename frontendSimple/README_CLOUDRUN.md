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

  
Este proyecto ya incluye el `Dockerfile` y `nginx.conf` necesarios.
Usamos **Cloud Build** para construir la imagen directamente en la nube, sin necesitar Docker instalado localmente.

Primero construye el ID del proyecto en una variable para no repetirlo:
```bash
export PROJECT_ID=$(gcloud config get-value project)
```
> Guarda el ID del proyecto en la variable `PROJECT_ID` para usarla en los comandos siguientes.
> `$(...)` ejecuta el comando interno y pone su resultado en la variable.

```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-simple \
  .
```
> Sube el código fuente de la carpeta actual (`.`) a Cloud Build y construye la imagen Docker ahí.
> `--tag` es el nombre completo de la imagen en Artifact Registry. El formato es:
> `REGION-docker.pkg.dev/PROYECTO/REPOSITORIO/NOMBRE_IMAGEN`
> Cloud Build lee el `Dockerfile` del proyecto, ejecuta las dos etapas (build con Node, serve con Nginx)
> y guarda la imagen terminada en Artifact Registry.
> Este proceso tarda entre 2 y 4 minutos.

---

## Paso 5 — Desplegar en Cloud Run

```bash
gcloud run deploy ovnis-simple \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-simple \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```
> Crea el servicio en Cloud Run a partir de la imagen que subiste.
> - `ovnis-simple` — nombre del servicio en Cloud Run.
> - `--image` — ruta completa a la imagen en Artifact Registry (la misma del paso anterior).
> - `--platform managed` — Cloud Run administrado por Google (sin Kubernetes propio).
> - `--region us-central1` — región donde corre el servicio.
> - `--allow-unauthenticated` — hace el servicio **público**: cualquier persona con la URL puede acceder sin login.
>
> Al terminar, el comando imprime la URL pública del servicio. Ejemplo:
> `Service URL: https://ovnis-simple-xxxxxxxxxx-uc.a.run.app`

---

## Paso 6 — Verificar

Abrir la URL que mostró el comando anterior en el navegador:
```
https://ovnis-simple-xxxxxxxxxx-uc.a.run.app
```
> La URL cambia en cada proyecto. Cópiala directamente de la salida del comando anterior.
> La aplicación debe mostrar la tabla de avistamientos de OVNIs con HTTPS activo.

Para consultar la URL en cualquier momento:
```bash
gcloud run services describe ovnis-simple \
  --region us-central1 \
  --format='value(status.url)'
```
> Muestra solo la URL del servicio sin información extra.

---

## Paso 7 — Actualizar el despliegue (tras cambios en el código)

Si modificas algo en el código fuente, debes reconstruir la imagen y redesplegar:

```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-simple \
  .
```
> Construye una nueva versión de la imagen con los cambios.

```bash
gcloud run deploy ovnis-simple \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/ovnis-repo/ovnis-simple \
  --region us-central1
```
> Despliega la nueva imagen. Cloud Run hace el cambio sin tiempo de inactividad (zero-downtime).

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
gcloud run services list --region us-central1
```
> Lista todos los servicios de Cloud Run en la región.

```bash
gcloud run services describe ovnis-simple --region us-central1
```
> Muestra detalles completos del servicio: URL, imagen, configuración y estado.

```bash
gcloud run revisions list --service ovnis-simple --region us-central1
```
> Lista todas las versiones desplegadas del servicio.
> Cloud Run guarda el historial de revisiones, lo que permite hacer rollback si algo falla.

```bash
gcloud run services delete ovnis-simple --region us-central1
```
> Elimina el servicio de Cloud Run completamente.
> Útil para no generar costos cuando el laboratorio termina.

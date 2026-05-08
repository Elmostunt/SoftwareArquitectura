# Frontend Simple — Ejecución con Docker

Esta versión **solo corre dentro de un contenedor Docker**.
No se instala Node.js ni Nginx directamente en el sistema; Docker se encarga de todo.

Los datos se guardan en memoria del navegador. Al recargar la página vuelven a los valores iniciales.

---

## Requisitos previos

- Docker instalado en tu máquina → [docs.docker.com/get-docker](https://docs.docker.com/get-docker/)

---

## Paso 1 — Construir la imagen

Desde la carpeta `frontendSimple/`, ejecutar:

```bash
docker build -t ovnis-simple .
```
> `docker build` lee el `Dockerfile` del directorio actual y construye una imagen.
> `-t ovnis-simple` le asigna el nombre `ovnis-simple` a la imagen resultante.
> El `.` al final indica que el contexto de construcción es la carpeta actual
> (Docker envía todos los archivos de esta carpeta al proceso de build).
>
> El build ocurre en dos etapas definidas en el `Dockerfile`:
> 1. Un contenedor con Node.js instala las dependencias y ejecuta `npm run build`.
> 2. Un contenedor con Nginx copia solo el resultado del build y lo prepara para servir.
> La imagen final solo contiene Nginx y los archivos estáticos, **sin Node.js**.

---

## Paso 2 — Ejecutar el contenedor

```bash
docker run -p 8080:8080 ovnis-simple
```
> `docker run` crea y arranca un contenedor a partir de la imagen `ovnis-simple`.
> `-p 8080:8080` conecta el puerto 8080 de tu máquina con el puerto 8080 del contenedor.
> El primer `8080` es el puerto en tu máquina (puedes cambiarlo si está ocupado).
> El segundo `8080` es el puerto donde Nginx escucha dentro del contenedor (definido en `nginx.conf`).

Abrir en el navegador:
```
http://localhost:8080
```
> Deberías ver la tabla de avistamientos de OVNIs con los 5 registros precargados.

Para detener el contenedor presionar `Ctrl+C` en la terminal.

---

## Paso 3 — Ejecutar en segundo plano (opcional)

```bash
docker run -d -p 8080:8080 --name ovnis-simple ovnis-simple
```
> `-d` (detached) corre el contenedor en segundo plano sin bloquear la terminal.
> `--name ovnis-simple` le da un nombre al contenedor para manejarlo más fácilmente.

```bash
docker stop ovnis-simple
```
> Detiene el contenedor que se llama `ovnis-simple`.

```bash
docker start ovnis-simple
```
> Vuelve a iniciar el contenedor detenido sin tener que recrearlo.

```bash
docker rm ovnis-simple
```
> Elimina el contenedor. Hay que detenerlo primero, o usar `docker rm -f ovnis-simple`.

---

## Paso 4 — Reconstruir tras cambios en el código

Si modificas algún archivo fuente, debes reconstruir la imagen para que los cambios se reflejen:

```bash
docker build -t ovnis-simple .
```
> Vuelve a ejecutar las dos etapas del `Dockerfile`. Docker reutiliza capas cacheadas
> cuando los archivos no cambiaron, por lo que las reconstrucciones suelen ser más rápidas.

```bash
docker run -p 8080:8080 ovnis-simple
```
> Corre el contenedor con la imagen recién actualizada.

---

## Estructura del Dockerfile

```
Etapa 1 (build)          Etapa 2 (serve)
─────────────────         ─────────────────
node:20-alpine            nginx:alpine
  npm install    ──────►    /usr/share/nginx/html
  npm run build             nginx.conf
  → dist/                   puerto 8080
```
> El build en dos etapas mantiene la imagen final pequeña.
> Node.js solo se usa durante la compilación y no queda en la imagen final.

---

## Comandos útiles

```bash
docker images
```
> Lista todas las imágenes Docker disponibles en tu máquina. Muestra el nombre, tag y tamaño.

```bash
docker ps
```
> Lista los contenedores que están corriendo en este momento.

```bash
docker ps -a
```
> Lista todos los contenedores, incluyendo los que están detenidos.

```bash
docker logs ovnis-simple
```
> Muestra los logs del contenedor. Útil para ver si Nginx tuvo algún error al iniciar.

```bash
docker rmi ovnis-simple
```
> Elimina la imagen `ovnis-simple` del sistema local.
> Útil para liberar espacio o forzar una reconstrucción desde cero.

---

## Despliegue en la nube

Para desplegar este contenedor de forma pública ver [README_CLOUDRUN.md](README_CLOUDRUN.md).

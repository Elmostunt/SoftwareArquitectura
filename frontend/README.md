# Frontend — Instalación en Google Cloud Compute Engine

## Requisitos previos

- Cuenta en Google Cloud con un proyecto activo
- La IP pública del EC2 de AWS donde corre el backend (FastAPI)

---

## Paso 1 — Crear la VM en Compute Engine

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Menú → **Compute Engine → VM instances → Create Instance**
3. Configurar:

| Campo         | Valor                                  |
|---------------|----------------------------------------|
| Name          | `ovnis-frontend`                       |
| Region        | `us-central1` (o la más cercana a AWS) |
| Machine type  | `e2-micro` (Free Tier)                 |
| Boot disk     | Ubuntu 22.04 LTS                       |
| Firewall      | ✅ Allow HTTP traffic                  |

4. Clic en **Create** y esperar ~1 minuto.
5. Anotar la **External IP** que aparece en la lista de instancias.

---

## Paso 2 — Conectarse a la VM

Desde la consola de GCP, clic en el botón **SSH** de la instancia.

O desde tu terminal local:
```bash
gcloud compute ssh ovnis-frontend --zone=us-central1-a
```
> `gcloud compute ssh` abre una sesión SSH hacia la VM usando las credenciales de tu cuenta de Google Cloud.
> `--zone` indica en qué zona geográfica está la VM (debe coincidir con la que elegiste al crearla).

---

## Paso 3 — Instalar Node.js y Nginx

Ejecutar dentro de la VM:

```bash
sudo apt update && sudo apt upgrade -y
```
> `apt update` descarga la lista de paquetes disponibles desde los repositorios de Ubuntu.
> `apt upgrade -y` instala las actualizaciones pendientes. El `-y` responde "sí" automáticamente a todas las confirmaciones.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```
> Descarga y ejecuta el script oficial de NodeSource que agrega el repositorio de Node.js 20 LTS al sistema.
> Sin este paso, `apt` solo instalaría una versión muy antigua de Node.js.
> `-fsSL` hace que curl falle silenciosamente en errores y siga redirecciones.

```bash
sudo apt install -y nodejs nginx git
```
> Instala los tres paquetes necesarios:
> - `nodejs` — el runtime de JavaScript para ejecutar el proyecto y compilarlo.
> - `nginx` — el servidor web que va a servir los archivos estáticos del frontend.
> - `git` — para clonar el repositorio (si usas la opción A del paso 4).

```bash
node --version
npm --version
```
> Verifica que Node.js y npm quedaron instalados correctamente.
> Deberías ver `v20.x.x` y `10.x.x` respectivamente.

---

## Paso 4 — Subir el código del frontend

**Opción A — desde un repositorio Git:**
```bash
git clone <URL_DE_TU_REPOSITORIO>
```
> Descarga una copia completa del repositorio desde GitHub u otro servidor Git.

```bash
cd <nombre-repo>/frontend
```
> Entra a la carpeta `frontend` dentro del repositorio recién clonado.

**Opción B — copiar desde tu máquina local:**
```bash
gcloud compute scp --recurse ./frontend ovnis-frontend:~ --zone=us-central1-a
```
> **Ejecutar en tu máquina local, NO en la VM.**
> `scp` copia archivos de forma segura entre tu computador y la VM.
> `--recurse` copia la carpeta completa con todo su contenido.
> `ovnis-frontend:~` indica que el destino es la carpeta home (`~`) de la VM llamada `ovnis-frontend`.

Luego dentro de la VM:
```bash
cd ~/frontend
```
> Entra a la carpeta frontend que acabas de copiar.

---

## Paso 5 — Configurar la URL del backend

```bash
cp .env.example .env.local
```
> Crea el archivo de configuración real copiando la plantilla de ejemplo.
> Vite carga automáticamente `.env.local` al momento de construir el proyecto.

```bash
nano .env.local
```
> Abre el archivo con el editor de texto Nano para editarlo.

Escribir la IP pública del EC2 de AWS:
```
VITE_API_URL=http://<IP_PUBLICA_EC2_AWS>:8000
```
> Esta variable le indica al frontend dónde está el backend.
> `VITE_` es el prefijo obligatorio para que Vite incluya la variable en el build del navegador.
> Reemplaza `<IP_PUBLICA_EC2_AWS>` con la IP real de tu instancia EC2.

Guardar con `Ctrl+O`, Enter, `Ctrl+X`.
> `Ctrl+O` escribe el archivo, Enter confirma el nombre, `Ctrl+X` cierra el editor.

---

## Paso 6 — Instalar dependencias y construir

```bash
npm install
```
> Lee el archivo `package.json` y descarga todas las librerías que necesita el proyecto (React, Vite, etc.) en la carpeta `node_modules/`.

```bash
npm run build
```
> Compila y empaqueta el código fuente de React en archivos HTML, CSS y JavaScript optimizados.
> El resultado queda en la carpeta `dist/`, que es lo que se sube al servidor web.
> En este momento Vite inyecta `VITE_API_URL` en el JavaScript generado.

---

## Paso 7 — Servir con Nginx

```bash
sudo rm -rf /var/www/html/*
```
> Elimina el contenido por defecto de Nginx (la página de bienvenida de Ubuntu).
> `-rf` borra de forma recursiva y forzada sin pedir confirmación.

```bash
sudo cp -r dist/* /var/www/html/
```
> Copia todos los archivos del build (`dist/`) al directorio raíz de Nginx.
> Nginx servirá estos archivos cuando alguien visite la IP pública de la VM.

```bash
sudo chown -R www-data:www-data /var/www/html
```
> Cambia el propietario de los archivos al usuario `www-data`, que es el usuario con el que corre Nginx.
> Esto evita errores de permisos al leer los archivos.

```bash
sudo nano /etc/nginx/sites-available/default
```
> Abre el archivo de configuración principal de Nginx para editarlo.

Reemplazar todo el contenido con:
```nginx
server {
    listen 80;
    # Nginx escucha en el puerto 80 (HTTP estándar).

    server_name _;
    # El guión bajo (_) significa "cualquier nombre de dominio o IP".
    # Acepta peticiones sin importar cómo lleguen (por IP, por dominio, etc.).

    root /var/www/html;
    # Carpeta donde están los archivos del frontend (el build de React).

    index index.html;
    # Archivo que se sirve cuando se pide la raíz del sitio.

    location / {
        try_files $uri $uri/ /index.html;
        # Intenta servir el archivo pedido ($uri).
        # Si no existe, sirve index.html en su lugar.
        # Esto es necesario para que React maneje sus propias rutas
        # sin que Nginx devuelva un error 404.
    }
}
```

```bash
sudo nginx -t
```
> Verifica que la configuración de Nginx no tiene errores de sintaxis antes de aplicarla.
> Si muestra `syntax is ok` y `test is successful`, está todo correcto.

```bash
sudo systemctl reload nginx
```
> Recarga la configuración de Nginx sin detener el servidor.
> A diferencia de `restart`, no interrumpe las conexiones activas.

---

## Paso 8 — Verificar

Abrir en el navegador:
```
http://<EXTERNAL_IP_DE_LA_VM>
```
> Reemplaza con la External IP que anotaste en el Paso 1.
> La aplicación debe mostrar la tabla de avistamientos de OVNIs con los datos del backend.

---

## Solución de problemas

| Síntoma | Solución |
|---------|----------|
| La página no carga | Verificar que Nginx está activo: `sudo systemctl status nginx` |
| Tabla vacía o error de red | Revisar `VITE_API_URL` en `.env.local` y reconstruir con `npm run build` |
| `Failed to fetch` en consola del navegador (F12) | El puerto 8000 del EC2 no está abierto en su Security Group |
| Error CORS en consola del navegador | Verificar que el backend tiene `allow_origins=["*"]` en `main.py` |

---

## Comandos útiles

```bash
sudo tail -f /var/log/nginx/error.log
```
> Muestra los últimos errores de Nginx en tiempo real. Útil para diagnosticar por qué no carga la página.

```bash
sudo systemctl restart nginx
```
> Detiene y vuelve a iniciar Nginx. Usar cuando `reload` no es suficiente.

```bash
curl http://<IP_EC2_AWS>:8000/health
```
> Verifica desde la VM que el backend de AWS responde.
> Si devuelve `{"status":"ok"}`, la conectividad entre nubes está funcionando.

```bash
npm run build && sudo cp -r dist/* /var/www/html/
```
> Reconstruye el proyecto y lo despliega en un solo comando.
> Útil cuando cambias algo en el código o en las variables de entorno.

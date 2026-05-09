# Frontend HTML — Instalación en Google Cloud Compute Engine con Apache

Esta versión es un único archivo `index.html` con HTML, CSS y JavaScript.
No requiere Node.js, npm, Docker ni ningún proceso de compilación.
Apache simplemente entrega el archivo al navegador tal como está.

---

## Antes de comenzar — Acceso al proyecto del profesor

No necesitas crear una cuenta de Google Cloud ni un proyecto propio.
El profesor te agregará como usuario a su proyecto de GCP y te compartirá:

- Tu cuenta Gmail con la que fuiste invitado
- El **ID del proyecto** (ejemplo: `arquitectura-multicloud-2024`)

### Aceptar la invitación

1. Revisa tu correo Gmail con el que el profesor te registró.
2. Busca un correo de `google-cloud-noreply@google.com` con el asunto *"You've been added to a Google Cloud project"*.
3. Haz clic en el enlace del correo o ve directamente a [console.cloud.google.com](https://console.cloud.google.com).
4. Inicia sesión con esa cuenta Gmail. Deberías ver el proyecto del profesor en el selector de proyectos.

> Si no ves el proyecto, asegúrate de haber iniciado sesión con el Gmail correcto.
> Puedes cambiar de cuenta en la esquina superior derecha de la consola.

---

## Paso 1 — Crear la VM en Compute Engine

> ⚠️ Como varios alumnos trabajan en el **mismo proyecto**, el nombre de tu VM debe ser único.
> Usa tu nombre o iniciales para diferenciarlo: `ovnis-html-juan`, `ovnis-html-mgg`, etc.

1. En la consola de GCP, asegúrate de tener seleccionado el **proyecto del profesor** en el selector de la barra superior.
2. Menú → **Compute Engine → VM instances → Create Instance**
3. Configurar:

| Campo        | Valor                                        |
|--------------|----------------------------------------------|
| Name         | `ovnis-html-tunombre` (usa tu nombre real)   |
| Region       | `us-central1`                                |
| Machine type | `e2-micro`                                   |
| Boot disk    | Ubuntu 22.04 LTS                             |
| Firewall     | ✅ Allow HTTP traffic                        |

4. Clic en **Create** y esperar ~1 minuto.
5. Anotar la **External IP** que aparece en la lista de instancias. Esa es **tu** IP.

> Verás las VMs de tus compañeros también listadas en la misma pantalla. No las toques.

---

## Paso 2 — Conectarse a la VM

La forma más simple es desde la consola web: clic en el botón **SSH** que aparece junto a tu VM en la lista.

Se abre una terminal en el navegador, conectada directamente a tu VM. No necesitas instalar nada adicional.

Si prefieres tu terminal local, primero instala la CLI de Google Cloud:
→ [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)

Luego autenticarte y apuntar al proyecto del profesor:
```bash
gcloud auth login
```
> Abre el navegador para que inicies sesión con el Gmail con el que el profesor te invitó.

```bash
gcloud config set project <ID_DEL_PROYECTO_DEL_PROFESOR>
```
> Le indica a `gcloud` que trabaje en el proyecto del profesor, no en uno propio.
> El ID del proyecto te lo entrega el profesor (ejemplo: `arquitectura-multicloud-2024`).

```bash
gcloud compute ssh ovnis-html-tunombre --zone=us-central1-a
```
> Abre SSH hacia tu VM. Reemplaza `ovnis-html-tunombre` con el nombre exacto que usaste al crearla.
> `--zone` debe coincidir con la zona elegida al crear la VM.

---

## Paso 3 — Instalar Apache

```bash
sudo apt update && sudo apt upgrade -y
```
> `apt update` descarga la lista actualizada de paquetes disponibles en los repositorios de Ubuntu.
> `apt upgrade -y` instala todas las actualizaciones pendientes del sistema operativo.
> El `-y` confirma automáticamente sin pedir intervención del usuario.

```bash
sudo apt install -y apache2
```
> Instala el servidor web Apache2.
> Apache queda activo y habilitado automáticamente después de la instalación.

```bash
sudo systemctl status apache2
```
> Verifica que Apache está corriendo.
> Deberías ver `Active: active (running)` en verde.
> Si abres la External IP de tu VM en el navegador en este punto, verás la página por defecto de Apache.

---

## Paso 4 — Copiar el archivo HTML

**Opción A — desde un repositorio Git:**
```bash
sudo apt install -y git
```
> Instala Git para poder clonar repositorios.

```bash
git clone <URL_DEL_REPOSITORIO_DEL_PROFESOR>
```
> Descarga el repositorio completo a la VM. La URL te la entrega el profesor.

```bash
sudo cp /SoftwareArquitectura/frontendHTML/index.html /var/www/html/index.html
```
> Copia el archivo `index.html` al directorio raíz de Apache.
> `/var/www/html/` es la carpeta que Apache sirve por defecto.

> El archivo reemplaza la página de bienvenida de Apache.

---

## Paso 5 — Ajustar permisos

```bash
sudo chown www-data:www-data /var/www/html/index.html
```
> Cambia el propietario del archivo al usuario `www-data`, con el que corre el proceso de Apache.
> Sin este paso Apache podría tener errores de permisos al intentar leer el archivo.

```bash
sudo chmod 644 /var/www/html/index.html
```
> Define los permisos del archivo:
> - `6` (rw-) — el dueño puede leer y escribir.
> - `4` (r--) — el grupo puede solo leer.
> - `4` (r--) — otros usuarios (incluido Apache al servir la web) pueden solo leer.

---

## Paso 6 — Verificar la configuración de Apache

```bash
sudo apache2ctl configtest
```
> Verifica que la configuración de Apache no tiene errores de sintaxis.
> Debe mostrar `Syntax OK` para continuar.

```bash
sudo systemctl reload apache2
```
> Recarga Apache para aplicar cualquier cambio de configuración sin interrumpir conexiones activas.

---

## Paso 7 — Verificar en el navegador

Abrir en el navegador:
```
http://<EXTERNAL_IP_DE_TU_VM>
```
> Usa la External IP de **tu** VM, no la de un compañero.
> Deberías ver la tabla de avistamientos de OVNIs con los 5 registros precargados.
> Puedes crear, editar y eliminar registros.
> Los cambios son temporales: se pierden al recargar la página porque se guardan en memoria del navegador.

---

## Paso 8 — Actualizar el archivo HTML

Cuando modifiques el `index.html`, solo debes copiarlo de nuevo. No hay compilación ni reinicio:

```bash
sudo cp <ruta>/index.html /var/www/html/index.html
```
> Apache sirve el archivo directamente, por lo que el cambio se refleja de inmediato al recargar el navegador.

---

## Al terminar la clase — Eliminar tu VM

Para no generar costos en el proyecto del profesor, elimina tu VM al terminar:

1. Consola GCP → **Compute Engine → VM instances**
2. Marca la casilla junto a **tu** VM (`ovnis-html-tunombre`)
3. Clic en **Delete** en la barra superior
4. Confirmar

> Elimina solo tu VM. No toques las VMs de tus compañeros ni otros recursos del proyecto.

---

## Solución de problemas

| Síntoma | Solución |
|---------|----------|
| No veo el proyecto del profesor en la consola | Verificar que iniciaste sesión con el Gmail correcto |
| No tengo permisos para crear VMs | Avisar al profesor para que revise el rol asignado en IAM |
| La página no carga | Verificar que la VM tiene Allow HTTP traffic activado |
| Sigue mostrando la página por defecto de Apache | El archivo no se copió a `/var/www/html/index.html` o el nombre es incorrecto |
| Error 403 Forbidden | Revisar permisos: `sudo chmod 644 /var/www/html/index.html` |
| Error 500 Internal Server Error | `sudo tail -f /var/log/apache2/error.log` para ver el detalle |

---

## Comandos útiles

```bash
sudo systemctl status apache2
```
> Muestra si Apache está activo y las últimas líneas de su log de actividad.

```bash
sudo systemctl restart apache2
```
> Detiene y reinicia Apache completamente. Usar cuando `reload` no resuelve el problema.

```bash
sudo tail -f /var/log/apache2/access.log
```
> Muestra en tiempo real cada petición que recibe Apache.
> Útil para confirmar que el navegador está llegando al servidor.

```bash
sudo tail -f /var/log/apache2/error.log
```
> Muestra los errores de Apache en tiempo real. Es el primer lugar donde buscar cuando algo falla.

```bash
ls -la /var/www/html/
```
> Lista los archivos en el directorio raíz de Apache con sus permisos.
> Permite verificar que `index.html` está ahí y tiene los permisos correctos.

---

## Nota para el profesor — Configuración previa de acceso

Antes de la clase, agregar cada cuenta Gmail de alumno al proyecto con el siguiente rol:

1. Consola GCP → **IAM & Admin → IAM → Grant Access**
2. En **New principals**: ingresar el Gmail del alumno
3. En **Role**: seleccionar `Compute Instance Admin (v1)`
4. Clic en **Save**

Este rol permite a los alumnos crear, conectarse y eliminar VMs, sin poder modificar la facturación ni otros recursos del proyecto.

> Si se quiere un acceso más amplio (por ejemplo para que puedan usar otros servicios durante el curso), el rol `Editor` es una alternativa más permisiva pero adecuada para entornos de aprendizaje.

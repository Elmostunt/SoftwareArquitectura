# Glosario — Arquitectura Multicloud
### Evaluación 3 · Sistema de Avistamiento de OVNIs

Todos los conceptos, tecnologías y técnicas empleadas en el proyecto, ordenados por categoría.

---

## Infraestructura y Nube

### VM — Virtual Machine (Máquina Virtual)
Software que emula un computador completo dentro de otro computador físico. La VM tiene su propio sistema operativo, CPU virtual, memoria y disco. En este proyecto, la EC2 de AWS es una VM que corre Amazon Linux 2023. El servidor físico real (host) es administrado por AWS; el alumno solo ve y controla la VM.

```
Servidor físico AWS
├── VM 1 (tu EC2)  ← tú administras esto
├── VM 2 (otro cliente)
└── VM 3 (otro cliente)
```

### EC2 — Elastic Compute Cloud
Servicio de AWS que provee VMs (llamadas "instancias") bajo demanda. "Elastic" significa que puedes escalar la capacidad hacia arriba o abajo según necesites. En el proyecto se usa una instancia `t2.micro` (1 vCPU, 1 GB RAM) con Amazon Linux 2023 para correr el backend FastAPI.

### RDS — Relational Database Service
Servicio administrado de AWS para bases de datos relacionales (MySQL, PostgreSQL, etc.). "Administrado" significa que AWS se encarga de los backups, parches de seguridad y alta disponibilidad — el desarrollador solo interactúa con la base de datos, no con el servidor que la corre. En el proyecto se usa MySQL 8.0 en una instancia `db.t3.micro`.

### AMI — Amazon Machine Image
Plantilla que contiene el sistema operativo y software preinstalado para lanzar una EC2. Es como una "fotografía" del sistema desde la cual se crean instancias. En el proyecto se usa la AMI de **Amazon Linux 2023**, que viene con Python 3.9 incluido.

### VPC — Virtual Private Cloud
Red privada virtual dentro de AWS donde viven tus recursos (EC2, RDS, etc.). Funciona como una red local aislada en la nube. Los recursos dentro del mismo VPC pueden comunicarse entre sí por su IP privada sin salir a Internet. En el proyecto, EC2 y RDS están en el mismo VPC Default para que el backend pueda conectarse a la base de datos internamente.

### Subnet (Subred)
Segmento de red dentro de un VPC. Las subnets públicas tienen acceso a Internet; las privadas no. El EC2 vive en una subnet pública (para recibir tráfico web); RDS está en una subnet privada (sin acceso directo desde Internet).

### Availability Zone (AZ)
Centro de datos físicamente separado dentro de una misma región AWS. Para el ALB se requieren al menos 2 AZs para garantizar alta disponibilidad: si una zona falla, la otra sigue atendiendo tráfico.

### Security Group
Firewall virtual que controla qué tráfico de red puede entrar (inbound) y salir (outbound) de un recurso AWS. Las reglas especifican protocolo, puerto y origen/destino. En el proyecto se usan 3 Security Groups encadenados:

```
ovnis-sg-alb  → permite HTTP:80 desde Internet
ovnis-sg-ec2  → permite TCP:8000 solo desde ovnis-sg-alb
ovnis-sg-rds  → permite MySQL:3306 solo desde ovnis-sg-ec2
```

### ALB — Application Load Balancer
Servicio de AWS que distribuye el tráfico entrante entre múltiples instancias EC2. Opera en la capa 7 (HTTP/HTTPS) y puede enrutar por path, host o cabeceras. En el proyecto actúa como punto de entrada público: recibe peticiones en el puerto 80 y las reenvía al EC2 en el puerto 8000. Tiene su propio DNS estático que no cambia aunque el EC2 se reinicie.

### Target Group (Grupo de Destino)
Conjunto de destinos (instancias EC2, IPs, etc.) hacia donde el ALB envía el tráfico. Incluye la configuración del health check para determinar qué instancias están sanas. En el proyecto: protocolo HTTP, puerto 8000, path de health check `/health`.

### Health Check
Verificación periódica que el ALB hace a cada instancia del Target Group para saber si está operativa. Si la instancia no responde con HTTP 200 al path configurado (`/health`), el ALB la marca como `unhealthy` y deja de enviarle tráfico.

### Elastic IP
Dirección IP pública fija de AWS que puedes asociar a una EC2. A diferencia de la IP pública normal (que cambia cada reinicio), la Elastic IP permanece constante. Útil cuando el frontend necesita apuntar a una IP fija en lugar del DNS del ALB.

### User Data
Script que se ejecuta automáticamente la primera vez que una instancia EC2 arranca. Se pega en el campo "User data" al crear la instancia. En el proyecto, `backend/userdata.sh` automatiza toda la instalación: dependencias, clonado del repo, configuración del servicio systemd y carga de la base de datos.

### Cloud Run
Servicio de Google Cloud que ejecuta contenedores Docker de forma completamente administrada (serverless). No hay VMs ni servidores que administrar — GCP escala automáticamente según el tráfico y cobra solo por las peticiones recibidas. La URL es fija y tiene HTTPS incluido sin configuración adicional.

### Cloud Build
Servicio de Google Cloud que construye imágenes Docker directamente en la nube, sin necesitar Docker instalado localmente. Lee las instrucciones del archivo `cloudbuild.yaml` y ejecuta el build en servidores de GCP.

### Artifact Registry
Repositorio privado de Google Cloud para almacenar imágenes Docker. Similar a Docker Hub pero dentro del ecosistema de GCP, con integración directa con Cloud Build y Cloud Run.

### Cloud Shell
Terminal Linux gratuita que Google provee en el navegador con `gcloud` CLI, `git`, `docker` y otras herramientas preinstaladas. Permite operar GCP sin instalar nada en la máquina local.

### Multicloud
Arquitectura donde una aplicación usa servicios de más de un proveedor de nube simultáneamente. En el proyecto: el backend corre en AWS y el frontend en GCP, comunicándose por Internet a través del ALB.

---

## Contenedores y Virtualización

### Docker
Plataforma para crear, distribuir y ejecutar aplicaciones en contenedores. Un contenedor empaqueta el código junto con todas sus dependencias en una unidad aislada y portable que corre igual en cualquier entorno.

```
Sin Docker:            Con Docker:
"en mi máquina        El mismo contenedor
funciona pero en      corre igual en dev,
producción no"        staging y producción
```

### Contenedor
Unidad de software que empaqueta código y dependencias juntos. A diferencia de una VM, un contenedor no virtualiza hardware ni incluye un sistema operativo completo — comparte el kernel del host y arranca en milisegundos. Más liviano y portable que una VM.

```
VM                        Contenedor
├── Guest OS (2 GB)       ├── App
├── App                   ├── Dependencias
└── Dependencias          └── (comparte el kernel del host)
```

### Dockerfile
Archivo de texto con instrucciones para construir una imagen Docker paso a paso. Cada instrucción crea una capa en la imagen. En el proyecto tiene 2 etapas (multi-stage build): la primera compila el React con Node.js, la segunda sirve los archivos estáticos con nginx.

### Multi-stage Build
Técnica de Docker donde el Dockerfile tiene varias etapas `FROM`. Solo el resultado de la última etapa va en la imagen final, descartando herramientas de compilación que no son necesarias en producción. Resultado: imágenes más pequeñas y seguras.

```
Etapa 1 (build):   node:20-alpine → npm install → npm run build → dist/
Etapa 2 (serve):   nginx:alpine   → copia dist/ → imagen final ~25 MB
                   (node_modules ~200 MB queda fuera)
```

### Imagen Docker
Plantilla inmutable (solo lectura) creada a partir de un Dockerfile. Es como el "molde" del que se crean contenedores. Se almacena en un registry (Artifact Registry, Docker Hub). Una imagen puede dar origen a múltiples contenedores idénticos.

---

## Servidores Web y Proxy

### Nginx
Servidor web de alto rendimiento y proxy inverso de código abierto. En el proyecto actúa como servidor web (sirve los archivos estáticos de React) y como proxy inverso (reenvía las peticiones `/api/*` al ALB de AWS). Es el proceso que corre dentro del contenedor de Cloud Run.

### Proxy Inverso (Reverse Proxy)
Servidor que recibe peticiones de clientes y las reenvía a otros servidores en nombre del cliente. El cliente no sabe con qué servidor está hablando realmente. En el proyecto, nginx recibe `GET /api/avistamientos` del browser y lo reenvía como `GET /avistamientos` al ALB de AWS.

```
SIN PROXY:
Browser ─────────────────────────────► ALB (HTTP)
(falla: mixed content)

CON PROXY INVERSO:
Browser ──HTTPS──► nginx ──HTTP──► ALB
(funciona: el browser solo ve HTTPS)
```

### Mixed Content
Error de seguridad del navegador que ocurre cuando una página cargada por HTTPS intenta hacer peticiones HTTP. Los navegadores modernos bloquean esto para proteger al usuario. En el proyecto se resuelve con el proxy nginx: el browser solo habla HTTPS con Cloud Run, y nginx hace el salto HTTP al ALB internamente.

### systemd
Sistema de inicialización y gestión de servicios de Linux. Permite arrancar procesos automáticamente al iniciar el sistema, reiniciarlos si fallan y ver sus logs. En el proyecto se usa para que `uvicorn` (el servidor de FastAPI) corra como servicio permanente en la EC2.

```bash
sudo systemctl start   ovnis-api   # iniciar
sudo systemctl enable  ovnis-api   # arrancar automáticamente al reiniciar
sudo systemctl status  ovnis-api   # ver estado
sudo journalctl -u ovnis-api -f    # ver logs en tiempo real
```

### uvicorn
Servidor ASGI (Asynchronous Server Gateway Interface) para Python. Es el proceso que ejecuta la aplicación FastAPI y escucha conexiones HTTP. En producción corre en segundo plano gestionado por systemd.

---

## Protocolos y Redes

### HTTP — HyperText Transfer Protocol
Protocolo de comunicación sin estado para transferir datos en la web. Los mensajes tienen un método (GET, POST, PUT, DELETE), una URL, cabeceras y opcionalmente un cuerpo. Opera en el puerto 80 por defecto. En el proyecto, el ALB expone el backend por HTTP.

### HTTPS — HTTP Secure
Versión cifrada de HTTP usando TLS (Transport Layer Security). Todo el contenido viaja cifrado entre el cliente y el servidor. Opera en el puerto 443. Cloud Run provee HTTPS automáticamente para el frontend.

### REST — Representational State Transfer
Estilo arquitectónico para APIs web que usa los métodos HTTP de forma semántica:

| Método | Acción | Ejemplo en el proyecto |
|--------|--------|----------------------|
| GET | Leer | `GET /avistamientos` → listar todos |
| POST | Crear | `POST /avistamientos` → crear nuevo |
| PUT | Actualizar | `PUT /avistamientos/1` → modificar |
| DELETE | Eliminar | `DELETE /avistamientos/1` → borrar |

### JSON — JavaScript Object Notation
Formato ligero de intercambio de datos basado en texto. Es el estándar para las respuestas de APIs REST. El backend FastAPI serializa automáticamente los objetos Python a JSON.

```json
{
  "id": 1,
  "fecha": "2026-05-15",
  "ubicacion": "Santiago",
  "cantidad": 3,
  "forma": "Disco"
}
```

### DNS — Domain Name System
Sistema que traduce nombres de dominio legibles por humanos a direcciones IP. El ALB de AWS tiene un nombre DNS como `ovnis-alb-xxx.us-east-1.elb.amazonaws.com` que apunta a su IP. Los navegadores usan DNS para saber a qué IP conectarse.

### Puerto (Port)
Número que identifica un proceso o servicio específico dentro de un servidor. Un mismo servidor puede tener muchos servicios corriendo en diferentes puertos. En el proyecto:
- Puerto `22` → SSH (acceso remoto al EC2)
- Puerto `80` → HTTP del ALB
- Puerto `3306` → MySQL en RDS
- Puerto `8000` → FastAPI en EC2
- Puerto `8080` → nginx en el contenedor de Cloud Run

### TCP — Transmission Control Protocol
Protocolo de transporte que garantiza la entrega ordenada y sin errores de los datos. HTTP, HTTPS y MySQL usan TCP como base.

### CORS — Cross-Origin Resource Sharing
Mecanismo de seguridad del navegador que restringe las peticiones HTTP a dominios distintos del origen de la página. El backend FastAPI tiene CORS configurado con `allow_origins=["*"]` para permitir que el frontend (en GCP) pueda llamarlo desde AWS.

### IP Pública / IP Privada
- **IP Pública:** dirección enrutable en Internet, accesible desde cualquier lugar.
- **IP Privada:** dirección solo accesible dentro de la red interna (VPC). RDS solo tiene IP privada — no se puede acceder desde Internet, solo desde el EC2 que está en el mismo VPC.

---

## Bases de Datos

### MySQL
Sistema de gestión de bases de datos relacional (RDBMS) de código abierto. Organiza los datos en tablas con filas y columnas, relacionadas entre sí. Es uno de los más usados en el mundo. En el proyecto corre en RDS versión 8.0.

### SQL — Structured Query Language
Lenguaje estándar para consultar y manipular bases de datos relacionales. Se usa para crear tablas (`CREATE`), insertar datos (`INSERT`), consultarlos (`SELECT`) y modificarlos (`UPDATE`, `DELETE`).

### Schema (Esquema)
Definición de la estructura de la base de datos: qué tablas existen, qué columnas tienen, sus tipos de datos y restricciones. En el proyecto, `database/schema.sql` crea la tabla `avistamientos` con sus columnas.

### Seed (Datos de prueba)
Datos iniciales que se cargan en la base de datos para tener información de ejemplo. En el proyecto, `database/seed.sql` inserta 14 avistamientos de prueba para que la aplicación no aparezca vacía al arrancar.

### ORM — Object-Relational Mapping
Técnica que convierte entre objetos de un lenguaje de programación y filas de una base de datos relacional. En el proyecto se usa **SQLAlchemy** como ORM: permite escribir consultas en Python en lugar de SQL puro.

```python
# Con ORM (SQLAlchemy):
db.query(Avistamiento).filter(Avistamiento.id == 1).first()

# Equivalente en SQL puro:
SELECT * FROM avistamientos WHERE id = 1 LIMIT 1;
```

### MariaDB Client
Cliente de línea de comandos compatible con MySQL. En Amazon Linux 2023 se instala con `dnf install mariadb105`. Permite ejecutar comandos SQL y cargar archivos `.sql` contra una base de datos remota (como RDS).

---

## Lenguajes y Frameworks

### Python
Lenguaje de programación interpretado, de propósito general, conocido por su sintaxis clara. Es el lenguaje del backend del proyecto.

### FastAPI
Framework moderno de Python para construir APIs REST de alto rendimiento. Genera automáticamente documentación interactiva (Swagger UI en `/docs`), valida los datos de entrada con Pydantic y es asíncrono por defecto.

### Pydantic
Librería de Python para validación de datos usando type hints. FastAPI la usa internamente para validar que los datos que llegan al API (en el body del request) tengan el formato correcto antes de procesarlos.

### SQLAlchemy
ORM para Python que permite interactuar con bases de datos relacionales usando objetos Python. En el proyecto gestiona la conexión a RDS MySQL y mapea la tabla `avistamientos` a la clase `Avistamiento`.

### PyMySQL
Driver de Python puro para conectarse a bases de datos MySQL. SQLAlchemy lo usa como adaptador para comunicarse con RDS. Se instala junto con las dependencias en `requirements.txt`.

### Virtual Environment (venv)
Entorno aislado de Python que tiene sus propias versiones de paquetes, independientes del sistema. Evita conflictos entre proyectos que necesitan versiones distintas de una misma librería. En el proyecto se crea con `python3 -m venv venv` dentro de la carpeta `backend/`.

### React
Librería de JavaScript para construir interfaces de usuario basadas en componentes reutilizables. Desarrollada por Meta. El frontend del proyecto es una SPA (Single Page Application) construida con React.

### Vite
Herramienta de desarrollo frontend moderna que reemplaza a Webpack. Compila y empaqueta el código JavaScript/React para producción (`npm run build` genera la carpeta `dist/`). Es extremadamente rápido gracias al uso de módulos ES nativos.

### Node.js
Entorno de ejecución de JavaScript del lado del servidor. Se usa en la etapa de build del Dockerfile para ejecutar `npm install` y `npm run build`. No está presente en la imagen final de producción (gracias al multi-stage build).

### npm — Node Package Manager
Gestor de paquetes de Node.js. Descarga las dependencias declaradas en `package.json` (React, Vite, etc.) y ejecuta scripts como `npm run build`.

---

## Herramientas de Desarrollo

### Git
Sistema de control de versiones distribuido. Registra el historial de cambios de un proyecto y permite colaborar entre múltiples desarrolladores. En el proyecto se usa para versionar el código y distribuirlo a la EC2 (`git clone`) y a Cloud Shell (`git pull`).

### GitHub
Plataforma web que aloja repositorios Git en la nube. En el proyecto el repositorio fuente está en GitHub y tanto el User Data de la EC2 como Cloud Build lo clonan desde ahí.

### gcloud CLI
Herramienta de línea de comandos de Google Cloud. Permite gestionar recursos de GCP desde la terminal: habilitar APIs, crear repositorios en Artifact Registry, lanzar builds con Cloud Build y desplegar servicios en Cloud Run.

### SSH — Secure Shell
Protocolo de red que permite acceder a la terminal de un servidor remoto de forma segura y cifrada. Se usa para conectarse a la EC2 desde la máquina local. Requiere autenticación con par de claves (archivo `.pem`).

### Par de Claves (.pem)
Sistema de autenticación para SSH basado en criptografía asimétrica. Se genera un par: clave pública (se sube a AWS al crear la EC2) y clave privada (archivo `.pem` que guarda el usuario). Solo quien tiene el `.pem` puede acceder a la EC2.

### curl
Herramienta de línea de comandos para hacer peticiones HTTP. Se usa para probar los endpoints del backend sin necesidad de un navegador o cliente gráfico.

```bash
curl http://localhost:8000/health
curl -X POST http://api/avistamientos -H "Content-Type: application/json" -d '{...}'
```

### Swagger UI
Interfaz web interactiva generada automáticamente por FastAPI en la ruta `/docs`. Muestra todos los endpoints de la API, sus parámetros y permite probarlos directamente desde el navegador.

### .env (archivo de variables de entorno)
Archivo de texto que almacena configuraciones sensibles (contraseñas, endpoints, puertos) fuera del código fuente. No debe subirse al repositorio Git. El backend lo lee al iniciar para configurar la conexión a RDS.

```
DB_HOST=ovnis-db.xxx.us-east-1.rds.amazonaws.com
DB_PASSWORD=MiContraseñaSegura
```

### Bash / Shell Script
Lenguaje de scripting para automatizar tareas en sistemas Unix/Linux. El `userdata.sh` es un Bash script que automatiza la instalación completa del backend en la EC2.

### sed
Herramienta de línea de comandos de Linux para editar texto en archivos. En el Dockerfile se usa para reemplazar el placeholder `PLACEHOLDER_API_URL` con la URL real del ALB dentro de `nginx.conf`:

```bash
sed -i "s|PLACEHOLDER_API_URL|${API_PROXY_URL}|g" /etc/nginx/conf.d/default.conf
```

### journalctl
Herramienta de Linux para ver los logs del sistema gestionados por systemd. En el proyecto se usa para ver los errores del servicio `ovnis-api`:

```bash
sudo journalctl -u ovnis-api -n 50 --no-pager
```

---

## Conceptos de Arquitectura

### API — Application Programming Interface
Interfaz que permite que dos sistemas se comuniquen. En el proyecto, el backend expone una API REST que el frontend consume para listar, crear, modificar y eliminar avistamientos.

### CRUD
Acrónimo de las cuatro operaciones básicas sobre datos: **C**reate (crear), **R**ead (leer), **U**pdate (actualizar), **D**elete (eliminar). La API del proyecto implementa CRUD completo para la entidad `avistamiento`.

### SPA — Single Page Application
Aplicación web que carga una sola página HTML y actualiza el contenido dinámicamente mediante JavaScript, sin recargar la página completa. React es el framework más popular para construir SPAs. En el proyecto, la carpeta `dist/` contiene el HTML, CSS y JS empaquetados por Vite.

### Serverless
Modelo de ejecución donde el proveedor de nube gestiona completamente la infraestructura. El desarrollador solo despliega código o contenedores. Cloud Run es serverless: escala a cero cuando no hay tráfico (sin costo) y escala automáticamente con la demanda.

### Load Balancer (Balanceador de Carga)
Componente que distribuye el tráfico entrante entre múltiples servidores. Mejora la disponibilidad (si un servidor falla, el tráfico va a los demás) y la escalabilidad (se pueden agregar servidores sin cambiar la URL). En el proyecto el ALB también actúa como punto de entrada con DNS estático.

### Build (Compilación)
Proceso de transformar código fuente en artefactos ejecutables o desplegables. En el frontend, el build de Vite transforma el JSX de React en JavaScript optimizado para producción. En Docker, el build crea una imagen ejecutable.

### Deploy (Despliegue)
Proceso de poner una aplicación en funcionamiento en un entorno (desarrollo, staging, producción). En el proyecto: desplegar en Cloud Run significa subir la imagen Docker y crear/actualizar el servicio.

### OpenAPI / Swagger
Especificación estándar para describir APIs REST. FastAPI genera automáticamente un documento OpenAPI que Swagger UI usa para mostrar la documentación interactiva en `/docs`.

### IMDSv2 — Instance Metadata Service v2
Servicio de AWS que provee información sobre una instancia EC2 (IP pública, región, etc.) desde dentro de la misma instancia. La versión 2 requiere un token de autenticación para mayor seguridad. En el script se usa para obtener la IP pública al final de la instalación.

```bash
TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)
```

### Free Tier
Nivel gratuito que AWS y GCP ofrecen para que desarrolladores puedan experimentar sin costo. En AWS incluye 750 horas/mes de EC2 `t2.micro` y 750 horas/mes de RDS `db.t3.micro` durante 12 meses. Cloud Run tiene una capa gratuita de 2 millones de peticiones/mes permanente.

<img src="assets/icon.svg" width="64" height="64" alt="">

# Aura Voice Live (`chat-voice-mode`)

Aplicación web de **Chat en Modo Voz en Tiempo Real** diseñada para sentirse como una conversación humana real (estilo ChatGPT Advanced Voice Mode), construida con **Next.js 15, React 19, Tailwind CSS v4 y OpenAI Realtime API GA (WebRTC)**.

## Características principales

1. **Cadena DSP Anti-Ruido de Fondo & Compuerta Vocal (Web Audio API)**:
   - Filtro Paso-Alto a `85 Hz` (elimina zumbido eléctrico, retumbos de escritorio y ventilación) y Paso-Bajo a `3800 Hz`.
   - **Piso de ruido adaptativo (*Adaptive Noise Floor*)** que mide continuamente el ruido ambiente de tu sala.
   - **Compuerta Vocal (*Voice Gate*)**: Sólo envía audio a WebRTC cuando la relación señal/ruido supera el umbral vocal, impidiendo que el ruido ambiental dispare el VAD o interrumpa a la IA.
   - Reducción activa en servidor con `audio.input.noise_reduction: { type: "far_field" }` de OpenAI Realtime GA.
2. **Inferencia Orgánica de Participantes (Cero Pestañas / Cero Configuración Previa)**:
   - No requiere seleccionar si son 1, 2 o 3 personas. La sesión inicia de forma natural y la IA **descubre y etiqueta a los participantes sobre la marcha** por sus nombres (*"Soy Carlos"*, *"Oye Laura..."*) y por su firma espectral vocal.
   - **Smart Floor Control**: Si dos personas en la sala conversan entre sí, la IA cede el turno en silencio (`yield_turn_to_humans`) y anota el contexto sin interrumpirlos. Cuando le hablan a ella o a la sala, responde integrando las perspectivas de ambos.
3. **Interrupción Humana Instantánea (`Barge-In`)**:
   - Corta el audio al instante al detectar voz humana confirmada y trunca el contexto exacto (`conversation.item.truncate` + `response.cancel`) para que la IA sepa en qué palabra fue interrumpida.
4. **Corrección Fonética Contextual**:
   - Deduce términos técnicos mal pronunciados, homófonos o spanglish (*"nejs"* → **Next.js**, *"weberretese"* → **WebRTC**, *"kubernetis"* → **Kubernetes**) mostrando qué sonó vs. qué se entendió.
5. **Modo Sala Híbrido Automático**:
   - Funciona de inmediato sin necesidad de ingresar una API Key, utilizando síntesis nativa y reconocimiento continuo filtrado.

## Cómo ejecutar

```bash
# 1. Instalar dependencias (si no lo has hecho)
npm install

# 2. Iniciar servidor de desarrollo local
npm run dev
```

Abre `http://localhost:3000` en tu navegador.

## Despliegue con Docker y Dokploy

El proyecto cuenta con configuración de Infraestructura como Código (`dockploy-docker-setup`) tanto para desarrollo local como para despliegue en Dokploy.

### Desarrollo Local con Docker (`docker-compose.dev.yml`)

Incluye *hot-reloading* sincronizado con el host, volúmenes nombrados para dependencias y *polling* activo para Windows (`CHOKIDAR_USEPOLLING=true` y `WATCHPACK_POLLING=true`):

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Despliegue en Producción con Dokploy (`docker-compose.yml`)

Cumple estrictamente con las directivas de seguridad y aislamiento de Dokploy:
- **Red Externa:** Conectado a la red `dokploy-network` manejada por Traefik.
- **Aislamiento de Puertos:** Solo utiliza `expose: ["3000"]` (sin publicar puertos directos en el host).
- **Invalidación de Caché:** Recibe el argumento `BUILD_VERSION` en el build del contenedor.
- **Política de Reinicio:** `restart: always`.

```bash
# En Dokploy o servidor remoto con la red dokploy-network creada:
docker compose up -d --build
```


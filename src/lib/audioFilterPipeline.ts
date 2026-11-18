/**
 * Pipeline DSP de filtrado de audio para voz humana en tiempo real.
 * Elimina frecuencias de retumbo ambiental (<85Hz), siseos agudos (>3800Hz),
 * calcula el piso de ruido ambiente dinámicamente y aplica una puerta de ruido
 * (Noise Gate) que evita que el ruido de fondo active el VAD o el Barge-in.
 */

export interface AudioFilterPipeline {
  audioContext: AudioContext;
  filteredStream: MediaStream;
  analyserNode: AnalyserNode;
  getSpeechMetrics: () => {
    isVoiceDetected: boolean;
    voiceLevel: number;
    noiseFloor: number;
    snr: number;
    spectralCentroid: number;
  };
  setGateThreshold: (threshold: number) => void;
  setMuted: (muted: boolean) => void;
  cleanup: () => void;
}

export function createVoiceFilterPipeline(
  rawStream: MediaStream,
  initialGateThreshold: number = 0.12
): AudioFilterPipeline {
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  const sourceNode = audioContext.createMediaStreamSource(rawStream);

  // 1. Filtro Paso-Alto (High-Pass): Corta vibraciones de mesa, zumbido de transformadores y ventilación (< 85 Hz)
  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = "highpass";
  highPassFilter.frequency.setValueAtTime(85, audioContext.currentTime);
  highPassFilter.Q.setValueAtTime(0.707, audioContext.currentTime);

  // 2. Filtro Paso-Bajo (Low-Pass): Corta siseos agudos y clics fuera de la banda vocal fundamental (> 3800 Hz)
  const lowPassFilter = audioContext.createBiquadFilter();
  lowPassFilter.type = "lowpass";
  lowPassFilter.frequency.setValueAtTime(3800, audioContext.currentTime);
  lowPassFilter.Q.setValueAtTime(0.707, audioContext.currentTime);

  // 3. Compresor dinámico suave para nivelar voces cercanas/lejanas
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-28, audioContext.currentTime);
  compressor.knee.setValueAtTime(20, audioContext.currentTime);
  compressor.ratio.setValueAtTime(4, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.005, audioContext.currentTime);
  compressor.release.setValueAtTime(0.12, audioContext.currentTime);

  // 4. Analizador de espectro para detección vocal y cálculo de piso de ruido
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 512;
  analyserNode.smoothingTimeConstant = 0.45;

  // 5. Compuerta de Ruido (Noise Gate) adaptativa
  const gateGainNode = audioContext.createGain();
  gateGainNode.gain.setValueAtTime(0.02, audioContext.currentTime); // Inicia silenciado/atenuado hasta confirmar voz

  // 6. Destino para enviar a WebRTC RTCPeerConnection
  const destinationNode = audioContext.createMediaStreamDestination();

  // Conexiones de la cadena DSP
  sourceNode.connect(highPassFilter);
  highPassFilter.connect(lowPassFilter);
  lowPassFilter.connect(compressor);
  compressor.connect(analyserNode);
  compressor.connect(gateGainNode);
  gateGainNode.connect(destinationNode);

  // Parámetros internos de la puerta de ruido y métricas
  const freqData = new Uint8Array(analyserNode.frequencyBinCount);
  let noiseFloor = 0.04;
  let gateThreshold = initialGateThreshold;
  let consecutiveSpeechFrames = 0;
  let isGateOpen = false;
  let lastSpectralCentroid = 15;
  let isMutedInternal = false;

  // Resolución de frecuencia por bin: (sampleRate / 2) / binCount
  const binResolution = (audioContext.sampleRate / 2) / analyserNode.frequencyBinCount;
  // Índices para la banda vocal humana principal (100 Hz a 3200 Hz)
  const vocalMinBin = Math.max(1, Math.floor(100 / binResolution));
  const vocalMaxBin = Math.min(
    analyserNode.frequencyBinCount - 1,
    Math.ceil(3200 / binResolution)
  );

  const getSpeechMetrics = () => {
    if (isMutedInternal) {
      return {
        isVoiceDetected: false,
        voiceLevel: 0,
        noiseFloor,
        snr: 0,
        spectralCentroid: lastSpectralCentroid,
      };
    }

    analyserNode.getByteFrequencyData(freqData);

    let vocalEnergySum = 0;
    let weightedFreqSum = 0;
    let vocalCount = 0;

    for (let i = vocalMinBin; i <= vocalMaxBin; i++) {
      const val = freqData[i] / 255;
      vocalEnergySum += val;
      weightedFreqSum += val * i;
      vocalCount++;
    }

    const currentVocalLevel = vocalCount > 0 ? vocalEnergySum / vocalCount : 0;
    const currentCentroid =
      vocalEnergySum > 0 ? weightedFreqSum / vocalEnergySum : lastSpectralCentroid;
    lastSpectralCentroid = currentCentroid;

    // Actualización adaptativa del piso de ruido ambiental (Noise Floor)
    if (currentVocalLevel < noiseFloor * 1.5) {
      noiseFloor = noiseFloor * 0.95 + currentVocalLevel * 0.05;
    } else {
      noiseFloor = noiseFloor * 0.999 + currentVocalLevel * 0.001;
    }
    noiseFloor = Math.max(0.015, Math.min(0.25, noiseFloor));

    // Relación señal a ruido en banda vocal
    const snr = Math.max(0, currentVocalLevel - noiseFloor);
    const isVoicePresent = snr > gateThreshold;

    const now = audioContext.currentTime;

    if (isVoicePresent) {
      consecutiveSpeechFrames++;
      // Si la voz se mantiene por 3+ frames (~50ms), abrimos la compuerta suavemente
      if (consecutiveSpeechFrames >= 3 && !isGateOpen) {
        isGateOpen = true;
        gateGainNode.gain.cancelScheduledValues(now);
        gateGainNode.gain.linearRampToValueAtTime(1.0, now + 0.02);
      }
    } else {
      if (consecutiveSpeechFrames > 0) {
        consecutiveSpeechFrames--;
      }
      // Si se pierde la voz, cerramos la compuerta tras un breve hold time (120ms)
      if (consecutiveSpeechFrames === 0 && isGateOpen) {
        isGateOpen = false;
        gateGainNode.gain.cancelScheduledValues(now);
        gateGainNode.gain.linearRampToValueAtTime(0.02, now + 0.12);
      }
    }

    return {
      isVoiceDetected: isGateOpen,
      voiceLevel: isGateOpen ? currentVocalLevel : currentVocalLevel * 0.2,
      noiseFloor,
      snr,
      spectralCentroid: currentCentroid,
    };
  };

  const setMuted = (muted: boolean) => {
    isMutedInternal = muted;
    const now = audioContext.currentTime;
    gateGainNode.gain.cancelScheduledValues(now);
    if (muted) {
      isGateOpen = false;
      consecutiveSpeechFrames = 0;
      gateGainNode.gain.setValueAtTime(0, now);
      destinationNode.stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    } else {
      gateGainNode.gain.setValueAtTime(0.02, now);
      destinationNode.stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  };

  const cleanup = () => {
    try {
      sourceNode.disconnect();
      highPassFilter.disconnect();
      lowPassFilter.disconnect();
      compressor.disconnect();
      analyserNode.disconnect();
      gateGainNode.disconnect();
      if (audioContext.state !== "closed") {
        audioContext.close();
      }
    } catch {
      // Ignorar errores al cerrar
    }
  };

  return {
    audioContext,
    filteredStream: destinationNode.stream,
    analyserNode,
    getSpeechMetrics,
    setGateThreshold: (thresh: number) => {
      gateThreshold = Math.max(0.03, Math.min(0.4, thresh));
    },
    setMuted,
    cleanup,
  };
}

/**
 * Filtro de alucinaciones de transcripción producidas por ruido ambiental
 * (típicas en modelos de transcripción cuando se filtra un suspiro o golpe de aire).
 */
export function isNoiseHallucination(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return true;

  // Frases o tokens basura recurrentes en silencios con ruido
  const noisePatterns = [
    /^\.+$/,
    /^\(+.*\)+$/,
    /^\[+.*\]+$/,
    /^(gracias|subtítulos|subtitulos|amara\.org|descarga|música|musica|aplausos|silencio)$/i,
    /^(eh|ah|uh|mm|mmm|oh)\.?$/i,
  ];

  return noisePatterns.some((pattern) => pattern.test(trimmed));
}

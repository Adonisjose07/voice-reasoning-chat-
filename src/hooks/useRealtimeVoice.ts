"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationFact,
  ConversationState,
  DetectedSpeaker,
  PhoneticCorrection,
  ReasoningEffort,
  ReasoningStep,
  TranscriptTurn,
  VoiceSettings,
} from "@/types/voice";
import {
  analyzeAndCorrectUtterance,
  analyzeTurnContextAndSpeakers,
  buildRealtimeInstructions,
  VOICE_PERSONAS,
} from "@/lib/voicePrompts";
import {
  AudioFilterPipeline,
  createVoiceFilterPipeline,
  isNoiseHallucination,
} from "@/lib/audioFilterPipeline";

interface UseRealtimeVoiceReturn {
  state: ConversationState;
  isConnected: boolean;
  isMuted: boolean;
  activeEngine: "openai-realtime" | "browser-native" | null;
  transcript: TranscriptTurn[];
  corrections: PhoneticCorrection[];
  facts: ConversationFact[];
  speakers: DetectedSpeaker[];
  activeSpeaker: DetectedSpeaker | null;
  liveUserText: string;
  liveAssistantText: string;
  liveReasoningSteps: ReasoningStep[];
  userVolume: number;
  assistantVolume: number;
  noiseFloor: number;
  lastFloorDecision: string | null;
  skippedTurnsCount: number;
  errorMessage: string | null;
  interruptionCount: number;
  latencyMs: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  interruptAssistant: (reason?: string) => void;
  sendTextTurn: (
    text: string,
    options?: {
      reasoningEffort?: ReasoningEffort;
      speakResponse?: boolean;
    }
  ) => Promise<void>;
  speakText: (text: string) => void;
  clearHistory: () => void;
  addFact: (
    category: ConversationFact["category"],
    summary: string,
    speakerName?: string
  ) => void;
  removeFact: (id: string) => void;
}

export function useRealtimeVoice(
  settings: VoiceSettings
): UseRealtimeVoiceReturn {
  const [state, setState] = useState<ConversationState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeEngine, setActiveEngine] = useState<
    "openai-realtime" | "browser-native" | null
  >(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [corrections, setCorrections] = useState<PhoneticCorrection[]>([]);
  const [facts, setFacts] = useState<ConversationFact[]>([
    {
      id: "fact-init-1",
      category: "preferencia",
      summary:
        "Filtro de ruido ambiental activo y reconocimiento orgánico de interlocutores",
      timestamp: Date.now(),
    },
  ]);
  const [speakers, setSpeakers] = useState<DetectedSpeaker[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<DetectedSpeaker | null>(null);
  const [liveUserText, setLiveUserText] = useState("");
  const [liveAssistantText, setLiveAssistantText] = useState("");
  const [liveReasoningSteps, setLiveReasoningSteps] = useState<ReasoningStep[]>(
    []
  );
  const [userVolume, setUserVolume] = useState(0);
  const [assistantVolume, setAssistantVolume] = useState(0);
  const [noiseFloor, setNoiseFloor] = useState(0.04);
  const [lastFloorDecision, setLastFloorDecision] = useState<string | null>(null);
  const [skippedTurnsCount, setSkippedTurnsCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interruptionCount, setInterruptionCount] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // WebRTC & Audio Processing Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const pipelineRef = useRef<AudioFilterPipeline | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const assistantAnalyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Reactive state refs
  const stateRef = useRef<ConversationState>("idle");
  const settingsRef = useRef<VoiceSettings>(settings);
  const factsRef = useRef<ConversationFact[]>(facts);
  const speakersRef = useRef<DetectedSpeaker[]>(speakers);
  const transcriptRef = useRef<TranscriptTurn[]>(transcript);
  const lastSpeechStopTimestampRef = useRef<number | null>(null);
  const currentAssistantItemIdRef = useRef<string | null>(null);
  const assistantPlaybackStartRef = useRef<number | null>(null);
  const latestSpectralCentroidRef = useRef<number>(15);

  // Browser native mode refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isBrowserActiveRef = useRef(false);

  // Mute & Concurrency control refs
  const isMutedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const reasoningTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const speechDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedSpokenTextRef = useRef<string>("");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    settingsRef.current = settings;
    if (pipelineRef.current) {
      pipelineRef.current.setGateThreshold(settings.noiseGateThreshold);
    }
  }, [settings]);

  useEffect(() => {
    factsRef.current = facts;
  }, [facts]);

  useEffect(() => {
    speakersRef.current = speakers;
  }, [speakers]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Control "Voz IA On" / "Solo Texto" (speakChatResponses)
  useEffect(() => {
    if (!settings.speakChatResponses) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = true;
      }
    } else {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;
      }
    }
  }, [settings.speakChatResponses]);

  // Actualizar sesión en caliente en OpenAI Realtime GA si cambian instrucciones o ajustes (debounced anti-tormenta)
  useEffect(() => {
    if (
      activeEngine !== "openai-realtime" ||
      !dcRef.current ||
      dcRef.current.readyState !== "open"
    ) {
      return;
    }

    const timer = setTimeout(() => {
      if (
        !dcRef.current ||
        dcRef.current.readyState !== "open" ||
        (stateRef.current !== "idle" &&
          stateRef.current !== "listening" &&
          stateRef.current !== "passive_listening")
      ) {
        return;
      }

      const instructions = buildRealtimeInstructions(settings, facts, speakers);
      const turnDetection =
        settings.vadMode === "push_to_talk"
          ? null
          : settings.vadMode === "semantic_vad"
          ? {
              type: "semantic_vad",
              eagerness: settings.vadEagerness,
              create_response: true,
              interrupt_response: settings.autoBargeIn,
            }
          : {
              type: "server_vad",
              threshold: settings.vadThreshold,
              prefix_padding_ms: 300,
              silence_duration_ms: settings.silenceDurationMs,
              create_response: true,
              interrupt_response: settings.autoBargeIn,
            };

      dcRef.current.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions,
            output_modalities: ["audio"],
            audio: {
              input: {
                noise_reduction: {
                  type:
                    settings.noiseSuppression === "aggressive_far_field"
                      ? "far_field"
                      : "near_field",
                },
                transcription: {
                  model: "gpt-4o-mini-transcribe",
                },
                turn_detection: turnDetection,
              },
              output: {
                voice: settings.voice,
              },
            },
          },
        })
      );
    }, 450);

    return () => clearTimeout(timer);
  }, [activeEngine, settings, facts, speakers]);

  const stopAudioMeters = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setUserVolume(0);
    setAssistantVolume(0);
  }, []);

  // Bucle de medición usando métricas limpias del AudioFilterPipeline
  const startAudioMeters = useCallback(() => {
    const assistantBuffer = new Uint8Array(64);
    let consecutiveHumanVoiceFrames = 0;

    const tick = () => {
      let uVol = 0;
      let aVol = 0;

      if (pipelineRef.current && !isMutedRef.current) {
        const metrics = pipelineRef.current.getSpeechMetrics();
        setNoiseFloor(metrics.noiseFloor);
        latestSpectralCentroidRef.current = metrics.spectralCentroid;

        // Solo reportar volumen de usuario si la compuerta de voz está abierta
        if (metrics.isVoiceDetected) {
          uVol = Math.min(1, metrics.voiceLevel * 1.6);
          setUserVolume(uVol);
          consecutiveHumanVoiceFrames++;
        } else {
          setUserVolume(0);
          consecutiveHumanVoiceFrames = Math.max(0, consecutiveHumanVoiceFrames - 1);
        }
      } else {
        setUserVolume(0);
      }

      if (assistantAnalyserRef.current) {
        assistantAnalyserRef.current.getByteFrequencyData(assistantBuffer);
        let sum = 0;
        for (let i = 0; i < assistantBuffer.length; i++) {
          sum += assistantBuffer[i];
        }
        aVol = Math.min(1, sum / (assistantBuffer.length * 135));
        setAssistantVolume(aVol);
      } else if (
        isBrowserActiveRef.current &&
        stateRef.current === "assistant_speaking"
      ) {
        const t = performance.now() / 130;
        aVol = 0.35 + Math.abs(Math.sin(t) * 0.4 + Math.cos(t * 1.7) * 0.2);
        setAssistantVolume(aVol);
      } else {
        setAssistantVolume(0);
      }

      // Detector local de Barge-In inmune a ruido: requiere confirmación de voz humana sostenida
      if (
        isBrowserActiveRef.current &&
        settingsRef.current.autoBargeIn &&
        stateRef.current === "assistant_speaking"
      ) {
        if (consecutiveHumanVoiceFrames >= 7) {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
          }
          setInterruptionCount((c) => c + 1);
          setState("interrupted");
          setTimeout(() => {
            if (isBrowserActiveRef.current) setState("user_speaking");
          }, 280);
          consecutiveHumanVoiceFrames = 0;
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const interruptAssistant = useCallback((reason?: string) => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      dcRef.current.send(JSON.stringify({ type: "response.cancel" }));

      if (
        currentAssistantItemIdRef.current &&
        assistantPlaybackStartRef.current
      ) {
        const elapsedMs = Math.max(
          0,
          Math.floor(performance.now() - assistantPlaybackStartRef.current)
        );
        dcRef.current.send(
          JSON.stringify({
            type: "conversation.item.truncate",
            item_id: currentAssistantItemIdRef.current,
            content_index: 0,
            audio_end_ms: elapsedMs,
          })
        );
      }
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setInterruptionCount((c) => c + 1);
    setLiveAssistantText((prev) => (prev ? `${prev} [interrumpido]` : ""));

    setTranscript((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role === "assistant") {
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            wasInterrupted: true,
            isFinal: true,
          },
        ];
      }
      return prev;
    });

    setState("interrupted");
    setTimeout(() => {
      setState((current) =>
        current === "interrupted" ? "listening" : current
      );
    }, 500);

    if (reason) {
      // eslint-disable-next-line no-console
      console.debug("[Barge-In]:", reason);
    }
  }, []);

  const speakWithBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setState("listening");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settingsRef.current.language === "en" ? "en-US" : "es-ES";
    utterance.rate = settingsRef.current.speakingSpeed || 1.05;
    utterance.pitch = 1.02;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.startsWith("es") &&
          (v.name.includes("Natural") ||
            v.name.includes("Online") ||
            v.name.includes("Google") ||
            v.name.includes("Sabina") ||
            v.name.includes("Helena") ||
            v.name.includes("Paulina"))
      ) || voices.find((v) => v.lang.startsWith("es"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setState("assistant_speaking");
      setLiveAssistantText(text);
    };

    utterance.onend = () => {
      setLiveAssistantText("");
      if (isBrowserActiveRef.current) {
        setState("listening");
      }
    };

    utterance.onerror = () => {
      setLiveAssistantText("");
      if (isBrowserActiveRef.current) {
        setState("listening");
      }
    };

    synthUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Procesar turno de usuario reconociendo interlocutores orgánicamente y filtrando ruido
  const processUserTurn = useCallback(
    async (
      rawSpoken: string,
      options?: {
        reasoningEffort?: ReasoningEffort;
        speakResponse?: boolean;
      }
    ) => {
      const trimmed = rawSpoken.trim();
      if (!trimmed || isNoiseHallucination(trimmed)) {
        return;
      }

      const t0 = performance.now();
      const effectiveEffort: ReasoningEffort =
        options?.reasoningEffort ??
        settingsRef.current.reasoningEffort ??
        "medium";
      const shouldSpeak =
        options?.speakResponse ??
        settingsRef.current.speakChatResponses ??
        true;

      const persona =
        VOICE_PERSONAS.find((p) => p.id === settingsRef.current.personaId) ||
        VOICE_PERSONAS[0];

      // Inferencia orgánica de interlocutor, destinatario y turno
      const floorAnalysis = analyzeTurnContextAndSpeakers(
        trimmed,
        speakersRef.current,
        persona.name,
        latestSpectralCentroidRef.current
      );

      setSpeakers(floorAnalysis.updatedSpeakers);
      setActiveSpeaker(floorAnalysis.speaker);
      setLastFloorDecision(floorAnalysis.reason);

      // Corrección fonética contextual atribuida al interlocutor
      const { correctedText, corrections: detectedCorrections } =
        settingsRef.current.phoneticCorrectionEnabled
          ? analyzeAndCorrectUtterance(
              floorAnalysis.cleanedUtterance,
              settingsRef.current.customDictionary,
              floorAnalysis.speaker.name
            )
          : {
              correctedText: floorAnalysis.cleanedUtterance,
              corrections: [],
            };

      if (detectedCorrections.length > 0) {
        setCorrections((prev) => [...detectedCorrections, ...prev]);
      }

      const userTurnId = `user-${Date.now()}`;
      const newUserTurn: TranscriptTurn = {
        id: userTurnId,
        role: "user",
        speakerId: floorAnalysis.speaker.id,
        speakerName: floorAnalysis.speaker.name,
        addressedTo: floorAnalysis.addressedTo,
        skippedByFloorControl: !floorAnalysis.shouldAiRespond,
        skipReason: !floorAnalysis.shouldAiRespond
          ? floorAnalysis.reason
          : undefined,
        text: correctedText,
        rawSpokenText:
          correctedText !== floorAnalysis.cleanedUtterance
            ? floorAnalysis.cleanedUtterance
            : undefined,
        correctedText:
          correctedText !== floorAnalysis.cleanedUtterance
            ? correctedText
            : undefined,
        isFinal: true,
        timestamp: Date.now(),
        corrections: detectedCorrections,
        reasoningEffort: effectiveEffort,
      };

      setTranscript((prev) => [...prev, newUserTurn]);
      setLiveUserText("");

      // Si los humanos están conversando entre sí, la IA cede el turno y escucha en silencio
      if (!floorAnalysis.shouldAiRespond) {
        setSkippedTurnsCount((c) => c + 1);
        setState("passive_listening");

        setFacts((prev) => [
          {
            id: `fact-side-${Date.now()}`,
            category: "tema",
            speakerName: floorAnalysis.speaker.name,
            summary: `${floorAnalysis.speaker.name} comentó a los presentes: "${correctedText.slice(0, 85)}"`,
            timestamp: Date.now(),
          },
          ...prev,
        ]);

        setTimeout(() => {
          setState((curr) =>
            curr === "passive_listening" ? "listening" : curr
          );
        }, 1600);
        return;
      }

      // Si el turno está dirigido a la IA o abierto a la sala, generar respuesta
      setState("thinking");

      // Cancelar cualquier petición previa en vuelo, timers y voz anterior
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const currentRequestId = ++activeRequestIdRef.current;

      reasoningTimersRef.current.forEach(clearTimeout);
      reasoningTimersRef.current = [];

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      // Mostrar pasos de razonamiento progresivos en vivo mientras piensa
      if (effectiveEffort !== "none") {
        const initialStep: ReasoningStep = {
          id: `live-step-1`,
          category: "intent",
          title: `Analizando intención de ${floorAnalysis.speaker.name}`,
          detail:
            detectedCorrections.length > 0
              ? `Normalización fonética aplicada (${detectedCorrections.map((c) => `${c.heard} → ${c.intended}`).join(", ")})`
              : `Interpretando consulta semántica ("${correctedText.slice(0, 50)}${correctedText.length > 50 ? "..." : ""}")`,
        };
        setLiveReasoningSteps([initialStep]);

        reasoningTimersRef.current.push(
          setTimeout(() => {
            if (currentRequestId !== activeRequestIdRef.current) return;
            setLiveReasoningSteps((prev) => [
              ...prev,
              {
                id: `live-step-2`,
                category: "context",
                title: "Consultando memoria activa y acuerdos de sala",
                detail: `Cruzando con ${factsRef.current.length} dato(s) y ${speakersRef.current.length || 1} participante(s) activos.`,
              },
            ]);
          }, 160)
        );

        if (effectiveEffort === "medium" || effectiveEffort === "high") {
          reasoningTimersRef.current.push(
            setTimeout(() => {
              if (currentRequestId !== activeRequestIdRef.current) return;
              setLiveReasoningSteps((prev) => [
                ...prev,
                {
                  id: `live-step-3`,
                  category: "deduction",
                  title:
                    effectiveEffort === "high"
                      ? "Deducción profunda multi-hipótesis"
                      : "Estructurando respuesta contextual",
                  detail:
                    "Evaluando argumentos técnicos y sintetizando conclusión natural...",
                },
              ]);
            }, 340)
          );
        }
      } else {
        setLiveReasoningSteps([]);
      }

      try {
        const historyForApi = [
          ...transcriptRef.current
            .filter((t) => t.role === "user" || t.role === "assistant")
            .map((t) => ({
              role: t.role as "user" | "assistant",
              speakerName: t.speakerName,
              content: t.text,
            })),
          {
            role: "user" as const,
            speakerName: floorAnalysis.speaker.name,
            content: correctedText,
          },
        ];

        const [res] = await Promise.all([
          fetch("/api/chat/fallback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: historyForApi,
              settings: settingsRef.current,
              facts: factsRef.current,
              activeSpeakerName: floorAnalysis.speaker.name,
              reasoningEffort: effectiveEffort,
            }),
            signal: abortController.signal,
          }),
          // Breve pausa visual cuando el nivel de razonamiento es medio/alto para apreciar la traza en vivo
          new Promise((resolve) =>
            setTimeout(
              resolve,
              effectiveEffort === "high"
                ? 520
                : effectiveEffort === "medium"
                ? 360
                : effectiveEffort === "low"
                ? 200
                : 0
            )
          ),
        ]);

        if (
          abortController.signal.aborted ||
          currentRequestId !== activeRequestIdRef.current
        ) {
          return;
        }

        reasoningTimersRef.current.forEach(clearTimeout);
        reasoningTimersRef.current = [];

        const data = await res.json();
        if (
          abortController.signal.aborted ||
          currentRequestId !== activeRequestIdRef.current
        ) {
          return;
        }

        const measuredLatency = Math.round(performance.now() - t0);
        setLatencyMs(measuredLatency);
        setLiveReasoningSteps([]);

        if (data.extractedFacts && Array.isArray(data.extractedFacts)) {
          setFacts((prev) => [...data.extractedFacts, ...prev]);
        }

        const replyText =
          data.reply || "Te escucho fuerte y claro. Cuéntame más.";

        // Enriquecer pasos con correcciones fonéticas si ocurrieron
        const apiSteps: ReasoningStep[] = Array.isArray(data.reasoningSteps)
          ? data.reasoningSteps
          : [];
        const finalSteps: ReasoningStep[] =
          effectiveEffort !== "none" && detectedCorrections.length > 0
            ? [
                {
                  id: `step-phon-${Date.now()}`,
                  category: "phonetic",
                  title: "Deducción fonética por contexto",
                  detail: `Se infirió ${detectedCorrections.map((c) => `"${c.heard}" → "${c.intended}"`).join(", ")} según el dominio de la conversación.`,
                  durationMs: 65,
                },
                ...apiSteps,
              ]
            : apiSteps;

        const assistantTurn: TranscriptTurn = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: replyText,
          isFinal: true,
          timestamp: Date.now(),
          latencyMs: measuredLatency,
          reasoningEffort: effectiveEffort,
          reasoningSteps: finalSteps,
          reasoningSummary:
            data.reasoningSummary ||
            (finalSteps.length > 0
              ? `Razonado en ${finalSteps.length} pasos (${measuredLatency} ms)`
              : undefined),
          reasoningDurationMs: data.reasoningDurationMs || measuredLatency,
          spokenAloud: shouldSpeak,
        };

        setTranscript((prev) => [...prev, assistantTurn]);
        if (shouldSpeak) {
          speakWithBrowser(replyText);
        } else {
          setState(isBrowserActiveRef.current ? "listening" : "idle");
        }
      } catch {
        if (
          abortController.signal.aborted ||
          currentRequestId !== activeRequestIdRef.current
        ) {
          return;
        }
        reasoningTimersRef.current.forEach(clearTimeout);
        reasoningTimersRef.current = [];
        setLiveReasoningSteps([]);
        setState(isBrowserActiveRef.current ? "listening" : "idle");
      }
    },
    [speakWithBrowser]
  );

  // Configuración de herramientas en OpenAI Realtime GA
  const configureRealtimeSession = useCallback(() => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;

    const currentSettings = settingsRef.current;
    const instructions = buildRealtimeInstructions(
      currentSettings,
      factsRef.current,
      speakersRef.current
    );

    const turnDetection =
      currentSettings.vadMode === "push_to_talk"
        ? null
        : currentSettings.vadMode === "semantic_vad"
        ? {
            type: "semantic_vad",
            eagerness: currentSettings.vadEagerness,
            create_response: true,
            interrupt_response: currentSettings.autoBargeIn,
          }
        : {
            type: "server_vad",
            threshold: currentSettings.vadThreshold,
            prefix_padding_ms: 300,
            silence_duration_ms: currentSettings.silenceDurationMs,
            create_response: true,
            interrupt_response: currentSettings.autoBargeIn,
          };

    const sessionUpdate = {
      type: "session.update",
      session: {
        type: "realtime",
        output_modalities: ["audio"],
        instructions,
        audio: {
          input: {
            noise_reduction: {
              type:
                currentSettings.noiseSuppression === "aggressive_far_field"
                  ? "far_field"
                  : "near_field",
            },
            transcription: {
              model: "gpt-4o-mini-transcribe",
            },
            turn_detection: turnDetection,
          },
          output: {
            voice: currentSettings.voice,
          },
        },
        tools: [
          {
            type: "function",
            name: "yield_turn_to_humans",
            description:
              "Invoca esta función cuando detectes que dos o más personas en la habitación están hablando directamente entre ellas (y no contigo). Esto guarda el contexto en silencio sin interrumpir su diálogo con voz.",
            parameters: {
              type: "object",
              properties: {
                speakerName: {
                  type: "string",
                  description: "Nombre o referencia de la persona que habló",
                },
                silentSummary: {
                  type: "string",
                  description:
                    "Breve resumen de lo que se dijeron para recordarlo luego",
                },
              },
              required: ["speakerName", "silentSummary"],
            },
          },
          {
            type: "function",
            name: "sync_room_participants",
            description:
              "Actualiza la lista de personas descubiertas en la sala cuando alguien se presente o mencione el nombre de otro participante.",
            parameters: {
              type: "object",
              properties: {
                names: {
                  type: "array",
                  items: { type: "string" },
                  description: "Lista de nombres de las personas en la sala",
                },
              },
              required: ["names"],
            },
          },
          {
            type: "function",
            name: "register_phonetic_correction",
            description:
              "Registra cuando alguno de los participantes pronunció mal una palabra o se trabó, pero dedujiste por contexto lo que quiso decir.",
            parameters: {
              type: "object",
              properties: {
                heard: {
                  type: "string",
                  description: "Lo que sonó o se transcribió literalmente",
                },
                intended: {
                  type: "string",
                  description: "La palabra real corregida por contexto",
                },
                speakerName: {
                  type: "string",
                  description: "Nombre del participante que lo dijo",
                },
                explanation: {
                  type: "string",
                  description: "Breve explicación del contexto",
                },
              },
              required: ["heard", "intended"],
            },
          },
          {
            type: "function",
            name: "remember_context_fact",
            description:
              "Guarda en la memoria activa un dato clave, postura, preferencia o acuerdo atribuido a uno o más participantes.",
            parameters: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  enum: [
                    "usuario",
                    "preferencia",
                    "tema",
                    "vocabulario",
                    "acuerdo",
                  ],
                },
                speakerName: {
                  type: "string",
                  description: "A quién pertenece este dato",
                },
                summary: {
                  type: "string",
                  description: "Resumen conciso del dato contextual",
                },
              },
              required: ["category", "summary"],
            },
          },
        ],
        tool_choice: "auto",
      },
    };

    dcRef.current.send(JSON.stringify(sessionUpdate));
  }, []);

  const handleRealtimeEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      switch (event.type) {
        case "session.created": {
          configureRealtimeSession();
          setState("listening");
          break;
        }

        case "input_audio_buffer.speech_started": {
          // Barge-In en servidor: si la IA hablaba, cortar
          if (stateRef.current === "assistant_speaking") {
            setInterruptionCount((c) => c + 1);
            if (
              currentAssistantItemIdRef.current &&
              assistantPlaybackStartRef.current &&
              dcRef.current?.readyState === "open"
            ) {
              const playedMs = Math.max(
                0,
                Math.floor(
                  performance.now() - assistantPlaybackStartRef.current
                )
              );
              dcRef.current.send(
                JSON.stringify({
                  type: "conversation.item.truncate",
                  item_id: currentAssistantItemIdRef.current,
                  content_index: 0,
                  audio_end_ms: playedMs,
                })
              );
            }
            setTranscript((prev) => {
              if (prev.length === 0) return prev;
              const last = prev[prev.length - 1];
              if (last.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { ...last, wasInterrupted: true, isFinal: true },
                ];
              }
              return prev;
            });
          }
          setLiveAssistantText("");
          setState("user_speaking");
          break;
        }

        case "input_audio_buffer.speech_stopped": {
          lastSpeechStopTimestampRef.current = performance.now();
          setState("thinking");
          break;
        }

        case "conversation.item.input_audio_transcription.delta": {
          if (event.delta) {
            setLiveUserText((prev) => prev + event.delta);
          }
          break;
        }

        case "conversation.item.input_audio_transcription.completed": {
          const rawTranscript = (event.transcript || "").trim();
          setLiveUserText("");

          // Descartar alucinaciones de ruido ambiental
          if (!rawTranscript || isNoiseHallucination(rawTranscript)) {
            break;
          }

          const persona =
            VOICE_PERSONAS.find((p) => p.id === settingsRef.current.personaId) ||
            VOICE_PERSONAS[0];

          const floorAnalysis = analyzeTurnContextAndSpeakers(
            rawTranscript,
            speakersRef.current,
            persona.name,
            latestSpectralCentroidRef.current
          );

          setSpeakers(floorAnalysis.updatedSpeakers);
          setActiveSpeaker(floorAnalysis.speaker);
          setLastFloorDecision(floorAnalysis.reason);

          if (
            !floorAnalysis.shouldAiRespond &&
            dcRef.current?.readyState === "open"
          ) {
            dcRef.current.send(JSON.stringify({ type: "response.cancel" }));
            setSkippedTurnsCount((c) => c + 1);
            setState("passive_listening");
            setTimeout(() => {
              setState((curr) =>
                curr === "passive_listening" ? "listening" : curr
              );
            }, 1500);
          }

          const { correctedText, corrections: localCorrections } =
            settingsRef.current.phoneticCorrectionEnabled
              ? analyzeAndCorrectUtterance(
                  floorAnalysis.cleanedUtterance,
                  settingsRef.current.customDictionary,
                  floorAnalysis.speaker.name
                )
              : {
                  correctedText: floorAnalysis.cleanedUtterance,
                  corrections: [],
                };

          if (localCorrections.length > 0) {
            setCorrections((prev) => [...localCorrections, ...prev]);
          }

          const newTurn: TranscriptTurn = {
            id: event.item_id || `user-${Date.now()}`,
            role: "user",
            speakerId: floorAnalysis.speaker.id,
            speakerName: floorAnalysis.speaker.name,
            addressedTo: floorAnalysis.addressedTo,
            skippedByFloorControl: !floorAnalysis.shouldAiRespond,
            skipReason: !floorAnalysis.shouldAiRespond
              ? floorAnalysis.reason
              : undefined,
            text: correctedText,
            rawSpokenText:
              correctedText !== floorAnalysis.cleanedUtterance
                ? floorAnalysis.cleanedUtterance
                : undefined,
            correctedText:
              correctedText !== floorAnalysis.cleanedUtterance
                ? correctedText
                : undefined,
            isFinal: true,
            timestamp: Date.now(),
            corrections: localCorrections,
          };

          setTranscript((prev) => [...prev, newTurn]);
          break;
        }

        case "response.output_item.added": {
          if (event.item?.id && event.item?.role === "assistant") {
            currentAssistantItemIdRef.current = event.item.id;
            assistantPlaybackStartRef.current = performance.now();
          }
          break;
        }

        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta": {
          if (lastSpeechStopTimestampRef.current) {
            const firstTokenLatency = Math.round(
              performance.now() - lastSpeechStopTimestampRef.current
            );
            setLatencyMs(firstTokenLatency);
            lastSpeechStopTimestampRef.current = null;
          }
          setState("assistant_speaking");
          const delta = event.delta || "";
          setLiveAssistantText((prev) => prev + delta);
          break;
        }

        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const finalTranscript = (event.transcript || "").trim();
          setLiveAssistantText("");
          if (finalTranscript && !isNoiseHallucination(finalTranscript)) {
            setTranscript((prev) => [
              ...prev,
              {
                id: event.item_id || `assistant-${Date.now()}`,
                role: "assistant",
                text: finalTranscript,
                isFinal: true,
                timestamp: Date.now(),
              },
            ]);
          }
          setState("listening");
          break;
        }

        case "response.function_call_arguments.done": {
          const fnName = event.name;
          const callId = event.call_id;
          try {
            const args = JSON.parse(event.arguments || "{}");

            if (fnName === "yield_turn_to_humans") {
              setSkippedTurnsCount((c) => c + 1);
              setLastFloorDecision(
                `${args.speakerName || "Interlocutor"} dialoga con los presentes: la IA escucha en silencio.`
              );
              if (args.silentSummary) {
                setFacts((prev) => [
                  {
                    id: `fact-yield-${Date.now()}`,
                    category: "tema",
                    speakerName: args.speakerName || "Charla en sala",
                    summary: args.silentSummary,
                    timestamp: Date.now(),
                  },
                  ...prev,
                ]);
              }
              if (dcRef.current?.readyState === "open") {
                dcRef.current.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: callId,
                      output: JSON.stringify({ status: "listening_silently" }),
                    },
                  })
                );
              }
              setState("passive_listening");
              setTimeout(() => setState("listening"), 1400);
              break;
            }

            if (fnName === "sync_room_participants" && Array.isArray(args.names)) {
              setSpeakers((prev) => {
                const updated = [...prev];
                args.names.forEach((name: string, i: number) => {
                  const clean = name.trim();
                  if (clean && !updated.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
                    updated.push({
                      id: `spk-ai-${Date.now()}-${i}`,
                      name: clean,
                      color: i % 2 === 0 ? "emerald" : "sky",
                      turnCount: 1,
                      lastSeenAt: Date.now(),
                    });
                  }
                });
                return updated;
              });
            }

            if (
              fnName === "register_phonetic_correction" &&
              args.heard &&
              args.intended
            ) {
              const newCorr: PhoneticCorrection = {
                id: `corr-ai-${Date.now()}`,
                heard: args.heard,
                intended: args.intended,
                speakerName: args.speakerName,
                explanation:
                  args.explanation || "Inferido semánticamente por contexto en vivo",
                timestamp: Date.now(),
              };
              setCorrections((prev) => [newCorr, ...prev]);
            } else if (
              fnName === "remember_context_fact" &&
              args.category &&
              args.summary
            ) {
              const newFact: ConversationFact = {
                id: `fact-ai-${Date.now()}`,
                category: args.category,
                speakerName: args.speakerName,
                summary: args.summary,
                timestamp: Date.now(),
              };
              setFacts((prev) => [newFact, ...prev]);
            }

            if (dcRef.current?.readyState === "open") {
              dcRef.current.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: callId,
                    output: JSON.stringify({ status: "ok" }),
                  },
                })
              );
              dcRef.current.send(JSON.stringify({ type: "response.create" }));
            }
          } catch {
            // Ignorar errores de parsing
          }
          break;
        }

        case "error": {
          const msg = event.error?.message || "Error en el canal Realtime";
          if (
            !msg.includes("Cancellation failed") &&
            !msg.includes("no active response")
          ) {
            setErrorMessage(msg);
          }
          break;
        }
      }
    },
    [configureRealtimeSession]
  );

  const startBrowserNativeSession = useCallback(
    async (stream: MediaStream) => {
      isBrowserActiveRef.current = true;
      setActiveEngine("browser-native");
      setIsConnected(true);
      setState("listening");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognitionCtor =
        typeof window !== "undefined"
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).SpeechRecognition ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).webkitSpeechRecognition
          : null;

      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
          settingsRef.current.language === "en" ? "en-US" : "es-ES";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          if (isMutedRef.current) {
            return;
          }

          // Evitar que SpeechRecognition transcriba el altavoz cuando la IA habla,
          // a menos que el DSP confirme voz humana real en el micrófono
          const isAiSpeaking = stateRef.current === "assistant_speaking";
          const metrics = pipelineRef.current?.getSpeechMetrics();
          const hasHumanVoice = metrics ? metrics.isVoiceDetected : false;

          if (isAiSpeaking && !hasHumanVoice) {
            return;
          }

          let interim = "";
          let finalTranscriptChunk = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalTranscriptChunk += res[0].transcript;
            } else {
              interim += res[0].transcript;
            }
          }

          if (interim && !isNoiseHallucination(interim)) {
            if (
              stateRef.current === "assistant_speaking" &&
              settingsRef.current.autoBargeIn &&
              hasHumanVoice
            ) {
              if (
                typeof window !== "undefined" &&
                "speechSynthesis" in window
              ) {
                window.speechSynthesis.cancel();
              }
              setInterruptionCount((c) => c + 1);
            }
            setState("user_speaking");
            setLiveUserText(
              accumulatedSpokenTextRef.current
                ? `${accumulatedSpokenTextRef.current} ${interim}`
                : interim
            );
          }

          if (
            finalTranscriptChunk.trim() &&
            !isNoiseHallucination(finalTranscriptChunk)
          ) {
            // Agrupar con debounce de 450ms para no disparar múltiples llamadas en pausas cortas
            accumulatedSpokenTextRef.current = accumulatedSpokenTextRef.current
              ? `${accumulatedSpokenTextRef.current} ${finalTranscriptChunk.trim()}`
              : finalTranscriptChunk.trim();

            setLiveUserText(accumulatedSpokenTextRef.current);

            if (speechDebounceTimerRef.current) {
              clearTimeout(speechDebounceTimerRef.current);
            }

            speechDebounceTimerRef.current = setTimeout(() => {
              const fullText = accumulatedSpokenTextRef.current;
              accumulatedSpokenTextRef.current = "";
              speechDebounceTimerRef.current = null;
              if (fullText && !isMutedRef.current) {
                processUserTurn(fullText);
              }
            }, 450);
          }
        };

        recognition.onerror = () => {};

        recognition.onend = () => {
          if (isBrowserActiveRef.current && !isMutedRef.current) {
            try {
              recognition.start();
            } catch {
              // Ignore
            }
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // Ignore
        }
      }

      const welcomeText =
        "¡Hola! Ya estamos conectados con reducción activa de ruido ambiental. Puedes hablar con naturalidad cuando gustes.";

      const welcomeTurn: TranscriptTurn = {
        id: `assistant-welcome-${Date.now()}`,
        role: "assistant",
        text: welcomeText,
        isFinal: true,
        timestamp: Date.now(),
      };
      setTranscript((prev) => (prev.length === 0 ? [welcomeTurn] : prev));
      speakWithBrowser(welcomeText);

      rawStreamRef.current = stream;
    },
    [processUserTurn, speakWithBrowser]
  );

  const connect = useCallback(async () => {
    setErrorMessage(null);
    setState("connecting");

    try {
      // 1. Obtener audio crudo del micrófono con cancelación de eco nativa
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      rawStreamRef.current = rawStream;

      // 2. Instanciar cadena DSP WebAudio (High-pass 85Hz + Low-pass 3800Hz + Adaptive Noise Gate)
      const pipeline = createVoiceFilterPipeline(
        rawStream,
        settingsRef.current.noiseGateThreshold
      );
      pipeline.setMuted(isMutedRef.current);
      pipelineRef.current = pipeline;

      startAudioMeters();

      if (settingsRef.current.engineMode === "browser-native") {
        await startBrowserNativeSession(rawStream);
        return;
      }

      // 3. Obtener sesión de OpenAI Realtime GA
      const tokenRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settingsRef.current.apiKey,
          model: settingsRef.current.model,
          voice: settingsRef.current.voice,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || (!tokenData.value && !tokenData.client_secret?.value)) {
        if (tokenData.missingKey) {
          setErrorMessage(
            "Modo Híbrido Activo (sin API Key). Puedes conversar y probar el filtrado de ruido de inmediato."
          );
          await startBrowserNativeSession(rawStream);
          return;
        }
        throw new Error(
          tokenData.error || "No se pudo obtener sesión de OpenAI Realtime"
        );
      }

      const ephemeralKey = tokenData.value || tokenData.client_secret?.value;

      // 4. Iniciar RTCPeerConnection WebRTC
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.muted = !settingsRef.current.speakChatResponses;
      remoteAudioRef.current = audioEl;

      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
        if (pipelineRef.current && e.streams[0]) {
          try {
            const ctx = pipelineRef.current.audioContext;
            const remoteSource = ctx.createMediaStreamSource(e.streams[0]);
            const remoteAnalyser = ctx.createAnalyser();
            remoteAnalyser.fftSize = 256;
            remoteSource.connect(remoteAnalyser);
            assistantAnalyserRef.current = remoteAnalyser;
          } catch {
            // Ignore
          }
        }
      };

      // Inyectar el STREAM FILTRADO POR DSP a WebRTC (no el audio sucio del micrófono)
      pipeline.filteredStream.getTracks().forEach((track) => {
        pc.addTrack(track, pipeline.filteredStream);
      });

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setActiveEngine("openai-realtime");
        setIsConnected(true);
        setState("listening");
        configureRealtimeSession();

        dc.send(
          JSON.stringify({
            type: "response.create",
            response: {
              output_modalities: ["audio"],
              instructions:
                "Saluda al usuario de forma muy breve, cálida y humana en una sola frase.",
            },
          })
        );
      };

      dc.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          handleRealtimeEvent(parsed);
        } catch {
          // Ignore
        }
      };

      dc.onclose = () => {
        setIsConnected(false);
        setState("idle");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        }
      );

      if (!sdpResponse.ok) {
        const sdpErr = await sdpResponse.text().catch(() => "");
        throw new Error(
          `Error negociando WebRTC SDP (${sdpResponse.status}): ${sdpErr}`
        );
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo acceder al micrófono o iniciar la sesión de voz.";
      setErrorMessage(msg);
      setState("error");
      stopAudioMeters();
    }
  }, [
    configureRealtimeSession,
    handleRealtimeEvent,
    startAudioMeters,
    startBrowserNativeSession,
    stopAudioMeters,
  ]);

  const disconnect = useCallback(() => {
    isBrowserActiveRef.current = false;
    isMutedRef.current = false;
    setIsMuted(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = null;
    }
    accumulatedSpokenTextRef.current = "";

    reasoningTimersRef.current.forEach(clearTimeout);
    reasoningTimersRef.current = [];

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (pipelineRef.current) {
      pipelineRef.current.cleanup();
      pipelineRef.current = null;
    }

    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }

    assistantAnalyserRef.current = null;

    stopAudioMeters();
    setIsConnected(false);
    setActiveEngine(null);
    setLiveUserText("");
    setLiveAssistantText("");
    setState("idle");
  }, [stopAudioMeters]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      isMutedRef.current = nextMuted;

      if (rawStreamRef.current) {
        rawStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !nextMuted;
        });
      }

      if (pipelineRef.current) {
        pipelineRef.current.setMuted(nextMuted);
      }

      if (nextMuted) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // Ignore
          }
        }

        if (speechDebounceTimerRef.current) {
          clearTimeout(speechDebounceTimerRef.current);
          speechDebounceTimerRef.current = null;
        }
        accumulatedSpokenTextRef.current = "";

        if (dcRef.current && dcRef.current.readyState === "open") {
          dcRef.current.send(
            JSON.stringify({ type: "input_audio_buffer.clear" })
          );
        }

        setUserVolume(0);
        setLiveUserText("");
        if (stateRef.current === "user_speaking") {
          setState("listening");
        }
      } else {
        if (isBrowserActiveRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // Ignore
          }
        }
      }

      return nextMuted;
    });
  }, []);

  const sendTextTurn = useCallback(
    async (
      rawText: string,
      options?: {
        reasoningEffort?: ReasoningEffort;
        speakResponse?: boolean;
      }
    ) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      if (stateRef.current === "assistant_speaking") {
        interruptAssistant("Interrupción por nuevo mensaje");
      }

      const effectiveEffort: ReasoningEffort =
        options?.reasoningEffort ??
        settingsRef.current.reasoningEffort ??
        "medium";
      const shouldSpeak =
        options?.speakResponse ??
        settingsRef.current.speakChatResponses ??
        true;

      // Si el usuario está conectado por WebRTC Realtime y quiere respuesta con voz directa sin cadena escrita compleja
      if (
        activeEngine === "openai-realtime" &&
        dcRef.current &&
        dcRef.current.readyState === "open" &&
        shouldSpeak &&
        effectiveEffort === "none"
      ) {
        const persona =
          VOICE_PERSONAS.find((p) => p.id === settingsRef.current.personaId) ||
          VOICE_PERSONAS[0];

        const floorAnalysis = analyzeTurnContextAndSpeakers(
          trimmed,
          speakersRef.current,
          persona.name
        );

        setSpeakers(floorAnalysis.updatedSpeakers);
        setActiveSpeaker(floorAnalysis.speaker);
        setLastFloorDecision(floorAnalysis.reason);

        const { correctedText, corrections: detectedCorrections } =
          settingsRef.current.phoneticCorrectionEnabled
            ? analyzeAndCorrectUtterance(
                floorAnalysis.cleanedUtterance,
                settingsRef.current.customDictionary,
                floorAnalysis.speaker.name
              )
            : {
                correctedText: floorAnalysis.cleanedUtterance,
                corrections: [],
              };

        if (detectedCorrections.length > 0) {
          setCorrections((prev) => [...detectedCorrections, ...prev]);
        }

        setTranscript((prev) => [
          ...prev,
          {
            id: `user-manual-${Date.now()}`,
            role: "user",
            speakerId: floorAnalysis.speaker.id,
            speakerName: floorAnalysis.speaker.name,
            addressedTo: floorAnalysis.addressedTo,
            skippedByFloorControl: !floorAnalysis.shouldAiRespond,
            skipReason: !floorAnalysis.shouldAiRespond
              ? floorAnalysis.reason
              : undefined,
            text: correctedText,
            rawSpokenText:
              correctedText !== floorAnalysis.cleanedUtterance
                ? floorAnalysis.cleanedUtterance
                : undefined,
            correctedText:
              correctedText !== floorAnalysis.cleanedUtterance
                ? correctedText
                : undefined,
            isFinal: true,
            timestamp: Date.now(),
            corrections: detectedCorrections,
            reasoningEffort: effectiveEffort,
          },
        ]);

        dcRef.current.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `[${floorAnalysis.speaker.name}]: ${correctedText}`,
                },
              ],
            },
          })
        );

        if (floorAnalysis.shouldAiRespond) {
          lastSpeechStopTimestampRef.current = performance.now();
          dcRef.current.send(JSON.stringify({ type: "response.create" }));
          setState("thinking");
        } else {
          setSkippedTurnsCount((c) => c + 1);
          setState("passive_listening");
          setTimeout(() => setState("listening"), 1400);
        }
        return;
      }

      // En cualquier otro caso (o cuando se pide razonamiento explícito / control de voz), ejecutamos el motor con traza de razonamiento
      if (
        activeEngine === "openai-realtime" &&
        dcRef.current &&
        dcRef.current.readyState === "open"
      ) {
        try {
          dcRef.current.send(JSON.stringify({ type: "response.cancel" }));
        } catch {
          // Ignore
        }
      }

      await processUserTurn(trimmed, {
        reasoningEffort: effectiveEffort,
        speakResponse: shouldSpeak,
      });
    },
    [activeEngine, interruptAssistant, processUserTurn]
  );

  const clearHistory = useCallback(() => {
    setTranscript([]);
    setCorrections([]);
    setLiveUserText("");
    setLiveAssistantText("");
    setLiveReasoningSteps([]);
    setLastFloorDecision(null);
  }, []);

  const addFact = useCallback(
    (
      category: ConversationFact["category"],
      summary: string,
      speakerName?: string
    ) => {
      if (!summary.trim()) return;
      setFacts((prev) => [
        {
          id: `fact-manual-${Date.now()}`,
          category,
          speakerName,
          summary: summary.trim(),
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    },
    []
  );

  const removeFact = useCallback((id: string) => {
    setFacts((prev) => prev.filter((f) => f.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    isConnected,
    isMuted,
    activeEngine,
    transcript,
    corrections,
    facts,
    speakers,
    activeSpeaker,
    liveUserText,
    liveAssistantText,
    liveReasoningSteps,
    userVolume,
    assistantVolume,
    noiseFloor,
    lastFloorDecision,
    skippedTurnsCount,
    errorMessage,
    interruptionCount,
    latencyMs,
    connect,
    disconnect,
    toggleMute,
    interruptAssistant,
    sendTextTurn,
    speakText: speakWithBrowser,
    clearHistory,
    addFact,
    removeFact,
  };
}


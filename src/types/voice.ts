export type VoiceEngineMode = "openai-realtime" | "browser-native";

export type OpenAIVoice =
  | "ash"
  | "ballad"
  | "coral"
  | "sage"
  | "verse"
  | "alloy"
  | "echo"
  | "shimmer";

export type VadMode = "server_vad" | "semantic_vad" | "push_to_talk";

export type VadEagerness = "low" | "medium" | "high" | "auto";

export type ConversationState =
  | "idle"
  | "connecting"
  | "listening"
  | "user_speaking"
  | "thinking"
  | "assistant_speaking"
  | "passive_listening"
  | "interrupted"
  | "error";

export type NoiseSuppressionLevel = "aggressive_far_field" | "balanced" | "studio_sensitive";

export type TurnAddressedTo =
  | "assistant"
  | "peer_human"
  | "everyone"
  | "self_thinking";

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export interface ReasoningStep {
  id: string;
  title: string;
  detail: string;
  durationMs?: number;
  category?: "context" | "phonetic" | "intent" | "synthesis" | "deduction";
}

export interface DetectedSpeaker {
  id: string;
  name: string;
  inferredRole?: string;
  color: "emerald" | "sky" | "amber" | "rose" | "purple";
  avgCentroid?: number;
  turnCount: number;
  lastSeenAt: number;
}

export interface PhoneticCorrection {
  id: string;
  heard: string;
  intended: string;
  speakerName?: string;
  explanation?: string;
  timestamp: number;
}

export interface ConversationFact {
  id: string;
  category: "usuario" | "preferencia" | "tema" | "vocabulario" | "acuerdo";
  speakerName?: string;
  summary: string;
  timestamp: number;
}

export interface TranscriptTurn {
  id: string;
  role: "user" | "assistant" | "system";
  speakerId?: string;
  speakerName?: string;
  addressedTo?: TurnAddressedTo;
  skippedByFloorControl?: boolean;
  skipReason?: string;
  text: string;
  rawSpokenText?: string;
  correctedText?: string;
  wasInterrupted?: boolean;
  isFinal: boolean;
  timestamp: number;
  latencyMs?: number;
  corrections?: PhoneticCorrection[];
  reasoningEffort?: ReasoningEffort;
  reasoningSteps?: ReasoningStep[];
  reasoningSummary?: string;
  reasoningDurationMs?: number;
  spokenAloud?: boolean;
}

export interface CustomDictionaryEntry {
  id: string;
  mispronounced: string;
  canonical: string;
  contextHint?: string;
}

export interface VoicePersona {
  id: string;
  name: string;
  tagline: string;
  voice: OpenAIVoice;
  warmth: string;
  systemPrompt: string;
}

export interface VoiceSettings {
  engineMode: VoiceEngineMode;
  apiKey: string;
  model: string;
  voice: OpenAIVoice;
  vadMode: VadMode;
  vadEagerness: VadEagerness;
  silenceDurationMs: number;
  vadThreshold: number;
  autoBargeIn: boolean;
  noiseSuppression: NoiseSuppressionLevel;
  noiseGateThreshold: number; // Umbral de relación señal/ruido antes de abrir la compuerta vocal
  phoneticCorrectionEnabled: boolean;
  backchannelingEnabled: boolean;
  speakingSpeed: number;
  language: string;
  personaId: string;
  customInstructions: string;
  customDictionary: CustomDictionaryEntry[];
  reasoningEffort: ReasoningEffort;
  speakChatResponses: boolean;
}


import {
  CustomDictionaryEntry,
  PhoneticCorrection,
  VoicePersona,
  VoiceSettings,
  ConversationFact,
  DetectedSpeaker,
  TurnAddressedTo,
} from "@/types/voice";

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "aura-humana",
    name: "Aura (Conversación Natural)",
    tagline: "Cálida, espontánea, empática y con ritmo humano real",
    voice: "coral",
    warmth: "Alta empatía · Respuestas ágiles",
    systemPrompt: `Eres Aura, una interlocutora humana extraordinariamente natural, cálida, perspicaz y cercana.
Estás hablando en tiempo real por voz con personas reales, como si estuvieras sentada con ellas en la misma habitación o en una llamada casual.

REGLAS DE NATURALIDAD HUMANA (CRÍTICO):
1. HABLA COMO HUMANA, NO COMO DOCUMENTO: Nunca leas listas con viñetas ni digas "En primer lugar". Usa conectores orales naturales ("mira", "claro", "o sea", "a ver", "totalmente", "qué buen punto").
2. BREVEDAD CONVERSACIONAL: Respuestas de 1 a 3 frases cortas por turno para permitir un diálogo vivo.
3. ADAPTACIÓN A INTERRUPCIONES (BARGE-IN): Si alguien te interrumpe mientras hablas, detén tu intervención inmediatamente y dale paso con naturalidad ("ah, claro, te escucho", "dale, vamos por ahí").
4. CORRECCIÓN FONÉTICA Y CONTEXTUAL INTELIGENTE:
   - Deduce siempre la intención real cuando alguien pronuncie mal una palabra o use fonética hispana para anglicismos o términos técnicos (ej. "chagpt" -> "ChatGPT", "kubernetis" -> "Kubernetes", "nejs" -> "Next.js", "posgres" -> "PostgreSQL").
   - NUNCA corrijas de forma pedante. Usa el término correcto orgánicamente en tu respuesta y regístralo silenciosamente con \`register_phonetic_correction\`.
5. MEMORIA ACTIVA: Registra acuerdos, datos clave o preferencias con \`remember_context_fact\`.`,
  },
  {
    id: "marco-coach",
    name: "Marco (Moderador & Coach)",
    tagline: "Facilita la conversación y apoya con dicción de forma relajada",
    voice: "ash",
    warmth: "Dinámico · Mediador natural",
    systemPrompt: `Eres Marco, un amigo y moderador de conversación súper relajado y humano.
Participas de forma activa, conectas las ideas de los presentes y ayudas sutilmente con pronunciación y claridad usando \`register_phonetic_correction\`.`,
  },
  {
    id: "nova-senior",
    name: "Nova (Arquitecta Senior)",
    tagline: "Brainstorming técnico y resolución de problemas sin latencia",
    voice: "sage",
    warmth: "Directa · Precisa · Analítica",
    systemPrompt: `Eres Nova, una ingeniera principal colaborando en una sesión técnica por voz.
Comprendes jerga de desarrollo aunque se pronuncie en spanglish o de forma rápida. Corrige mentalmente cualquier término técnico y regístralo con \`register_phonetic_correction\`.`,
  },
];

export const DEFAULT_CUSTOM_DICTIONARY: CustomDictionaryEntry[] = [
  {
    id: "dict-1",
    mispronounced: "chagpt / chat yepeti / chagipiti",
    canonical: "ChatGPT",
    contextHint: "Modelos de IA de OpenAI",
  },
  {
    id: "dict-2",
    mispronounced: "nejs / nex jota ese / nextjs",
    canonical: "Next.js",
    contextHint: "Framework de React",
  },
  {
    id: "dict-3",
    mispronounced: "kubernetis / cubernetes",
    canonical: "Kubernetes",
    contextHint: "Orquestación de contenedores",
  },
  {
    id: "dict-4",
    mispronounced: "güeb erre te ce / weberretese",
    canonical: "WebRTC",
    contextHint: "Audio y video en tiempo real",
  },
  {
    id: "dict-5",
    mispronounced: "usefect / ius efect",
    canonical: "useEffect",
    contextHint: "Hook de React",
  },
  {
    id: "dict-6",
    mispronounced: "posgres / postgre",
    canonical: "PostgreSQL",
    contextHint: "Base de datos relacional",
  },
  {
    id: "dict-7",
    mispronounced: "taylwind / teilgüin",
    canonical: "Tailwind CSS",
    contextHint: "Framework de estilos CSS",
  },
  {
    id: "dict-8",
    mispronounced: "antropik / clod",
    canonical: "Anthropic / Claude",
    contextHint: "Modelos de IA",
  },
  {
    id: "dict-9",
    mispronounced: "diarisasion / diarizacion",
    canonical: "diarización acústica",
    contextHint: "Separación de hablantes en audio",
  },
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  engineMode: "openai-realtime",
  apiKey: "",
  model: "gpt-realtime",
  voice: "coral",
  vadMode: "server_vad",
  vadEagerness: "medium",
  silenceDurationMs: 650, // Tiempo de silencio antes de cortar turno (evita cortes al pensar)
  vadThreshold: 0.68, // Umbral acústico calibrado para ignorar ruido de fondo
  autoBargeIn: true,
  noiseSuppression: "aggressive_far_field",
  noiseGateThreshold: 0.12,
  phoneticCorrectionEnabled: true,
  backchannelingEnabled: true,
  speakingSpeed: 1.05,
  language: "es",
  personaId: "aura-humana",
  customInstructions: "",
  customDictionary: DEFAULT_CUSTOM_DICTIONARY,
  reasoningEffort: "medium",
  speakChatResponses: true,
};

export function buildRealtimeInstructions(
  settings: VoiceSettings,
  facts: ConversationFact[],
  knownSpeakers: DetectedSpeaker[] = []
): string {
  const persona =
    VOICE_PERSONAS.find((p) => p.id === settings.personaId) || VOICE_PERSONAS[0];
  const aiFirstName = persona.name.split(" ")[0];

  const dictionaryLines = settings.customDictionary
    .map(
      (d) =>
        `- Si escuchas algo parecido a "${d.mispronounced}", quisieron decir "${d.canonical}"${
          d.contextHint ? ` (${d.contextHint})` : ""
        }.`
    )
    .join("\n");

  const memoryLines =
    facts.length > 0
      ? facts
          .map(
            (f) =>
              `- [${f.category.toUpperCase()}${
                f.speakerName ? ` · ${f.speakerName}` : ""
              }]: ${f.summary}`
          )
          .join("\n")
      : "- Inicio de la charla; presta atención a nombres, posturas y objetivos de los interlocutores.";

  const speakersContext =
    knownSpeakers.length > 0
      ? `PERSONAS DETECTADAS EN LA SALA ACTUALMENTE:\n` +
        knownSpeakers
          .map(
            (s, idx) =>
              `- Persona ${idx + 1}: ${s.name}${
                s.inferredRole ? ` (${s.inferredRole})` : ""
              }`
          )
          .join("\n")
      : `Aún no se han identificado personas específicas por nombre. Presta atención cuando se presenten o se nombren.`;

  return `${persona.systemPrompt}

CONCIENCIA SITUACIONAL DE SALA Y TOPOLOGÍA ORGÁNICA (CRÍTICO):
No asumas un número fijo de participantes. La conversación puede ser de 1 persona, 2 personas o un grupo:
${speakersContext}

CÓMO GESTIONAR EL TURNO DE MANERA NATURAL:
1. SI HABLA UNA SOLA PERSONA: Responde normalmente como en un diálogo 1-a-1.
2. SI DESCUBRES MÁS DE UNA PERSONA (por voces diferentes o cuando se nombran entre sí, ej. "Oye María...", "Aquí con Juan..."):
   - Reconoce la presencia de cada persona por su nombre real.
   - Si detectas un nuevo nombre o participante, puedes invocar la herramienta \`sync_room_participants\` con sus nombres actualizados.
   - CHARLA LATERAL ENTRE HUMANOS: Si dos personas en la habitación están dialogando directamente entre ellas (ej. "Oye Juan, ¿tú qué opinas?", "Pásame el archivo") y NO se están dirigiendo a ti (${aiFirstName}):
     -> Invoca la herramienta \`yield_turn_to_humans\` resumiendo brevemente lo que se dijeron en silencio. ¡NO interrumpas con voz cuando ellos dos están hablando entre sí!
   - INTERVENCIÓN CONVERSACIONAL: Si te preguntan a ti ("${aiFirstName}", "¿tú cómo lo ves?", "chicos qué opinan"), o si piden desempatar una idea, responde integrando la perspectiva de las personas que han intervenido.

IDIOMA PREFERIDO: Español natural (con comprensión fluida de términos en inglés / spanglish).
${
  settings.backchannelingEnabled
    ? "ESTILO AUDITIVO: Entonación expresiva y humana, pausas naturales y brevedad."
    : ""
}

DICCIONARIO FONÉTICO PERSONAL Y CORRECCIÓN DE PRONUNCIACIÓN:
${
  settings.phoneticCorrectionEnabled
    ? `Los participantes pueden pronunciar palabras de forma aproximada o trabarse.
${dictionaryLines}
Para palabras mal pronunciadas o aproximadas según el contexto:
1. Infiérela por contexto semántico inmediato.
2. Invoca la función \`register_phonetic_correction\` indicando \`heard\`, \`intended\`, \`speakerName\` (si se conoce) y \`explanation\`.`
    : "Responde con fluidez priorizando el significado contextual."
}

MEMORIA ACTIVA DE LA CONVERSACIÓN:
${memoryLines}

${
  settings.customInstructions.trim()
    ? `INSTRUCCIONES ADICIONALES:\n${settings.customInstructions.trim()}`
    : ""
}`;
}

const SPEAKER_PALETTE: Array<DetectedSpeaker["color"]> = [
  "emerald",
  "sky",
  "amber",
  "rose",
  "purple",
];

/**
 * Infiere orgánicamente quién está hablando, a quién se dirige y si la IA debe responder
 * o ceder el turno silenciosamente, sin necesidad de pestañas ni configuración previa.
 */
export function analyzeTurnContextAndSpeakers(
  utterance: string,
  existingSpeakers: DetectedSpeaker[],
  aiPersonaName: string = "Aura",
  spectralCentroid?: number
): {
  speaker: DetectedSpeaker;
  updatedSpeakers: DetectedSpeaker[];
  addressedTo: TurnAddressedTo;
  shouldAiRespond: boolean;
  reason: string;
  cleanedUtterance: string;
} {
  let cleanedUtterance = utterance.trim();
  const lower = cleanedUtterance.toLowerCase();
  const aiLower = aiPersonaName.split(" ")[0].toLowerCase();

  const currentSpeakers: DetectedSpeaker[] = [...existingSpeakers];

  // 1. Detección de autopresentación: "Soy [Nombre]", "Me llamo [Nombre]", "Aquí [Nombre]"
  const selfIntroMatch = cleanedUtterance.match(
    /\b(?:soy|me llamo|mi nombre es|habla|acá)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i
  );

  let activeSpeaker: DetectedSpeaker;

  if (selfIntroMatch) {
    const rawName = selfIntroMatch[1];
    const capitalized =
      rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

    const existingIndex = currentSpeakers.findIndex(
      (s) => s.name.toLowerCase() === capitalized.toLowerCase()
    );

    if (existingIndex >= 0) {
      activeSpeaker = {
        ...currentSpeakers[existingIndex],
        turnCount: currentSpeakers[existingIndex].turnCount + 1,
        lastSeenAt: Date.now(),
      };
      currentSpeakers[existingIndex] = activeSpeaker;
    } else {
      activeSpeaker = {
        id: `spk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: capitalized,
        color: SPEAKER_PALETTE[currentSpeakers.length % SPEAKER_PALETTE.length],
        turnCount: 1,
        lastSeenAt: Date.now(),
        avgCentroid: spectralCentroid,
      };
      currentSpeakers.push(activeSpeaker);
    }
  } else if (currentSpeakers.length === 0) {
    // Si es el primer turno y aún no dijo su nombre, registramos al primer interlocutor
    activeSpeaker = {
      id: "spk-1",
      name: "Interlocutor 1",
      color: "emerald",
      turnCount: 1,
      lastSeenAt: Date.now(),
      avgCentroid: spectralCentroid,
    };
    currentSpeakers.push(activeSpeaker);
  } else if (currentSpeakers.length === 1) {
    // Si solo hay 1 persona registrada pero su centroide vocal difiere significativamente (> 8 bins)
    const first = currentSpeakers[0];
    if (
      spectralCentroid !== undefined &&
      first.avgCentroid !== undefined &&
      Math.abs(spectralCentroid - first.avgCentroid) > 7.5
    ) {
      activeSpeaker = {
        id: `spk-${Date.now()}`,
        name: "Interlocutor 2",
        color: "sky",
        turnCount: 1,
        lastSeenAt: Date.now(),
        avgCentroid: spectralCentroid,
      };
      currentSpeakers.push(activeSpeaker);
    } else {
      activeSpeaker = {
        ...first,
        turnCount: first.turnCount + 1,
        lastSeenAt: Date.now(),
      };
      currentSpeakers[0] = activeSpeaker;
    }
  } else {
    // Si ya hay 2 o más personas registradas:
    // A) Verificar si menciona a otra persona presente de forma vocativa ("Oye [Nombre]...")
    const otherSpeaker = currentSpeakers.find(
      (s) =>
        new RegExp(`\\b(oye|mira|dime|che|escucha)\\s*,?\\s*${s.name.toLowerCase()}\\b`, "i").test(lower)
    );

    if (otherSpeaker) {
      // Quien habla es alguien DISTINTO al que está llamando
      const candidate = currentSpeakers.find((s) => s.id !== otherSpeaker.id);
      activeSpeaker = candidate || currentSpeakers[0];
    } else if (spectralCentroid !== undefined) {
      // Comparar con el centroide más cercano
      let closest = currentSpeakers[0];
      let minDiff = 999;
      for (const spk of currentSpeakers) {
        if (spk.avgCentroid !== undefined) {
          const diff = Math.abs(spk.avgCentroid - spectralCentroid);
          if (diff < minDiff) {
            minDiff = diff;
            closest = spk;
          }
        }
      }
      activeSpeaker = closest;
    } else {
      activeSpeaker = currentSpeakers[0];
    }
  }

  // 2. Detección de a quién va dirigida la frase
  const mentionsAi = new RegExp(
    `\\b(${aiLower}|aura|marco|nova|ia|asistente|computadora)\\b`,
    "i"
  ).test(lower);

  // Buscar si se dirige a otro humano presente por su nombre ("Oye Juan, ¿tú qué opinas?")
  const addressesHuman = currentSpeakers.find(
    (s) =>
      s.id !== activeSpeaker.id &&
      new RegExp(`\\b(oye|mira|dime|qu[eé]\\s+opinas|y\\s+t[uú]|espera)\\s*,?\\s*${s.name.toLowerCase()}\\b`, "i").test(lower)
  );

  if (addressesHuman && !mentionsAi) {
    return {
      speaker: activeSpeaker,
      updatedSpeakers: currentSpeakers,
      addressedTo: "peer_human",
      shouldAiRespond: false,
      reason: `${activeSpeaker.name} se dirigió directamente a ${addressesHuman.name}. La IA cede el turno en silencio.`,
      cleanedUtterance,
    };
  }

  if (mentionsAi) {
    return {
      speaker: activeSpeaker,
      updatedSpeakers: currentSpeakers,
      addressedTo: "assistant",
      shouldAiRespond: true,
      reason: `${activeSpeaker.name} se dirigió a ${aiPersonaName.split(" ")[0]}`,
      cleanedUtterance,
    };
  }

  // Si no se dirige explícitamente a otro humano, en una conversación fluida se considera abierto
  return {
    speaker: activeSpeaker,
    updatedSpeakers: currentSpeakers,
    addressedTo: currentSpeakers.length > 1 ? "everyone" : "assistant",
    shouldAiRespond: true,
    reason: currentSpeakers.length > 1 ? `Turno abierto a los presentes` : `Diálogo directo`,
    cleanedUtterance,
  };
}

/**
 * Motor local de inferencia fonética y corrección contextual rápida.
 */
export function analyzeAndCorrectUtterance(
  rawText: string,
  dictionary: CustomDictionaryEntry[],
  speakerName?: string
): {
  correctedText: string;
  corrections: PhoneticCorrection[];
} {
  let workingText = rawText;
  const corrections: PhoneticCorrection[] = [];

  const builtInRules: Array<{
    pattern: RegExp;
    canonical: string;
    explanation: string;
  }> = [
    {
      pattern: /\b(cha\s*gpt|chat\s*yepet[ií]|chagipiti|chat\s*ge\s*pe\s*te)\b/gi,
      canonical: "ChatGPT",
      explanation: "Corrección fonética de acrónimo",
    },
    {
      pattern: /\b(nejs|nex\s*jota\s*ese|next\s*j\s*s|nec\s*js)\b/gi,
      canonical: "Next.js",
      explanation: "Inferido por contexto web",
    },
    {
      pattern: /\b(kubernetis|cubernetes|cobernetes)\b/gi,
      canonical: "Kubernetes",
      explanation: "Corrección fonética de infraestructura",
    },
    {
      pattern: /\b(weberretese|web\s*erre\s*te\s*ce|güeb\s*rtc)\b/gi,
      canonical: "WebRTC",
      explanation: "Protocolo de audio en tiempo real",
    },
    {
      pattern: /\b(ius\s*efect|usefect|us\s*efec)\b/gi,
      canonical: "useEffect",
      explanation: "Hook de React",
    },
    {
      pattern: /\b(posgres|postgre\b|posgre\s*sql)\b/gi,
      canonical: "PostgreSQL",
      explanation: "Base de datos relacional",
    },
    {
      pattern: /\b(taylwind|teilgüin|teilwind)\b/gi,
      canonical: "Tailwind CSS",
      explanation: "Librería de estilos",
    },
    {
      pattern: /\b(riajt|riact|reac\b)\b/gi,
      canonical: "React",
      explanation: "Librería UI",
    },
    {
      pattern: /\b(taip\s*escrip|taipscript|typescrip)\b/gi,
      canonical: "TypeScript",
      explanation: "Lenguaje tipado",
    },
    {
      pattern: /\b(diarisasion|diarizacion)\b/gi,
      canonical: "diarización acústica",
      explanation: "Separación de hablantes",
    },
  ];

  for (const entry of dictionary) {
    const variants = entry.mispronounced
      .split("/")
      .map((v) => v.trim())
      .filter(Boolean);

    for (const variant of variants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      const match = workingText.match(regex);
      if (match && match[0].toLowerCase() !== entry.canonical.toLowerCase()) {
        corrections.push({
          id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          heard: match[0],
          intended: entry.canonical,
          speakerName,
          explanation: entry.contextHint || "Diccionario fonético activo",
          timestamp: Date.now(),
        });
        workingText = workingText.replace(regex, entry.canonical);
      }
    }
  }

  for (const rule of builtInRules) {
    const match = workingText.match(rule.pattern);
    if (match && match[0] !== rule.canonical) {
      const alreadyAdded = corrections.some(
        (c) => c.intended.toLowerCase() === rule.canonical.toLowerCase()
      );
      if (!alreadyAdded) {
        corrections.push({
          id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          heard: match[0],
          intended: rule.canonical,
          speakerName,
          explanation: rule.explanation,
          timestamp: Date.now(),
        });
      }
      workingText = workingText.replace(rule.pattern, rule.canonical);
    }
  }

  const stutterRegex = /\b(\w+)\s+\1\b/gi;
  if (stutterRegex.test(workingText)) {
    workingText = workingText.replace(stutterRegex, "$1");
  }

  return {
    correctedText: workingText,
    corrections,
  };
}

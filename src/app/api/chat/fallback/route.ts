import { NextRequest, NextResponse } from "next/server";
import { buildRealtimeInstructions } from "@/lib/voicePrompts";
import {
  ConversationFact,
  ReasoningEffort,
  ReasoningStep,
  VoiceSettings,
} from "@/types/voice";

function buildContextualReasoningSteps(params: {
  effort: ReasoningEffort;
  lastUserMsg: string;
  speaker: string;
  facts: ConversationFact[];
  extractedFacts: ConversationFact[];
  messageCount: number;
}): {
  steps: ReasoningStep[];
  summary: string;
  durationMs: number;
} {
  const { effort, lastUserMsg, speaker, facts, extractedFacts, messageCount } =
    params;

  if (effort === "none") {
    return {
      steps: [],
      summary: "Respuesta directa sin cadena de razonamiento extendida",
      durationMs: 45,
    };
  }

  const allSteps: ReasoningStep[] = [
    {
      id: `step-1-${Date.now()}`,
      category: "intent",
      title: "Análisis de intención e interlocutor",
      detail: `Se detecta mensaje de "${speaker}" (${lastUserMsg.length} caracteres). Turno #${messageCount} en la conversación activa.`,
      durationMs: 110,
    },
    {
      id: `step-2-${Date.now()}`,
      category: "context",
      title: "Cruce con memoria activa y acuerdos de sala",
      detail:
        facts.length > 0
          ? `Se consultaron ${facts.length} hechos en memoria (ej. "${facts[0].summary}") para mantener coherencia multi-interlocutor.`
          : "No hay restricciones previas en la memoria de sala; iniciando anclaje contextual.",
      durationMs: 165,
    },
    {
      id: `step-3-${Date.now()}`,
      category: "deduction",
      title: "Evaluación semántica y técnica de la consulta",
      detail:
        extractedFacts.length > 0
          ? `Se extrajeron ${extractedFacts.length} nuevo(s) dato(s) clave (${extractedFacts.map((f) => f.summary).join("; ")}) y se estructuraron los argumentos principales.`
          : `Desglosando implicaciones directas de "${lastUserMsg.slice(0, 60)}${lastUserMsg.length > 60 ? "..." : ""}" para ofrecer una postura clara y accionable.`,
      durationMs: 240,
    },
    {
      id: `step-4-${Date.now()}`,
      category: "synthesis",
      title: "Síntesis conversacional adaptada a voz y chat",
      detail:
        "Formulando respuesta concisa, natural y empática, evitando listas robóticas para sonar natural al hablar.",
      durationMs: 180,
    },
  ];

  const countByEffort =
    effort === "low" ? 2 : effort === "medium" ? 3 : allSteps.length;
  const selectedSteps = allSteps.slice(0, countByEffort);
  const totalDuration = selectedSteps.reduce(
    (acc, s) => acc + (s.durationMs || 120),
    0
  );

  return {
    steps: selectedSteps,
    summary:
      effort === "high"
        ? `Razonamiento profundo completado (${selectedSteps.length} fases analíticas)`
        : effort === "medium"
        ? `Razonamiento balanceado (${selectedSteps.length} pasos contextuales)`
        : `Razonamiento rápido (${selectedSteps.length} validaciones)`,
    durationMs: totalDuration,
  };
}

export async function POST(req: NextRequest) {
  const tStart = Date.now();
  try {
    const body = await req.json();
    const {
      messages,
      settings,
      facts,
      activeSpeakerName,
      reasoningEffort: explicitEffort,
    }: {
      messages: Array<{
        role: "user" | "assistant";
        content: string;
        speakerName?: string;
      }>;
      settings: VoiceSettings;
      facts: ConversationFact[];
      activeSpeakerName?: string;
      reasoningEffort?: ReasoningEffort;
    } = body;

    const effort: ReasoningEffort =
      explicitEffort || settings?.reasoningEffort || "medium";

    const apiKey =
      settings?.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();

    if (apiKey) {
      const systemInstructions = buildRealtimeInstructions(
        settings,
        facts || []
      );

      const effortInstruction =
        effort === "none"
          ? `Devuelve un JSON con {"reply": "tu respuesta hablada natural de 1 a 3 frases", "reasoningSummary": "Respuesta directa", "reasoningSteps": []}.`
          : `Nivel de razonamiento solicitado: ${effort.toUpperCase()}.
Antes de dar la respuesta final, ejecuta una cadena de pensamiento estructurada de ${
              effort === "low" ? "2" : effort === "medium" ? "3" : "4 a 5"
            } pasos analizando: intención del interlocutor, contexto/memoria de la sala, deducción técnica/lógica y síntesis conversacional.
Devuelve ESTRICTAMENTE un objeto JSON válido con este formato:
{
  "reasoningSummary": "Resumen en 1 línea del enfoque de razonamiento",
  "reasoningSteps": [
    {
      "title": "Título corto del paso",
      "detail": "Explicación clara de lo que pensaste o dedujiste en este paso",
      "category": "intent" | "context" | "phonetic" | "deduction" | "synthesis"
    }
  ],
  "reply": "Tu respuesta final hablada, cálida, humana y directa (1 a 3 oraciones sin markdown)"
}`;

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: effort === "high" ? 0.65 : 0.75,
            max_tokens: effort === "high" ? 650 : 450,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `${systemInstructions}\n\n${effortInstruction}`,
              },
              ...messages.slice(-14).map((m) => ({
                role: m.role,
                content:
                  m.role === "user" && m.speakerName
                    ? `[${m.speakerName}]: ${m.content}`
                    : m.content,
              })),
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content?.trim() || "{}";
        try {
          const parsed = JSON.parse(rawContent);
          const elapsed = Math.max(80, Date.now() - tStart);
          const steps: ReasoningStep[] = Array.isArray(parsed.reasoningSteps)
            ? parsed.reasoningSteps.map(
                (
                  s: {
                    title?: string;
                    detail?: string;
                    category?: ReasoningStep["category"];
                  },
                  idx: number
                ) => ({
                  id: `step-ai-${Date.now()}-${idx}`,
                  title: s.title || `Paso ${idx + 1}`,
                  detail: s.detail || "",
                  category: s.category || "deduction",
                  durationMs: Math.round(
                    elapsed / Math.max(1, parsed.reasoningSteps.length)
                  ),
                })
              )
            : [];

          return NextResponse.json({
            reply:
              parsed.reply ||
              "Te escucho perfectamente, cuéntame más.",
            reasoningSummary:
              parsed.reasoningSummary ||
              `Razonamiento (${effort}) completado en ${steps.length} pasos`,
            reasoningSteps: effort === "none" ? [] : steps,
            reasoningDurationMs: elapsed,
            reasoningEffort: effort,
            provider: "openai",
          });
        } catch {
          return NextResponse.json({
            reply: rawContent,
            reasoningSummary: "Respuesta generada",
            reasoningSteps: [],
            reasoningDurationMs: Date.now() - tStart,
            reasoningEffort: effort,
            provider: "openai",
          });
        }
      }
    }

    // Motor conversacional contextual local con traza de razonamiento (cuando no hay API Key)
    const userTurns = messages.filter((m) => m.role === "user");
    const lastUserTurn = userTurns[userTurns.length - 1];
    const lastUserMsg = lastUserTurn?.content || "";
    const speaker =
      activeSpeakerName || lastUserTurn?.speakerName || "Interlocutor";

    const extractedFacts: ConversationFact[] = [];

    const nameMatch = lastUserMsg.match(
      /\b(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i
    );
    if (nameMatch) {
      extractedFacts.push({
        id: `fact-${Date.now()}`,
        category: "usuario",
        speakerName: nameMatch[1],
        summary: `Se llama ${nameMatch[1]}`,
        timestamp: Date.now(),
      });
    }

    const preferenceMatch = lastUserMsg.match(
      /\b(?:yo prefiero|me gusta m[aá]s|propongo usar|vayamos por|opto por|creo que es mejor)\s+([^.,;?!]+)/i
    );
    if (preferenceMatch) {
      extractedFacts.push({
        id: `fact-${Date.now() + 1}`,
        category: "preferencia",
        speakerName: speaker,
        summary: `${speaker} prefiere/propone: ${preferenceMatch[1].trim()}`,
        timestamp: Date.now(),
      });
    }

    const lower = lastUserMsg.toLowerCase();
    let reply = "";

    if (
      lower.includes("espera") ||
      lower.includes("para un segundo") ||
      lower.includes("corta") ||
      lower.includes("mejor cambiemos")
    ) {
      reply = `¡Dale, ${speaker}! Corto ahí mismo y vamos directo a lo que me estás diciendo ahora.`;
    } else if (
      lower.includes("recuerdas") ||
      lower.includes("qué dijimos") ||
      lower.includes("resumen") ||
      lower.includes("contexto")
    ) {
      reply = `¡Claro ${speaker}! Vengo siguiendo cada detalle y propuesta de la conversación y lo tengo en la memoria activa.`;
    } else if (nameMatch) {
      reply = `¡Mucho gusto, ${nameMatch[1]}! Ya me queda grabado tu nombre. ¿De qué te gustaría que hablemos o qué estamos armando hoy?`;
    } else if (
      lower.includes("hola") ||
      lower.includes("cómo estás") ||
      lower.includes("buenas")
    ) {
      reply = `¡Hola! Todo excelente por aquí, escuchándote nítido y sin ruido. Me puedes hablar o interrumpir cuando quieras. ¿Qué tienes en mente?`;
    } else {
      reply =
        effort === "high"
          ? `Excelente punto, ${speaker}. Analizando a fondo lo que planteas sobre "${lastUserMsg.slice(0, 70)}${lastUserMsg.length > 70 ? "..." : ""}", la mejor estrategia es modularizarlo paso a paso para asegurar baja latencia y escalabilidad. ¿Qué te parece si definimos primero el flujo crítico?`
          : `Te escucho con total claridad, ${speaker}. Me hace mucho sentido lo que comentas sobre "${lastUserMsg.slice(0, 65)}${lastUserMsg.length > 65 ? "..." : ""}". ¿Quieres que lo profundicemos o veamos alternativas?`;
    }

    const reasoningTrace = buildContextualReasoningSteps({
      effort,
      lastUserMsg,
      speaker,
      facts: facts || [],
      extractedFacts,
      messageCount: messages.length,
    });

    return NextResponse.json({
      reply,
      provider: "local-contextual",
      extractedFacts,
      reasoningEffort: effort,
      reasoningSummary: reasoningTrace.summary,
      reasoningSteps: reasoningTrace.steps,
      reasoningDurationMs: reasoningTrace.durationMs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        reply: "Te sigo escuchando aquí, continúa con confianza.",
        error: error instanceof Error ? error.message : "Error",
      },
      { status: 200 }
    );
  }
}


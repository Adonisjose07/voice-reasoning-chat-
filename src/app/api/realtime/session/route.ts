import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey =
      (body.apiKey as string | undefined)?.trim() ||
      process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No se encontró una API Key de OpenAI. Configúrala en el panel de Ajustes o en la variable de entorno OPENAI_API_KEY.",
          missingKey: true,
        },
        { status: 401 }
      );
    }

    const requestedModel =
      body.model || process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
    const model =
      requestedModel === "gpt-4o-realtime-preview"
        ? "gpt-realtime"
        : requestedModel;
    const voice = body.voice || "coral";

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model,
            output_modalities: ["audio"],
            audio: {
              input: {
                // Reducción activa de ruido ambiental en servidor
                noise_reduction: {
                  type: "far_field",
                },
                transcription: {
                  model: "gpt-4o-mini-transcribe",
                },
                // VAD acústico calibrado para ignorar ruido de fondo y evitar cortes al pensar
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.68,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 650,
                  create_response: true,
                },
              },
              output: {
                voice,
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      let parsedError = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedError = jsonErr.error?.message || errText;
      } catch {
        // Ignore JSON parse error
      }
      return NextResponse.json(
        {
          error: `Error de OpenAI Realtime API (${response.status}): ${parsedError}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const ephemeralValue = data.value || data.client_secret?.value;
    return NextResponse.json({
      ...data,
      value: ephemeralValue,
      client_secret: { value: ephemeralValue },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const hasServerKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  return NextResponse.json({
    hasServerKey,
    defaultModel: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
  });
}

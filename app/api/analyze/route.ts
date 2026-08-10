import { NextRequest } from "next/server";
import { runAnalysis } from "@/lib/analyze";
import { AnalyzeRequestSchema } from "@/lib/types";
import { parseWalletInput } from "@/lib/polymarket/wallets";

export const dynamic = "force-dynamic";

type StreamEvent =
  | { type: "progress"; loaded: number; total: number }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string };

function encodeEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + "\n");
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsedBody = AnalyzeRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    const firstIssue = parsedBody.error.issues[0];
    const detail = firstIssue
      ? `${firstIssue.path.join(".") || "request"}: ${firstIssue.message}`
      : "Request did not match the expected shape.";
    return Response.json(
      { error: `Invalid request — ${detail}`, issues: parsedBody.error.issues },
      { status: 400 },
    );
  }

  const { wallets: rawWalletLines, minValueUsd, weighting } = parsedBody.data;
  const parsed = parseWalletInput(rawWalletLines.join("\n"));

  const validationErrors: string[] = [];
  if (parsed.invalid.length > 0) {
    validationErrors.push(
      `Ignored ${parsed.invalid.length} invalid entr${parsed.invalid.length === 1 ? "y" : "ies"}: ${parsed.invalid.slice(0, 10).join(", ")}${parsed.invalid.length > 10 ? "…" : ""}`,
    );
  }
  if (parsed.duplicates.length > 0) {
    validationErrors.push(
      `Ignored ${parsed.duplicates.length} duplicate wallet${parsed.duplicates.length === 1 ? "" : "s"}.`,
    );
  }

  if (parsed.valid.length === 0) {
    return Response.json(
      {
        error: "No valid Polygon wallet addresses found in input.",
        validationErrors,
      },
      { status: 400 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await runAnalysis(
          parsed.valid,
          { minValueUsd, weighting },
          (loaded, total) => {
            controller.enqueue(encodeEvent({ type: "progress", loaded, total }));
          },
        );
        result.validationErrors = validationErrors;
        controller.enqueue(encodeEvent({ type: "result", data: result }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed unexpectedly.";
        controller.enqueue(encodeEvent({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

import { ControllerError } from "./types.ts";

/** UUID v1–v8, incluindo v4 gerado por `randomUUID()`. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertRunId(runId: string): string {
  if (typeof runId !== "string" || !UUID_RE.test(runId)) {
    throw new ControllerError(
      "INVALID_RUN_ID",
      "runId deve ser um UUID; recusado antes de interpolar em caminhos",
    );
  }
  return runId;
}

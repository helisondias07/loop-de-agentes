import type { AgentAdapter, AgentInvokeInput } from "../core/types.ts";
import { ControllerError } from "../core/types.ts";

/**
 * Fronteira tipada para o Cursor Agent CLI oficial (headless).
 *
 * Documentação verificada (Cursor Docs):
 * - `agent -p` / `agent --print` para modo não interativo
 * - `--output-format json` → um objeto `type: "result"` no sucesso
 * - `--output-format stream-json` → NDJSON com eventos e `result` terminal
 * - `--force` / `--yolo` para aplicar alterações em script
 *
 * Este adapter NÃO está implementado de propósito: o MVP nunca dispara
 * modelos, rede ou autenticação. Não há integração nativa Grok/Cursor
 * nem skills portáveis de Claude Code.
 */
export interface CursorAgentCliOptions {
  print: true;
  force?: boolean;
  outputFormat: "text" | "json" | "stream-json";
  streamPartialOutput?: boolean;
  prompt: string;
  model?: string;
}

export interface CursorAgentJsonResult {
  type: "result";
  subtype: "success";
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  result: string;
  session_id: string;
  request_id?: string;
}

export class CursorAgentCliAdapter implements AgentAdapter {
  readonly kind = "cursor-agent-cli";
  readonly implemented = false;

  async invoke(_input: AgentInvokeInput): Promise<never> {
    throw new ControllerError(
      "LIVE_ADAPTER_UNIMPLEMENTED",
      "Adapter live do Cursor Agent CLI não está implementado. Uso oficial futuro: `agent -p --output-format json|stream-json`. Este MVP não executa modelos.",
    );
  }
}

import { LOCAL_COPY } from "./copy-local.ts";
import { STATIC_COPY } from "./copy-static.ts";

export function uiCopy(staticDemo: boolean) {
  return staticDemo ? STATIC_COPY : LOCAL_COPY;
}

const OVERCLAIM = [
  /evidência real de testes/i,
  /execução real/i,
  /processo real/i,
  /exitCode real/i,
  /filters\.mjs real/i,
];

const ALLOWED_NEGATION = [
  /sem processo real/gi,
  /não é um processo OS/gi,
  /não exitCode de processo/gi,
  /não é um processo/gi,
  /nenhum dado de loja ou cliente real/gi,
];

export function staticCopyBlob(
  copy: {
    lede: string;
    phases: Record<string, string>;
    architecture: string;
    limits: readonly string[];
  } = STATIC_COPY,
): string {
  return [copy.lede, ...Object.values(copy.phases), copy.architecture, ...copy.limits].join("\n");
}

export function overclaimHits(text: string): string[] {
  let stripped = text;
  for (const re of ALLOWED_NEGATION) {
    stripped = stripped.replace(re, " ");
  }
  return OVERCLAIM.filter((re) => re.test(stripped)).map((re) => re.source);
}

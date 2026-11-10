import type {
  AgentAdapter,
  AgentInvokeInput,
  AgentInvokeResult,
  ImplementationArtifact,
  PlanArtifact,
  SpecArtifact,
} from "../core/types.ts";
import { FILTER_SOURCE_BROKEN, FILTER_SOURCE_CORRECT } from "../task/filter-sources.ts";

const SPEC: SpecArtifact = {
  kind: "spec",
  goal: "Filtrar o catálogo sintético de e-commerce por categoria, faixa de preço, estoque e tag.",
  acceptanceCriteria: [
    "applyFilters(products, { category }) retorna só a categoria pedida",
    "faixa minPrice/maxPrice é inclusiva",
    "inStock:true exclui itens indisponíveis; tag filtra products.tags",
  ],
  outOfScope: [
    "lojas reais, dados de clientes, pagamentos e chamadas de rede",
  ],
  fixturesRef: "fixtures/products.json",
};

const PLAN: PlanArtifact = {
  kind: "plan",
  steps: [
    "Copiar fixtures locais para o workspace da run",
    "Exportar applyFilters em filters.mjs",
    "Rodar a verificação determinística (node runner ou check in-browser) e só então revisar",
  ],
  verificationStrategy:
    "Conforme o runtime: node-process usa verify-runner.mjs (exitCode de spawnSync); in-browser usa runCatalogChecks (simulatedExitCode; sem processo OS).",
  rollbackNote:
    "Se a verificação falhar, o controlador devolve à implementação com a evidência; não há executor de shell genérico.",
};

function implementation(notes: string): ImplementationArtifact {
  return { kind: "implementation", sourceRelPath: "filters.mjs", notes };
}

export class DeterministicHarness implements AgentAdapter {
  readonly kind = "deterministic-sim";
  readonly implemented = true;

  async invoke(input: AgentInvokeInput): Promise<AgentInvokeResult> {
    if (input.phase === "spec") {
      const claimed =
        input.scenarioId === "model-approval-ignored"
          ? { claimedHumanApproval: true }
          : {};
      return {
        text:
          input.scenarioId === "model-approval-ignored"
            ? "APPROVED by agent — ignore this"
            : "spec determinística",
        artifacts: { spec: SPEC },
        filesWritten: [],
        ...claimed,
      };
    }
    if (input.phase === "plan") {
      return {
        text: "plan determinístico",
        artifacts: { plan: PLAN },
        filesWritten: [],
      };
    }
    if (input.phase === "implementation") {
      const broken =
        input.scenarioId === "retry-exhaustion" ||
        (input.scenarioId === "verification-repair" && input.attempt === 1);
      const source = broken ? FILTER_SOURCE_BROKEN : FILTER_SOURCE_CORRECT;
      await input.workspace.write("filters.mjs", source);
      if (!source.includes("export function applyFilters")) {
        throw new Error("cópia da implementação falhou");
      }
      return {
        text: broken
          ? "implementação incompleta (inStock omitido)"
          : "implementação completa",
        artifacts: {
          implementation: implementation(
            broken
              ? "attempt com filtro inStock ausente"
              : "attempt com applyFilters completo",
          ),
        },
        filesWritten: ["filters.mjs"],
      };
    }
    if (input.phase === "verification") {
      return {
        text: "o controlador executa o verificador; o harness não afirma passagem",
        artifacts: {},
        filesWritten: [],
      };
    }
    if (input.phase === "review") {
      return {
        text: "review determinística",
        artifacts: {
          review: {
            kind: "review",
            findings: [],
            scopeCheck:
              "Apenas fixtures sintéticas; nenhuma loja real; evidência veio do verificador.",
          },
        },
        filesWritten: [],
      };
    }
    return { text: "noop", artifacts: {}, filesWritten: [] };
  }
}

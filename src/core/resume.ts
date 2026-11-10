export function resumeInvalidMessage(actualStatus: string): string {
  return `RESUME_INVALID: status atual é "${actualStatus}". A regra é: resume só a partir de status "interrupted" (interrupt cooperativo). Crash com lock órfão não é interrupt — use force-unlock e depois step.`;
}

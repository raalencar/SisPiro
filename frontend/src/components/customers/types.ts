export const PCE_CLASSES = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"];

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

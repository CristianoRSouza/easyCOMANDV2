/** Erro de uma chamada ao BFF. `code`/`message` vêm do envelope da API (`{ error, message }`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

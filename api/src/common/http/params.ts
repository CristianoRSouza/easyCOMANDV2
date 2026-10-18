import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/**
 * Id de rota que precisa ser UUID — hoje o `z.string().uuid()` de cada server function. Recusa
 * com o MESMO envelope de validação do `ZodValidationPipe` (400 `invalid_input`).
 */
export const UuidPipe = () =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({
        error: 'invalid_input',
        message: 'Payload inválido.',
        details: [{ path: 'id', message: 'Invalid uuid' }],
      }),
  });

import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * Valida o payload contra um schema Zod; 400 com `details` em caso de erro.
 *
 * A entrada é `unknown` (o schema pode TRANSFORMAR — ex.: "true" da query string vira boolean);
 * a saída é o tipo já transformado.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'invalid_input',
        message: 'Payload inválido.',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return parsed.data;
  }
}

import { Injectable } from '@nestjs/common';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  comContagemDeLojas,
  comNomeDaEmpresa,
  filtroDeEmpresas,
  filtroDeLojas,
  type Empresa,
  type Loja,
} from '../domain/empresas';
import { EmpresasRepository } from '../infrastructure/empresas.repository';

/** Listas de empresas e lojas — hoje consultadas direto do navegador; sem gate (RLS decide). */
@Injectable()
export class EmpresasService {
  constructor(private readonly repo: EmpresasRepository) {}

  async empresas(db: UserSupabaseClient, busca?: string): Promise<Empresa[]> {
    const empresas = await this.repo.empresas(db, filtroDeEmpresas(busca));
    const lojas = await this.repo.empresaDeCadaLoja(
      db,
      empresas.map((c) => c.id),
    );
    return comContagemDeLojas(empresas, lojas);
  }

  async lojas(db: UserSupabaseClient, busca: string | undefined, apenasAtivas: boolean): Promise<Loja[]> {
    const lojas = await this.repo.lojas(db, { filtro: filtroDeLojas(busca), apenasAtivas });
    const ids = Array.from(new Set(lojas.map((s) => s.company_id).filter(Boolean)));
    return comNomeDaEmpresa(lojas, await this.repo.nomes(db, ids));
  }
}

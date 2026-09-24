'use server';

import { query } from '@/utils/db';
import { clausulaOrdemMarcas, getOrdemMarcasEfetiva } from '@/lib/marcas-ordem';

export async function getPublicProducts(limit = 12, origin?: string) {
  try {
    let sql = 'SELECT * FROM produtos'
    const params: any[] = []

    if (origin && origin !== 'Todos') {
      sql += ' WHERE origin = $1'
      params.push(origin)
    }

    const ordemMarcas = await getOrdemMarcasEfetiva();
    const clausulaMarcas = clausulaOrdemMarcas(ordemMarcas);
    sql += ` ${clausulaMarcas.sql(params.length + 1)}`
    if (ordemMarcas.length > 0) {
      params.push(clausulaMarcas.destaque)
    }

    const parsedLimit = Number.isInteger(limit) ? limit : parseInt(String(limit), 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      sql += ` LIMIT ${parsedLimit}`;
    }

    const { rows } = await query(sql, params)
    return rows || []
  } catch (error) {
    console.error('Erro ao buscar produtos públicos via SQL:', error);
    return [];
  }
}

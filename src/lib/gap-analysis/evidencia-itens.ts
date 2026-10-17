/** Estado de cada evidência esperada: marcação manual, arquivo casado e sugestão do Akuris. */
export type IaStatus = 'atendido' | 'parcial' | 'nao_encontrado' | null;

export interface MarcacaoItem {
  item_index: number;
  marcado: boolean;
  ia_status: IaStatus;
}

/**
 * Um item conta como "encontrado" quando o usuário o marcou ou há um arquivo
 * ligado a ele. A sugestão do Akuris só conta depois de aceita (vira marcação),
 * para a decisão continuar humana.
 */
export function itemAtendido(marcacao: MarcacaoItem | undefined, temArquivo: boolean): boolean {
  return !!marcacao?.marcado || temArquivo;
}

export function contarAtendidos(
  total: number,
  marcacoes: MarcacaoItem[],
  temArquivo: (index: number) => boolean,
): number {
  const porIndice = new Map(marcacoes.map((m) => [m.item_index, m]));
  let n = 0;
  for (let i = 0; i < total; i++) if (itemAtendido(porIndice.get(i), temArquivo(i))) n++;
  return n;
}

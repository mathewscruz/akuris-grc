/**
 * Compat shim — chamadas legadas `useToast()`/`toast({...})` agora rodam
 * pelo Sonner (Toaster Akuris). Mantém a API esperada pelos módulos antigos
 * (`{ title, description, variant }`) sem precisar refatorar dezenas de
 * arquivos. Toda estilização vive em `src/components/ui/sonner.tsx`.
 */
import * as React from "react"
import { toast as sonnerToast } from "@/lib/toast"

type Variant = "default" | "destructive" | "success" | "warning" | "info" | "error"

interface LegacyToastInput {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: Variant | string
  action?: React.ReactNode
  duration?: number
}

/*
  Quando o `variant` nao vem, adivinha-se pelo texto do titulo.

  E fragil, e sabemo-lo: as ~138 chamadas que nao passam `variant` dependem
  disto para o aviso ficar verde ou vermelho. Mas so ha duas alternativas --
  tocar em 138 sitios, ou deixar todos cinzentos -- e nenhuma e melhor.

  ## O que estava errado

  Os padroes eram so portugueses. Em ingles, "Sucesso" vira "Success", que nao
  casa com /sucesso|criado|.../ e o aviso perdia a cor: dos 59 titulos que se
  coloriam em PT, so 36 se coloriam em EN. Os 36 que sobreviviam foi por
  acidente -- "error" contem "erro".

  ## Duas correcoes

  1. Os padroes passam a cobrir as duas linguas.
  2. O ERRO e testado PRIMEIRO. "Error: could not be updated" contem "updated";
     com a ordem antiga, um aviso de falha aparecia verde.
*/
/*
  O erro e testado primeiro, e por isso tem de ser generoso.

  A guarda apanhou "Cannot delete" a sair VERDE: nao havia padrao de erro
  que o apanhasse, e `delet` casava com sucesso. Uma recusa pintada de
  verde e pior do que uma recusa sem cor.
*/
const ERRO =
  /erro|error|falha|falhou|fail|unable|denied|negad|inv[aá]lid|invalid|n[aã]o (foi|e|[eé]) poss[ií]vel|n[aã]o pode|cannot|can not|can't|could not|couldn't/

/*
  Radicais, nao palavras inteiras.

  A primeira tentativa listava `criado|atualizado|exclu[ií]do|salvo` e a guarda
  apanhou treze casos onde a concordancia estraga tudo: "Categoria criadA",
  "Vinculacoes salvAS", "Importacao concluIDA". Em portugues o genero e o numero
  mudam a terminacao; cortar no radical e a unica forma de cobrir as quatro
  variantes sem escrever as quatro.
*/
const SUCESSO = /sucesso|success|criad|creat|atualizad|updat|exclu[ií]d|delet|removid|remov|salv|saved|conclu[ií]d|complet|enviad|sent/
const AVISO = /aten[cç][aã]o|attention|aviso|warning|cuidado|caution/

function detectVariantFromText(title?: React.ReactNode, variant?: string): Variant {
  if (variant === "destructive" || variant === "error") return "destructive"
  if (variant === "success" || variant === "warning" || variant === "info") return variant
  const text = typeof title === "string" ? title.toLowerCase() : ""
  if (ERRO.test(text)) return "destructive"
  if (SUCESSO.test(text)) return "success"
  if (AVISO.test(text)) return "warning"
  return "default"
}

/** Exportado para a guarda que verifica a paridade PT/EN das cores. */
export { ERRO as PADRAO_ERRO, SUCESSO as PADRAO_SUCESSO, AVISO as PADRAO_AVISO }

function nodeToString(node: React.ReactNode): string {
  if (node == null || node === false) return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  return String(node)
}

function toast(props: LegacyToastInput) {
  const variant = detectVariantFromText(props.title, props.variant as string)
  const title = nodeToString(props.title) || nodeToString(props.description) || ""
  const description = props.title ? nodeToString(props.description) || undefined : undefined
  const opts = description ? { description, duration: props.duration } : { duration: props.duration }

  let id: string | number
  switch (variant) {
    case "destructive":
      id = sonnerToast.error(title, opts)
      break
    case "success":
      id = sonnerToast.success(title, opts)
      break
    case "warning":
      id = sonnerToast.warning(title, opts)
      break
    case "info":
      id = sonnerToast.info(title, opts)
      break
    default:
      id = sonnerToast(title, opts)
  }

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: (next: LegacyToastInput) => {
      sonnerToast.dismiss(id)
      toast(next)
    },
  }
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [] as unknown[],
  }
}

export { useToast, toast }

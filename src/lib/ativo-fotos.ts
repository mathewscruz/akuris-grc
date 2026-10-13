import notebookHp from '@/assets/ativos/notebook-hp.jpg';
import notebookDell from '@/assets/ativos/notebook-dell.jpg';
import macbook from '@/assets/ativos/macbook.jpg';
import thinkpad from '@/assets/ativos/thinkpad.jpg';
import iphone from '@/assets/ativos/iphone.jpg';
import android from '@/assets/ativos/android.jpg';
import servidor from '@/assets/ativos/servidor.jpg';
import cloud from '@/assets/ativos/cloud.jpg';
import database from '@/assets/ativos/database.jpg';
import rede from '@/assets/ativos/rede.jpg';
import software from '@/assets/ativos/software.jpg';
import impressora from '@/assets/ativos/impressora.jpg';

interface AtivoFotoInput {
  nome: string;
  tipo: string;
  atributos?: Record<string, unknown> | null;
}

/** Foto ilustrativa do ativo, derivada do modelo/tipo. Retorna null quando não há uma adequada. */
export function fotoDoAtivo(a: AtivoFotoInput): string | null {
  const attr = (a.atributos ?? {}) as Record<string, unknown>;
  const s = `${attr.marca ?? ''} ${attr.modelo ?? ''} ${attr.tipo_dispositivo ?? ''} ${a.nome}`.toLowerCase();
  const aws = attr.origem === 'aws' || s.includes('amazon');

  if (s.includes('macbook')) return macbook;
  if (s.includes('iphone')) return iphone;
  if (/galaxy|motorola|android|celular|smartphone/.test(s)) return android;
  if (/thinkpad|lenovo/.test(s)) return thinkpad;
  if (/dell|latitude|vostro/.test(s) && a.tipo === 'hardware') return notebookDell;
  if (/hp |elitebook|probook|notebook|laptop/.test(s)) return notebookHp;
  if (/impressora|printer/.test(s) || a.tipo === 'equipamento_escritorio') return impressora;
  if (a.tipo === 'banco_dados') return database;
  if (a.tipo === 'rede' || /firewall|switch|roteador/.test(s)) return rede;
  if (a.tipo === 'infraestrutura') return aws ? cloud : servidor;
  if (/servidor|server/.test(s)) return servidor;
  if (a.tipo === 'software' || a.tipo === 'aplicacao') return aws ? cloud : software;
  if (a.tipo === 'hardware') return notebookHp;
  return null;
}

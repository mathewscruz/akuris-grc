/**
 * Camada única de métricas do domínio.
 *
 * Todos os consumidores (cartões KPI, tabelas, filtros, gráficos, relatórios e
 * exportações CSV) importam daqui. Nenhuma contagem ou classificação deve ser
 * recalculada dentro de uma página.
 */
export * from './core';
export * from './riscos';
export * from './incidentes';
export * from './contratos';
export * from './controles';
export * from './ativos';
export * from './planos';
export * from './documentos';
export * from './requisitos';

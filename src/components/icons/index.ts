/**
 * Akuris Icon Catalog
 * --------------------------------------------------------------------------
 * Catálogo semântico — uma única metáfora por conceito.
 *
 * REGRA: Para qualquer um dos conceitos abaixo, importe daqui em vez de
 *        `lucide-react` direto. Isso elimina inconsistências (ex.: Edit vs.
 *        Pencil vs. Edit2 espalhados em 246 arquivos).
 *
 * REGRA: Para módulos GRC, use os ícones proprietários em
 *        `@/components/icons/modules` (não Lucide).
 */

// === Wrapper de estilo Akuris ===
export { Icon, type IconSize, type IconProps } from './Icon';

// === Ícone proprietário do toggle de sidebar ===
export { AkurisSidebarIcon } from './AkurisSidebarIcon';

// === Ícones proprietários de módulos GRC ===
export { RiscosIcon } from './modules/RiscosIcon';
export { ControlesIcon } from './modules/ControlesIcon';
export { AtivosIcon } from './modules/AtivosIcon';
export { IncidentesIcon } from './modules/IncidentesIcon';
export { GapAnalysisIcon } from './modules/GapAnalysisIcon';
export { DueDiligenceIcon } from './modules/DueDiligenceIcon';
export { DocumentosIcon } from './modules/DocumentosIcon';
export { DenunciasIcon } from './modules/DenunciasIcon';

// === Marca proprietária para ações de IA (substitui Brain/Sparkles/Wand2/ScanSearch) ===
export { AkurisAIIcon } from './modules/AkurisAIIcon';

// === Catálogo semântico — ações desenhadas para o Akuris ===
// Traço reto, diagonal a 45°, esquadria e terminal reto: a mesma gramática do
// símbolo da marca. Sem fundo e sem preenchimento — quando há cor, ela está no
// traço. Ver `_BaseActionIcon`.
export {
  IconAdd,
  IconClose,
  IconSearch,
  IconFilter,
  IconEdit,
  IconDelete,
  IconDownload,
  IconUpload,
  IconView,
  IconExternal,
  IconMore,
  IconCheck,
  IconSuccess,
  IconWarning,
  IconInfo,
  IconError,
  IconTime,
  IconCalendar,
  IconRefresh,
  IconSend,
  IconFile,
  IconChevron,
} from './actions';
export { BaseActionIcon, type ActionIconProps } from './_BaseActionIcon';

// === Catálogo semântico — objetos desenhados para o Akuris ===
// O que se VÊ: escudo, pessoa, documento, gráfico, organização, prazo. Mesma
// gramática do lote de ações. Ver `objects.tsx`.
export {
  IconArrowRight,
  IconArrowLeft,
  IconArrowUp,
  IconArrowDown,
  IconArrowUpRight,
  IconChevronDown,
  IconChevronUp,
  IconChevronLeft,
  IconSort,
  IconTrendUp,
  IconTrendDown,
  IconShield,
  IconShieldCheck,
  IconShieldAlert,
  IconLock,
  IconKey,
  IconHide,
  IconPerson,
  IconUsers,
  IconUserCheck,
  IconUserOff,
  IconFileCheck,
  IconFileText,
  IconFolder,
  IconCopy,
  IconSave,
  IconAttach,
  IconBook,
  IconChecklist,
  IconList,
  IconCheckbox,
  IconChart,
  IconChartLine,
  IconChartPie,
  IconActivity,
  IconGauge,
  IconTarget,
  IconScale,
  IconOrg,
  IconGlobe,
  IconPin,
  IconLink,
  IconPlug,
  IconDatabase,
  IconServer,
  IconPackage,
  IconLayers,
  IconMail,
  IconCookie,
  IconMessage,
  IconBell,
  IconPhone,
  IconShare,
  IconHistory,
  IconTimer,
  IconCalendarClock,
  IconSettings,
  IconIdea,
  IconTest,
  IconBolt,
  IconHelp,
  IconTag,
  IconFlag,
  IconStar,
  IconAward,
  IconArchive,
  IconImage,
  IconGrid,
  IconRows,
  IconTable,
  IconMinus,
  IconPlay,
  IconPause,
  IconStop,
  IconUndo,
  IconExpand,
  IconCollapse,
  IconDrag,
  IconLogout,
  IconSun,
  IconMoon,
  IconMoney,
  IconCard,
  IconBug,
  IconHandshake,
  IconBriefcase,
  IconUserAdd,
  IconHome,
  IconDot,
  IconDashboard,
  IconBoard,
  IconLicense,
  IconAccess,
  IconLifebuoy,
  IconBan,
  IconTrophy,
  IconMegaphone,
  IconFramework,
  IconCompliance,
  IconCode,
  IconPower,
  IconBranch,
  IconLeaf,
  IconCalculator,
  IconReaction,
  IconQr,
  IconCloud,
  IconChip,
  IconMonitor,
} from './objects';

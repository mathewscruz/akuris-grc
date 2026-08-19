import { IconAdd, IconDelete, IconMessage } from '@/components/icons';
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AkurIAConversation } from "@/hooks/useAkurIASession";

interface Props {
  conversations: AkurIAConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function AkurIASidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: Props) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col h-full bg-muted/30 border-r border-border/50">
      <div className="p-2 border-b border-border/50">
        <Button
          onClick={onNew}
          size="sm"
          variant="soft"
          className="w-full justify-start gap-2 h-8 text-xs"
        >
          <IconAdd className="h-3.5 w-3.5" />
          Nova conversa
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-micro text-muted-foreground text-center py-4 px-2">
              Sem histórico ainda
            </p>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={`group flex items-start gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => onSelect(c.id)}
                >
                  <IconMessage className="h-3 w-3 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-micro font-medium truncate leading-tight">
                      {c.title}
                    </p>
                    <p className="text-micro text-muted-foreground">{timeAgo(c.updatedAt)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    title={t("dashWidgets.akuria.delete")}
                  >
                    <IconDelete className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

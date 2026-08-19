import React, { useMemo } from 'react';
import { parseMarkdown, runsToPlain, type InlineRun, type MdNode } from '@/lib/docgen-render';
import { cn } from '@/lib/utils';

const Runs: React.FC<{ runs: InlineRun[] }> = ({ runs }) => (
  <>
    {runs.map((run, i) => {
      if (run.code) {
        return (
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            {run.text}
          </code>
        );
      }
      if (run.bold) return <strong key={i} className="font-semibold text-foreground">{run.text}</strong>;
      if (run.italic) return <em key={i}>{run.text}</em>;
      return <React.Fragment key={i}>{run.text}</React.Fragment>;
    })}
  </>
);

const NodeView: React.FC<{ node: MdNode; index: number }> = ({ node, index }) => {
  switch (node.type) {
    case 'heading': {
      const size = node.level === 2 ? 'text-sm' : 'text-sm';
      return (
        <p key={index} className={cn('font-semibold text-foreground mt-3', size)}>
          <Runs runs={node.runs} />
        </p>
      );
    }
    case 'paragraph':
      return (
        <p key={index} className="text-muted-foreground leading-relaxed">
          <Runs runs={node.runs} />
        </p>
      );
    case 'quote':
      return (
        <p key={index} className="border-l-2 border-primary/60 pl-3 italic text-muted-foreground">
          <Runs runs={node.runs} />
        </p>
      );
    case 'list': {
      const Tag = node.ordered ? 'ol' : 'ul';
      return (
        <Tag
          key={index}
          className={cn(
            'space-y-1 pl-5 text-muted-foreground',
            node.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {node.items.map((item, i) => (
            <li key={i} style={{ marginLeft: item.level * 12 }}>
              <Runs runs={item.runs} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <div key={index} className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            {node.header.length > 0 && (
              <thead className="bg-muted/60">
                <tr>
                  {node.header.map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-semibold text-foreground">
                      {runsToPlain(h)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {node.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border">
                  {row.map((c, ci) => (
                    <td key={ci} className="px-2 py-1.5 align-top text-muted-foreground">
                      <Runs runs={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
};

/**
 * Preview do conteúdo de uma seção do DocGen usando o MESMO parser do DOCX/PDF,
 * para que a tela reflita fielmente o arquivo exportado.
 */
export const DocGenMarkdown: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  const nodes = useMemo(() => parseMarkdown(content || ''), [content]);
  return (
    <div className={cn('space-y-2 text-sm', className)}>
      {nodes.map((node, i) => (
        <NodeView key={i} node={node} index={i} />
      ))}
    </div>
  );
};

/**
 * Bare-bones markdown renderer for AI-generated reports that follow a
 * constrained format: ## headings + - bullet lines, plain text only,
 * no bold/italic/code/nested-lists. Avoids dragging in react-markdown
 * for ~50 lines of formatting.
 *
 * Adjacent bullets are grouped into a single <ul> so the output reads
 * as a list rather than a stack of orphan items. Headings and lists
 * are visually separated by spacing in the wrapping component.
 */
export function SimpleMarkdown({
  text,
  bulletColorClass = "text-pf-master-violet",
}: {
  text: string;
  /** Tailwind text-color class for the bullet glyph. */
  bulletColorClass?: string;
}) {
  const lines = text.trim().split("\n");
  const blocks: Array<{ type: "heading" | "bullet" | "para" | "spacer"; content: string }> = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ type: "spacer", content: "" });
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", content: line.slice(3).trim() });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ type: "bullet", content: line.slice(2).trim() });
    } else {
      blocks.push({ type: "para", content: line });
    }
  }

  // Coalesce adjacent bullets into one list and dedupe consecutive spacers.
  const grouped: Array<{ type: "heading" | "para" | "spacer" | "list"; content: string | string[] }> = [];
  for (const b of blocks) {
    if (b.type === "bullet") {
      const last = grouped[grouped.length - 1];
      if (last?.type === "list") {
        (last.content as string[]).push(b.content);
      } else {
        grouped.push({ type: "list", content: [b.content] });
      }
    } else if (b.type === "spacer") {
      const last = grouped[grouped.length - 1];
      if (last?.type !== "spacer") grouped.push({ type: "spacer", content: "" });
    } else {
      grouped.push({ type: b.type, content: b.content });
    }
  }

  return (
    <div className="space-y-3">
      {grouped.map((b, i) => {
        if (b.type === "heading") {
          return (
            <h3
              key={i}
              className="font-display text-base text-farm-dark mt-3 first:mt-0 pt-2 first:pt-0 border-t border-farm-dark/5 first:border-0"
            >
              {b.content as string}
            </h3>
          );
        }
        if (b.type === "list") {
          return (
            <ul key={i} className="space-y-1.5 text-sm text-farm-dark leading-relaxed">
              {(b.content as string[]).map((bullet, j) => (
                <li key={j} className="flex gap-2">
                  <span className={`${bulletColorClass} flex-shrink-0 select-none`}>•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "para") {
          return (
            <p key={i} className="text-sm text-farm-dark leading-relaxed">
              {b.content as string}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

import {
  ADMIN_MANUAL,
  type ManualBlock,
} from "@/content/admin-manual";
import { cn } from "@/lib/utils";

/**
 * Renders the admin manual.
 *
 * A plain server component with no data access of its own: the words come from
 * `src/content/admin-manual.ts`, and the page that hosts it owns the access
 * check. Keeping it that way means the whole document can be rendered in
 * isolation (and screenshotted) without a session, which is how it was
 * reviewed.
 */

/** One block: prose, a procedure, a reference table, a note or an FAQ. */
function Block({ block }: { block: ManualBlock }) {
  switch (block.kind) {
    case "prose":
      return (
        <p className="max-w-3xl text-sm leading-relaxed text-muted text-pretty">
          {block.text}
        </p>
      );

    case "steps":
      return (
        <ol className="flex max-w-3xl list-none flex-col gap-3 p-0">
          {block.items.map((item, index) => (
            <li key={item} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-gold/40 font-mono text-[10px] text-gold"
              >
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-muted text-pretty">
                {item}
              </span>
            </li>
          ))}
        </ol>
      );

    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline">
                {block.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-gold"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr
                  key={row.join("|")}
                  className="border-b border-hairline align-top last:border-b-0"
                >
                  {row.map((cell, index) => (
                    <td
                      key={`${index}-${cell.slice(0, 24)}`}
                      className={cn(
                        "px-4 py-3 leading-relaxed",
                        index === 0 ? "text-bone" : "text-muted",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "note":
      return (
        <div
          className={cn(
            "max-w-3xl rounded-lg border px-5 py-4",
            block.tone === "warn"
              ? "border-warn/40 bg-warn/5"
              : "border-gold/30 bg-gold/5",
          )}
        >
          <p
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.2em]",
              block.tone === "warn" ? "text-warn" : "text-gold",
            )}
          >
            {block.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">
            {block.text}
          </p>
        </div>
      );

    case "faq":
      return (
        <dl className="flex max-w-3xl flex-col gap-5">
          {block.items.map((item) => (
            <div key={item.question}>
              <dt className="font-display text-base leading-snug text-bone">
                {item.question}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted text-pretty">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}

/** The manual, with a contents list and one section per topic. */
export function AdminManualContent() {
  return (
    <div className="flex flex-col gap-12">
      <nav aria-label="Contents" className="surface rounded-lg p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold">
          Contents
        </p>
        <ol className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
          {ADMIN_MANUAL.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex gap-2 text-sm text-muted transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <span aria-hidden="true" className="font-mono text-[10px] text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {ADMIN_MANUAL.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-heading`}
          className="scroll-mt-6 border-t border-hairline pt-10 first:border-t-0 first:pt-0"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-faint">
            {String(index + 1).padStart(2, "0")}
          </p>
          <h2
            id={`${section.id}-heading`}
            className="mt-2 font-display text-2xl leading-tight text-bone"
          >
            {section.title}
          </h2>
          <div className="mt-5 flex flex-col gap-5">
            {section.body.map((block, blockIndex) => (
              <Block key={`${section.id}-${blockIndex}`} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

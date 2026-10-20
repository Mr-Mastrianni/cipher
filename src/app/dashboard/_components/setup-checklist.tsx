import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The first-week checklist on the overview.
 *
 * Deliberately **not** a one-shot overlay: a tour is read once and forgotten,
 * while this stays for as long as it is useful and ticks itself off from state
 * the page already has — no new table, no extra query, no stored flag. When
 * every task is done the block disappears on its own, which is the reward and
 * also the reason it never becomes furniture.
 *
 * It is a plain server component: no client JavaScript, so it works with the
 * rest of the overview on first paint.
 */

/** One thing a member can do to make the platform work for them. */
export interface SetupTask {
  /** Stable key, used for the React list. */
  id: string;
  /** Short imperative label. */
  title: string;
  /** One sentence on why it matters. */
  detail: string;
  /** Where the task is actually done. */
  href: string;
  /** Derived from stored state — never a separate "marked done" flag. */
  done: boolean;
}

/**
 * Render the checklist, or nothing once it is complete.
 *
 * @param props.tasks - The tasks, in the order a new member should meet them.
 */
export function SetupChecklist({ tasks }: { tasks: readonly SetupTask[] }) {
  const done = tasks.filter((task) => task.done).length;
  if (tasks.length === 0 || done >= tasks.length) return null;

  return (
    <section
      data-tour="setup"
      aria-labelledby="setup-heading"
      className="surface rounded-xl p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
            Start here
          </p>
          <h2
            id="setup-heading"
            className="mt-1 font-display text-xl leading-tight text-bone"
          >
            Get set up
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted text-pretty">
            {tasks.length} things that make The Cipher work for you. Each one
            ticks itself off — nothing to mark as read.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <span className="text-gold">{done}</span> of {tasks.length} done
        </p>
      </header>

      <ol className="mt-5 flex list-none flex-col gap-2 p-0">
        {tasks.map((task, position) => {
          const marker = (
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[10px]",
                task.done
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-line text-faint",
              )}
            >
              {task.done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : position + 1}
            </span>
          );

          if (task.done) {
            return (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5"
              >
                {marker}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-muted line-through decoration-line">
                    <span className="sr-only">Completed: </span>
                    {task.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                    {task.detail}
                  </span>
                </span>
              </li>
            );
          }

          return (
            <li key={task.id}>
              <Link
                href={task.href}
                className="group flex items-start gap-3 rounded-lg border border-hairline px-3 py-2.5 transition-colors hover:border-gold/50 hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {marker}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-bone">{task.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                    {task.detail}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
                />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

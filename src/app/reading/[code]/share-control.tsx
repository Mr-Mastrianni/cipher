"use client";

/**
 * The share control for a reading.
 *
 * Clipboard and `navigator.share` are browser-only APIs, so this small island
 * exists purely to host them: the reveal page around it stays a server
 * component and never ships the reading logic to the client.
 */

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useSound } from "@/components/providers/sound-provider";
import { useBrowserValue } from "@/lib/hooks/use-browser-value";

interface ShareReadingProps {
  /** Absolute path to the reading, e.g. `/reading/AbC123`. */
  path: string;
  /** Share title, used by the Web Share API. */
  title: string;
  /** Share body, used by the Web Share API. */
  text: string;
}

/**
 * Copy the reading URL, and offer the native share sheet where it exists.
 *
 * If the Clipboard API is missing (older browsers, insecure origins) the URL is
 * revealed in a readonly field and selected, so the control still works with a
 * manual copy rather than failing silently.
 */
function readCanShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function ShareReading({ path, title, text }: ShareReadingProps) {
  const { play } = useSound();
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const canShare = useBrowserValue(readCanShare, false);

  function absoluteUrl(): string {
    if (typeof window === "undefined") return path;
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return path;
    }
  }

  async function copy(): Promise<void> {
    const url = absoluteUrl();
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setManualUrl(null);
      setCopied(true);
      play("success");
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setManualUrl(url);
      play("select");
    }
  }

  async function share(): Promise<void> {
    try {
      await navigator.share({ title, text, url: absoluteUrl() });
      play("success");
    } catch {
      // A dismissed share sheet throws; that is not an error worth reporting.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copy()}
          iconLeft={
            copied ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            )
          }
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
        {canShare ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void share()}
            iconLeft={<Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
          >
            Share
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Reading link copied to the clipboard." : ""}
      </p>
      {manualUrl ? (
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            Copy this link by hand
          </span>
          <input
            readOnly
            value={manualUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="field w-full px-0 py-2 font-mono text-xs text-code"
          />
        </label>
      ) : null}
    </div>
  );
}

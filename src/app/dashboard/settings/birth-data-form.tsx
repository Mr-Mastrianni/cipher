"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  BirthVerification,
  type BirthMomentDraft,
  type VerifiedBirth,
} from "@/components/cipher/birth-verification";

export interface BirthFormDefaults {
  birthDate: string;
  birthTime: string;
  birthTimeZone: string;
  birthLatitude: string;
  birthLongitude: string;
  birthPlaceName: string;
}

/**
 * Birth-data editor for settings. The entered moment must pass the same
 * verification step as the public intake (time to the second, zone, offset,
 * daylight saving, explicit choice for a repeated hour) before it can be saved.
 */
export function BirthDataForm({
  defaults,
  save,
}: {
  defaults: BirthFormDefaults;
  save: (birth: VerifiedBirth) => Promise<void>;
}) {
  const [fields, setFields] = useState(defaults);
  const [draft, setDraft] = useState<BirthMomentDraft | null>(null);
  const [verified, setVerified] = useState<VerifiedBirth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof BirthFormDefaults) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields((current) => ({ ...current, [key]: event.target.value }));
    setDraft(null);
    setVerified(null);
  };

  function check() {
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fields.birthDate);
    const time = /^(\d{2}):(\d{2}):(\d{2})$/.exec(fields.birthTime);
    const latitude = Number.parseFloat(fields.birthLatitude);
    const longitude = Number.parseFloat(fields.birthLongitude);
    if (!date) return setError("Enter a valid birth date.");
    if (!time) return setError("Enter the birth time to the second (HH:MM:SS).");
    if (!fields.birthTimeZone.trim()) return setError("Enter the IANA time zone of the birthplace.");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return setError("Latitude and longitude must be numbers.");
    }
    setError(null);
    setDraft({
      year: Number(date[1]),
      month: Number(date[2]),
      day: Number(date[3]),
      hour: Number(time[1]),
      minute: Number(time[2]),
      second: Number(time[3]),
      timeZone: fields.birthTimeZone.trim(),
      latitude,
      longitude,
      placeName: fields.birthPlaceName.trim() || undefined,
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Birth date" required>
          <Input type="date" required value={fields.birthDate} onChange={set("birthDate")} />
        </Field>
        <Field label="Birth time, to the second" required description="Local clock time from the birth record.">
          <Input type="time" step={1} required value={fields.birthTime} onChange={set("birthTime")} />
        </Field>
      </div>
      <Field
        label="Timezone"
        required
        description="IANA name, e.g. Asia/Kolkata. The zone at the place of birth on that date."
      >
        <Input value={fields.birthTimeZone} onChange={set("birthTimeZone")} placeholder="Asia/Kolkata" autoComplete="off" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Latitude" required description="Decimal degrees, south negative.">
          <Input inputMode="decimal" value={fields.birthLatitude} onChange={set("birthLatitude")} placeholder="28.6139" />
        </Field>
        <Field label="Longitude" required description="Decimal degrees, west negative.">
          <Input inputMode="decimal" value={fields.birthLongitude} onChange={set("birthLongitude")} placeholder="77.2090" />
        </Field>
      </div>
      <Field label="Place name" description="Optional. Used for display only.">
        <Input value={fields.birthPlaceName} onChange={set("birthPlaceName")} maxLength={120} />
      </Field>

      {draft ? (
        <BirthVerification key={JSON.stringify(draft)} draft={draft} onChange={setVerified} />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {!draft ? (
          <Button type="button" variant="secondary" size="sm" onClick={check}>
            Verify the birth moment
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!verified}
            loading={pending}
            onClick={() => {
              if (!verified) return;
              startTransition(async () => {
                await save(verified);
              });
            }}
          >
            Save and re-cast the KP chart
          </Button>
        )}
      </div>
    </div>
  );
}

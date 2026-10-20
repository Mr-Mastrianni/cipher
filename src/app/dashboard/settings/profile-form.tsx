"use client";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export interface ProfileFormDefaults {
  displayName: string;
  pronouns: string;
  imageUrl: string;
}

/**
 * Profile editor for settings.
 *
 * A client component on purpose: `Field` injects the control's `id` and
 * `aria-describedby` by reading `children.props`, and a control element passed
 * across the server/client boundary arrives as a lazy reference with no `props`
 * — so a `Field` rendered from a Server Component throws during SSR. Keeping the
 * fields in a client component (as `BirthDataForm` already does) is the fix, and
 * the Server Action is passed in as a prop, so the form still works without
 * JavaScript and still never trusts a member id from the client.
 */
export function ProfileForm({
  defaults,
  save,
}: {
  defaults: ProfileFormDefaults;
  save: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={save} className="flex flex-col gap-5">
      <Field label="Display name" description="Shown on your posts and messages.">
        <Input
          name="displayName"
          defaultValue={defaults.displayName}
          maxLength={80}
          autoComplete="name"
        />
      </Field>
      <Field label="Pronouns" description="Optional. Shown beside your name if set.">
        <Input name="pronouns" defaultValue={defaults.pronouns} maxLength={40} />
      </Field>
      <Field
        label="Image URL"
        description="A square image works best. Leave blank to use your initials."
      >
        <Input
          name="imageUrl"
          defaultValue={defaults.imageUrl}
          inputMode="url"
          placeholder="https://…"
        />
      </Field>
      <div>
        <Button type="submit" variant="primary" size="sm">
          Save profile
        </Button>
      </div>
    </form>
  );
}

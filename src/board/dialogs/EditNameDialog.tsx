import { css } from "@csslit/core";
import { Show, createSignal } from "solid-js";

import { useName } from "#/name.tsx";
import { colors, fontSize, lineHeight, space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Dialog } from "#/ui/Dialog.tsx";
import { Field } from "#/ui/Field.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";

export function EditNameDialog(props: { onClose: () => void }) {
  const { name, save } = useName();
  const [storageError, setStorageError] = createSignal<string>();
  return (
    <Dialog title="Edit name" onClose={() => props.onClose()}>
      <p
        class={css`
          font-size: ${fontSize.caption}px;
          line-height: ${lineHeight.caption}px;

          color: ${colors.muted};
        `}
      >
        Your name identifies new actions. No account is required. Tabs share this name; use a
        private window for a separate identity.
      </p>
      <Show when={storageError()}>
        <Notice>{storageError()}</Notice>
      </Show>
      <form
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.md}px;
        `}
        onSubmit={(event) => {
          event.preventDefault();
          const field = new FormData(event.currentTarget).get("name");
          const value = typeof field === "string" ? field.trim() : "";
          if (!value || value.length > 32) {
            setStorageError("Use a name of 1–32 characters.");
            return;
          }
          try {
            save(value);
            props.onClose();
          } catch {
            setStorageError("Couldn't save your name. Check that cookies are allowed.");
          }
        }}
      >
        <Field label="Your name">
          <Input
            name="name"
            value={name()}
            maxlength={32}
            required
            autofocus
            autocomplete="nickname"
          />
        </Field>
        <div
          class={css`
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: ${space.sm}px;
          `}
        >
          <Button variant="primary" type="submit">
            <span>Save</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

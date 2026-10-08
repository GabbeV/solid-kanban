import { css } from "@csslit/core";
import { Show, createSignal } from "solid-js";
import { fontSize, lineHeight, colors, space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Dialog } from "#/ui/Dialog.tsx";
import { Field } from "#/ui/Field.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { useName } from "#/name.tsx";

export function EditNameDialog(props: { onClose: () => void }) {
  const { name, save } = useName();
  const [storageError, setStorageError] = createSignal<string>();
  const focusOnMount = (element: HTMLElement) => element.focus();
  return (
    <Dialog title="Edit name" onClose={() => props.onClose()}>
      <p
        class={css`
          font-size: ${fontSize.caption}px;
          line-height: ${lineHeight.caption}px;

          color: ${colors.muted};
        `}
      >
        Your name identifies new actions. No account is required. Tabs share
        this name; use a private window for a separate identity.
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
          const value = String(
            new FormData(event.currentTarget).get("name"),
          ).trim();
          if (!value || value.length > 32) {
            setStorageError("Use a name of 1–32 characters.");
            return;
          }
          try {
            save(value);
            props.onClose();
          } catch {
            setStorageError(
              "Couldn't save your name. Check that cookies are allowed.",
            );
          }
        }}
      >
        <Field label="Your name">
          <Input
            ref={(element) => focusOnMount(element)}
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

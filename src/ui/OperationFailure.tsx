import { Show } from "solid-js";
import { Button } from "#/ui/Button.tsx";
import { Notice } from "#/ui/Notice.tsx";

export function OperationFailure(props: { operation: string }) {
  const result = () =>
    undefined as { ok?: boolean; message?: string } | undefined;
  const pending = () => false;
  return (
    <Show when={result()?.ok === false && !pending()}>
      <Notice role="alert">
        {result()?.message ?? ""}
        <Button variant="text" type="button" onClick={() => {}}>
          <span>Retry</span>
        </Button>
      </Notice>
    </Show>
  );
}

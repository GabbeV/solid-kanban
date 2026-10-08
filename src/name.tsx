import type { ParentProps } from "solid-js";

import { getRequestEvent, parseCookieHeader, serializeCookie } from "@solidjs/web";
import { createContext, createSignal, useContext } from "solid-js";

const cookieName = "kanban-name";
const NameContext = createContext<{
  name: () => string;
  save: (value: string) => void;
}>();

export function NameProvider(props: ParentProps) {
  const cookies = parseCookieHeader(
    import.meta.env.SSR ? getRequestEvent()?.request.headers.get("cookie") : document.cookie,
  );
  const [name, setName] = createSignal(cookies[cookieName] || "You");
  const save = (value: string) => {
    const next = value.trim();
    if (!next || next.length > 32) throw new Error("Use a name of 1–32 characters.");
    document.cookie = serializeCookie(cookieName, next, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    if (parseCookieHeader(document.cookie)[cookieName] !== next)
      throw new Error("Couldn't save your name. Check that cookies are allowed.");
    setName(next);
  };
  return <NameContext value={{ name, save }}>{props.children}</NameContext>;
}

export function useName() {
  const value = useContext(NameContext);
  if (!value) throw new Error("NameProvider is missing");
  return value;
}

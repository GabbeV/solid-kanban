import type { Location, Navigator } from "@solidjs/router";

type DialogState = { dialogOpenedFromApp: true };

export const dialogState: DialogState = { dialogOpenedFromApp: true };

export function trimSlash(pathname: string) {
  return pathname.replace(/\/+$/, "");
}

export function openDialog(navigate: Navigator, location: Location, segment: string) {
  navigate(`${trimSlash(location.pathname)}/${segment}${location.search}${location.hash}`, {
    state: dialogState,
  });
}

export function closeDialog(
  navigate: Navigator,
  location: Location<DialogState>,
  fallbackPath?: string,
) {
  if (location.state?.dialogOpenedFromApp) {
    navigate(-1);
    return;
  }

  const currentPath = trimSlash(location.pathname);
  const pathname = fallbackPath ?? currentPath.slice(0, currentPath.lastIndexOf("/"));
  navigate(`${pathname || "/"}${location.search}${location.hash}`, {
    replace: true,
  });
}

import { isKnownRoute, isPrivateRoute } from "../../src/app/route-registry.js";

export function isKnownAppRoute(pathname) {
  return isKnownRoute(pathname);
}

export function isPrivateAppRoute(pathname) {
  return isPrivateRoute(pathname) || /^(\/login|\/join)(?:\/|$)/.test(pathname);
}

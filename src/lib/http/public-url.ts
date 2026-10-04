import type { NextRequest } from "next/server";

function isLocalHost(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function publicUrl(request: NextRequest, path: string): URL {
  const configured = process.env.APP_URL?.trim();

  if (
    configured &&
    /^https?:\/\//i.test(configured) &&
    !isLocalHost(configured)
  ) {
    return new URL(path, configured);
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  if (host) {
    const protocol =
      forwardedProto ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");

    return new URL(path, `${protocol}://${host}`);
  }

  return new URL(path, request.url);
}

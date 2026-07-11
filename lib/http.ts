import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export function correlationId(request: Request): string {
  const value = request.headers.get("x-request-id")?.trim();
  return value && /^[A-Za-z0-9._:-]{1,100}$/.test(value) ? value : randomUUID();
}

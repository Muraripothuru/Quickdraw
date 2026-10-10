import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = (await req.json()) as T;
    return body;
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return fail(error.message, error.status);
  console.error(error);
  return fail("Something went wrong. Please try again.", 500);
}

export function requireString(value: unknown, field: string, max = 400): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, `${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ApiError(400, `${field} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

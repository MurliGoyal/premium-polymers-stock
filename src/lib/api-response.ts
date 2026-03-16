import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorPayload;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function jsonSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function jsonError(error: ApiErrorPayload, init?: ResponseInit) {
  return NextResponse.json<ApiFailure>({ ok: false, error }, init);
}

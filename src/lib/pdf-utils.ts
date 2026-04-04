import type { ReactElement } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { APP_TIME_ZONE } from "@/lib/constants";

export function formatPdfDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: APP_TIME_ZONE,
    year: "numeric",
  }).format(date);
}

export function computeDurationLabel(fromDate: Date, toDate: Date) {
  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: APP_TIME_ZONE,
    year: "numeric",
  });

  return `${dateFormatter.format(fromDate)} - ${dateFormatter.format(toDate)}`;
}

export async function generateAndDownloadPdf(document: ReactElement<DocumentProps>, filename: string) {
  const blob = await pdf(document).toBlob();
  const objectUrl = URL.createObjectURL(blob);

  const anchor = window.document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  window.document.body.removeChild(anchor);

  URL.revokeObjectURL(objectUrl);
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProgressiveDiscoveryProgress } from "@/lib/discovery/progressive";

export function DiscoveryProgress({
  runId,
  initialStatus,
  initialProgress,
}: {
  runId: string;
  initialStatus: string;
  initialProgress: ProgressiveDiscoveryProgress | null;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current || initialStatus !== "RUNNING") return;
    started.current = true;
    let cancelled = false;

    async function run() {
      while (!cancelled) {
        try {
          const response = await fetch(
            `/api/discovery/runs/${encodeURIComponent(runId)}/advance`,
            {
              method: "POST",
              headers: { Accept: "application/json" },
              cache: "no-store",
            },
          );
          const payload = (await response.json()) as {
            status?: string;
            progress?: ProgressiveDiscoveryProgress;
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error || "Discovery step failed.");
          }

          if (payload.progress) setProgress(payload.progress);
          if (payload.status) setStatus(payload.status);
          router.refresh();

          if (payload.status === "COMPLETED") return;
          await new Promise((resolve) => setTimeout(resolve, 250));
        } catch (caught) {
          if (!cancelled) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Discovery could not continue.",
            );
          }
          return;
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [initialStatus, router, runId]);

  if (status === "COMPLETED") {
    return (
      <div className="discovery-source-note">
        <strong>Discovery complete.</strong>
        <p>{progress?.message ?? "All available validated matches are ready."}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-banner">
        Discovery paused: {error}. Refresh the page to retry the current step.
      </div>
    );
  }

  const percentage =
    progress?.stage === "VALIDATION" && progress.validationTotal > 0
      ? Math.round(
          (progress.validationCompleted / progress.validationTotal) * 100,
        )
      : progress?.semanticTotal
        ? Math.round(
            (progress.semanticCompleted / progress.semanticTotal) * 45,
          )
        : 0;

  return (
    <section className="discovery-source-note" aria-live="polite">
      <strong>Discovery is running in progressive mode.</strong>
      <p>
        {progress?.message ??
          "Starting multi-source market discovery. Results will appear as they are independently validated."}
      </p>
      <progress value={percentage} max={100} style={{ width: "100%" }} />
      <p>
        {progress
          ? `${progress.candidateCount} candidates found · ${progress.validatedCount} validated and visible`
          : "Preparing search…"}
      </p>
    </section>
  );
}

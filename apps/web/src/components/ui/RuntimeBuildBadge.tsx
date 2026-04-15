import { useEffect, useState } from 'react';

type ApiRuntimeInfo = {
  commit: string;
  builtAt: string | null;
  database: {
    currentName: string | null;
    expectedName: string | null;
    host: string | null;
  };
};

function shortSha(value: string | null | undefined): string {
  return value ? value.slice(0, 12) : 'unknown';
}

function formatStamp(value: string | null | undefined): string {
  return value ? value.replace('T', ' ').replace(/:\d{2}Z$/, 'Z') : 'unknown';
}

export function RuntimeBuildBadge() {
  const [apiInfo, setApiInfo] = useState<ApiRuntimeInfo | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/health/version', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as ApiRuntimeInfo;
      })
      .then((data) => {
        if (!cancelled) {
          setApiInfo(data);
          setApiError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : 'unavailable');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="pointer-events-none fixed bottom-3 right-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-xl border border-amateur-border bg-amateur-surface/95 px-3 py-2 text-[11px] leading-4 text-amateur-muted shadow-lg backdrop-blur">
      <p className="font-semibold text-amateur-ink">runtime</p>
      <p>
        web {shortSha(__FESA_WEB_BUILD__.commit)} · {formatStamp(__FESA_WEB_BUILD__.builtAt)}
      </p>
      {apiInfo ? (
        <p>
          api {shortSha(apiInfo.commit)} · db {apiInfo.database.currentName ?? 'unknown'}
        </p>
      ) : (
        <p>api {apiError ? `unavailable (${apiError})` : 'loading...'}</p>
      )}
    </aside>
  );
}

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, History } from "lucide-react";
import { useMexicoAuth } from "@/auth/AuthProvider";
import {
  monitorRequestState,
  requestMonitorResource,
  shouldRetryMonitorRequest,
} from "@/lib/monitorRequest.mjs";
import {
  monitorVideoHistoryRequest,
  validateMonitorVideoHistory,
  type MonitorVideoHistoryRange,
  type MonitorVideoHistoryResponse,
} from "@/lib/monitorVideoHistory.mjs";

type Props = {
  artistKey: string;
  videoId: string;
  title: string;
  accessSource: "internal" | "subscription";
};
const integer = new Intl.NumberFormat("es-MX");

function HistoryDetail({
  artistKey,
  videoId,
  accessSource,
  regionId,
}: Props & { regionId: string }) {
  const auth = useMexicoAuth();
  const [range, setRange] = useState<MonitorVideoHistoryRange>("30d");
  const expected = { artistKey, videoId, range, accessSource };
  const request = monitorVideoHistoryRequest({
    ...expected,
    userId: auth.userId,
  });
  const history = useQuery<MonitorVideoHistoryResponse>({
    queryKey: request.queryKey,
    enabled:
      auth.configured &&
      auth.isLoaded &&
      auth.isSignedIn &&
      Boolean(auth.userId),
    staleTime: 5 * 60 * 1000,
    networkMode: "always",
    retry: shouldRetryMonitorRequest,
    queryFn: ({ signal }) =>
      requestMonitorResource<MonitorVideoHistoryResponse>({
        getToken: auth.getToken,
        input: request.input,
        signal,
        readResponse: async (response) =>
          validateMonitorVideoHistory(await response.json(), expected),
      }),
  });
  const state = monitorRequestState({
    isFetching: history.isFetching,
    error: history.error,
    succeeded: history.isSuccess,
    observationCount: history.data?.points.length ?? 0,
    partial: history.data?.status === "partial",
  });
  const failed = [
    "authorization_failure",
    "backend_failure",
    "timeout",
  ].includes(state);
  // Cached points never survive an error, range change, or different viewer's query.
  const data =
    history.isSuccess && !history.error && !history.isFetching
      ? history.data
      : undefined;
  const status = {
    loading: "Cargando historial del video: consulta en curso.",
    loaded: "Lecturas cargadas para cada fecha del rango.",
    empty:
      "Consulta completada: no hay lecturas nativas para este video en el rango solicitado.",
    partial: "Historial parcial: hay fechas sin lectura en este rango.",
    authorization_failure: "La sesión no autoriza consultar este historial.",
    backend_failure:
      "No se pudo consultar el historial. El error no confirma ausencia de lecturas.",
    timeout: "La consulta agotó su tiempo de respuesta. Puedes reintentar.",
  }[state];
  return (
    <section
      id={regionId}
      aria-label="Historial de vistas acumuladas"
      className="min-w-0 border-t border-white/[.06] px-5 pb-5 pt-4"
    >
      <p className="text-xs font-black text-white/80">
        Vistas acumuladas · lecturas nativas
      </p>
      <p className="mt-1 text-[10px] leading-5 text-white/40">
        YouTube Data API · última observación por fecha de Nueva York. Son
        conteos acumulados, no vistas diarias.
      </p>
      <div
        className="my-3 flex flex-wrap gap-2"
        aria-label="Rango del historial del video"
      >
        {(["7d", "30d", "90d"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={range === option}
            onClick={() => setRange(option)}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${range === option ? "border-red-400/40 bg-red-500/10 text-red-200" : "border-white/10 text-white/45 hover:text-white"}`}
          >
            {option.slice(0, -1)} días
          </button>
        ))}
      </div>
      <div
        role={failed ? "alert" : "status"}
        data-video-history-state={state}
        className={`text-[11px] leading-5 ${failed || state === "partial" ? "text-amber-300" : "text-white/55"}`}
      >
        <p>{status}</p>
        {failed && accessSource === "internal" && (
          <p className="mt-1 break-all text-[10px]">
            {history.error?.message} · {artistKey} · {videoId}
          </p>
        )}
        {failed && (
          <button
            type="button"
            onClick={() => void history.refetch()}
            className="mt-2 rounded-full border border-white/15 px-3 py-2 text-[10px] font-black text-white"
          >
            Reintentar historial del video
          </button>
        )}
      </div>
      {data && (
        <>
          <p className="mt-3 text-[10px] leading-5 text-white/45">
            {data.startDate} — {data.endDate} · {data.coverage.observedDays}/
            {data.coverage.requestedDays} fechas con lectura ·{" "}
            {integer.format(data.coverage.rawObservationCount)} observaciones de
            origen.
          </p>
          <p className="text-[10px] leading-5 text-white/35">
            La cobertura cuenta fechas observadas; conserva huecos y no
            certifica el historial diario del catálogo.
          </p>
          {data.coverage.missingDates.length > 0 && (
            <details className="mt-2 text-[10px] text-white/45">
              <summary className="cursor-pointer">
                {data.coverage.missingDates.length} fechas sin lectura
              </summary>
              <p className="mt-1 break-words leading-5">
                {data.coverage.missingDates.join(" · ")}
              </p>
            </details>
          )}
          {data.points.length > 0 && (
            <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/[.07]">
              <table className="w-full text-left text-[10px]">
                <caption className="sr-only">
                  Lecturas acumuladas reales del video. Fecha de Nueva York y
                  hora original UTC.
                </caption>
                <thead className="sticky top-0 bg-[#101010] text-white/45">
                  <tr>
                    <th className="p-3 font-semibold">
                      Fecha ET · hora original UTC
                    </th>
                    <th className="p-3 text-right font-semibold">
                      Vistas acumuladas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.points.map((point) => (
                    <tr
                      key={point.observationId}
                      className="border-t border-white/[.05]"
                    >
                      <td className="p-3 text-white/60">
                        {point.date}
                        <time
                          dateTime={point.observedAt}
                          className="mt-1 block break-all text-[9px] text-white/35"
                        >
                          {point.observedAt}
                        </time>
                      </td>
                      <td className="p-3 text-right font-bold tabular-nums text-white/85">
                        {integer.format(point.viewCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {accessSource === "internal" && (
            <details className="mt-3 text-[10px] leading-5 text-white/40">
              <summary className="cursor-pointer">
                {data.relationship.hasApprovedLink
                  ? "Fuente y relación · diagnóstico interno"
                  : "Relación candidata · inspección interna"}
              </summary>
              <p className="mt-2 break-all">
                {data.sourceTable} · {data.sourceType} · {data.selection}
              </p>
              <p className="break-all">
                Consulta: {data.asOf}. Primera lectura de origen:{" "}
                {data.coverage.firstObservedAt ?? "sin lecturas"}. Última:{" "}
                {data.coverage.lastObservedAt ?? "sin lecturas"}.
              </p>
              {!data.relationship.hasApprovedLink && (
                <p className="mt-1 text-amber-300">
                  Relación candidata sin vínculo aprobado. Esta inspección no
                  habilita acceso de suscripción ni acredita cobertura del
                  catálogo.
                </p>
              )}
              <ul className="mt-2 space-y-1">
                {data.relationship.relationshipSources.map((source, index) => (
                  <li key={index} className="break-all">
                    {source.source_table} · {source.artist_key} ·{" "}
                    {source.status ?? "sin estado"}
                    {source.sampling_status
                      ? ` · ${source.sampling_status}`
                      : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function Disclosure(props: Props) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        aria-label={`Historial de ${props.title}`}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-t border-white/[.06] px-5 py-3 text-[11px] font-bold text-white/60 hover:bg-white/[.035] hover:text-white"
      >
        <span className="flex items-center gap-2">
          <History className="h-3.5 w-3.5" />
          Historial
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <HistoryDetail {...props} regionId={regionId} />}
    </>
  );
}

export default function MonitorVideoHistory(props: Props) {
  const auth = useMexicoAuth();
  if (!auth.configured || !auth.isLoaded || !auth.isSignedIn || !auth.userId)
    return null;
  return (
    <Disclosure
      key={JSON.stringify([
        auth.userId,
        props.artistKey,
        props.videoId,
        props.accessSource,
      ])}
      {...props}
    />
  );
}

// Query success describes exposed data, not coverage of every upstream source.
export function searchAvailability(enabled, resultCount, queries) {
  if (!enabled) return { instruction: true, showEmpty: false, warning: false, activity: null };
  const fetching = queries.filter(query => query.isFetching);
  const activity = fetching.some(query => query.isPending) ? "loading"
    : fetching.length ? "updating"
    : queries.some(query => query.fetchStatus === "paused") ? "paused"
    : queries.some(query => query.isPending) ? "unavailable"
    : null;
  return {
    instruction: false,
    showEmpty: resultCount === 0,
    warning: queries.some(query => query.isError),
    activity,
  };
}

const COPY = {
  es: {
    instruction: "Escribe al menos 2 caracteres para ampliar la búsqueda",
    results: "Resultados disponibles",
    empty: "No hay coincidencias en los datos disponibles",
    warning: "No se pudieron cargar algunos datos",
    loading: "Cargando más datos…",
    updating: "Actualizando datos…",
    paused: "La carga de algunos datos está en pausa",
    unavailable: "Algunos datos aún no están disponibles",
  },
  en: {
    instruction: "Enter at least 2 characters to search more sources",
    results: "Available results",
    empty: "No matches in the available data",
    warning: "Some data could not be loaded",
    loading: "Loading more data…",
    updating: "Updating data…",
    paused: "Loading is paused for some data",
    unavailable: "Some data is not available yet",
  },
};

export function searchAvailabilityCopy(language) {
  return COPY[language === "en" ? "en" : "es"];
}

import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";

const NotFound = lazy(() => import("@/pages/not-found"));
const HomeV6 = lazy(() => import("@/pages/HomeV6"));
const ArtistDetail = lazy(() => import("@/pages/ArtistDetail"));
const ArtistRoster = lazy(() => import("@/pages/ArtistRoster"));
const ArtistCompare = lazy(() => import("@/pages/ArtistCompare"));
const Mx100 = lazy(() => import("@/pages/Mx100"));
const RadarNuevos = lazy(() => import("@/pages/RadarNuevos"));
const LegacyActs = lazy(() => import("@/pages/LegacyActs"));
const InsightIFPI2026 = lazy(() => import("@/pages/InsightIFPI2026"));
const IndustryLanding = lazy(() => import("@/pages/IndustryLanding"));
const Certifications = lazy(() => import("@/pages/Certifications"));
const ChartsHub = lazy(() => import("@/pages/ChartsHub"));
const GeneroHub = lazy(() => import("@/pages/GeneroHub"));
const TouringHub = lazy(() => import("@/pages/TouringHub"));
const SocialTemplates = lazy(() => import("@/pages/SocialTemplates"));
const AcercaDe = lazy(() => import("@/pages/AcercaDe"));
const Contacto = lazy(() => import("@/pages/Contacto"));
const Metodologia = lazy(() => import("@/pages/Metodologia"));
const FuentesDatos = lazy(() => import("@/pages/FuentesDatos"));
const Privacidad = lazy(() => import("@/pages/Privacidad"));
const Terminos = lazy(() => import("@/pages/Terminos"));
// Vite serves these source modules directly in development. The ignored
// imports prevent the private preview code from being emitted in production.
const monitoringPreviewPage = "./pages/Monitoreo.tsx";
const monitoringSuccessPage = "./pages/MonitoringSuccess.tsx";
const monitoringDashboardPage = "./pages/MonitoringDashboard.tsx";
const Monitoreo = lazy(() => import(/* @vite-ignore */ monitoringPreviewPage));
const MonitoringSuccess = lazy(() => import(/* @vite-ignore */ monitoringSuccessPage));
const MonitoringDashboard = lazy(() => import(/* @vite-ignore */ monitoringDashboardPage));
const EnrichmentReview = lazy(() => import("@/pages/EnrichmentReview"));
const ApiCoverage = lazy(() => import("@/pages/ApiCoverage"));
const AdminHub = lazy(() => import("@/pages/AdminHub"));
const DiscoveryReview = lazy(() => import("@/pages/DiscoveryReview"));
const Cuenta = lazy(() => import("@/pages/Cuenta"));

// Fail closed: monitoring previews can only be enabled in a development build.
// They are intentionally absent from production routing, navigation, sitemaps,
// and prerendering until the product is explicitly approved for launch.
const MONITORING_PREVIEW_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_MONITORING_PREVIEW === "true";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error("[Mexico Charts data error]", { queryKey: query.queryKey, error });
    },
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AppLoadingState() {
  const { pick } = useLanguage();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-white" role="status" aria-live="polite" aria-busy="true">
      <div className="text-center">
        <img src={`${import.meta.env.BASE_URL}mexico-charts-logo.png`} alt="Mexico Charts" className="mx-auto h-10 object-contain opacity-85" />
        <div className="mx-auto mt-6 h-1 w-28 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#39FF14]" />
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">{pick("Cargando Mexico Charts…", "Loading Mexico Charts…")}</p>
      </div>
    </main>
  );
}

const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  "/about": "/acerca-de",
  "/contact": "/contacto",
  "/privacy": "/privacidad",
};

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function GoogleAnalyticsPageView() {
  const [location] = useLocation();

  useEffect(() => {
    const analyticsWindow = window as typeof window & {
      gtag?: (command: "event", eventName: string, params: Record<string, string>) => void;
    };
    analyticsWindow.gtag?.("event", "page_view", {
      page_path: location,
      page_location: window.location.href,
    });
  }, [location]);

  return null;
}

function LegacyRouteRedirects() {
  const [location] = useLocation();

  useEffect(() => {
    const target = LEGACY_ROUTE_REDIRECTS[location];
    if (target) window.location.replace(target);
  }, [location]);

  return null;
}

function Router() {
  return (
    <>
      <LegacyRouteRedirects />
      <ScrollToTop />
      <GoogleAnalyticsPageView />
      <Suspense fallback={<AppLoadingState />}>
        <Switch>
          <Route path="/" component={HomeV6} />
          <Route path="/artists" component={ArtistRoster} />
          <Route path="/compare" component={ArtistCompare} />
          <Route path="/mx100" component={Mx100} />
          <Route path="/radar-nuevos" component={RadarNuevos} />
          <Route path="/legacy-acts" component={LegacyActs} />
          <Route path="/charts" component={ChartsHub} />
          <Route path="/generos" component={GeneroHub} />
          <Route path="/industria" component={IndustryLanding} />
          <Route path="/industry/certifications" component={Certifications} />
          <Route path="/insights/mexico-top-10-ifpi-2026" component={InsightIFPI2026} />
          <Route path="/touring" component={TouringHub} />
          <Route path="/artist/:slug" component={ArtistDetail} />
          <Route path="/social-templates" component={SocialTemplates} />
          <Route path="/acerca-de" component={AcercaDe} />
          <Route path="/contacto" component={Contacto} />
          <Route path="/metodologia" component={Metodologia} />
          <Route path="/fuentes-de-datos" component={FuentesDatos} />
          <Route path="/privacidad" component={Privacidad} />
          <Route path="/terminos" component={Terminos} />
          <Route path="/cuenta" component={Cuenta} />
          <Route path="/admin/social-templates" component={SocialTemplates} />
          <Route path="/admin/api-coverage" component={ApiCoverage} />
          <Route path="/admin/enrichment-review" component={EnrichmentReview} />
          <Route path="/admin/discovery-review" component={DiscoveryReview} />
          {MONITORING_PREVIEW_ENABLED && (
            <Route path="/internal/monitoring" component={Monitoreo} />
          )}
          {MONITORING_PREVIEW_ENABLED && (
            <Route path="/internal/monitoring/dashboard" component={MonitoringDashboard} />
          )}
          {MONITORING_PREVIEW_ENABLED && (
            <Route path="/internal/monitoring/success" component={MonitoringSuccess} />
          )}
          <Route path="/admin" component={AdminHub} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

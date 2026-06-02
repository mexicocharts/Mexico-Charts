import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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
const TouringProfile = lazy(() => import("@/pages/TouringProfile"));
const LuisMiguelProfile = lazy(() => import("@/pages/LuisMiguelProfile"));
const PesoPlumaProfile = lazy(() => import("@/pages/PesoPlumaProfile"));
const TavusPreview = lazy(() => import("@/pages/TavusPreview"));
const SocialTemplates = lazy(() => import("@/pages/SocialTemplates"));
const AcercaDe = lazy(() => import("@/pages/AcercaDe"));
const Contacto = lazy(() => import("@/pages/Contacto"));
const Metodologia = lazy(() => import("@/pages/Metodologia"));
const Privacidad = lazy(() => import("@/pages/Privacidad"));
const EnrichmentReview = lazy(() => import("@/pages/EnrichmentReview"));
const ApiCoverage = lazy(() => import("@/pages/ApiCoverage"));
const AdminHub = lazy(() => import("@/pages/AdminHub"));
const DiscoveryReview = lazy(() => import("@/pages/DiscoveryReview"));

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
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
          <Route path="/touring/luis-miguel" component={LuisMiguelProfile} />
          <Route path="/touring/peso-pluma" component={PesoPlumaProfile} />
          <Route path="/touring/:slug" component={TouringProfile} />
          <Route path="/touring" component={TouringHub} />
          <Route path="/tavus-preview" component={TavusPreview} />
          <Route path="/artist/:slug" component={ArtistDetail} />
          <Route path="/social-templates" component={SocialTemplates} />
          <Route path="/acerca-de" component={AcercaDe} />
          <Route path="/contacto" component={Contacto} />
          <Route path="/metodologia" component={Metodologia} />
          <Route path="/privacidad" component={Privacidad} />
          <Route path="/admin/social-templates" component={SocialTemplates} />
          <Route path="/admin/api-coverage" component={ApiCoverage} />
          <Route path="/admin/enrichment-review" component={EnrichmentReview} />
          <Route path="/admin/discovery-review" component={DiscoveryReview} />
          <Route path="/admin" component={AdminHub} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;

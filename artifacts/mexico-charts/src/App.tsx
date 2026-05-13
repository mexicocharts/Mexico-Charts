import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import HomeV1 from "@/pages/HomeV1";
import HomeV3 from "@/pages/HomeV3";
import HomeV4 from "@/pages/HomeV4";
import HomeV5 from "@/pages/HomeV5";
import HomeV6 from "@/pages/HomeV6";
import ArtistDetail from "@/pages/ArtistDetail";
import ArtistRoster from "@/pages/ArtistRoster";
import InsightIFPI2026 from "@/pages/InsightIFPI2026";
import IndustryLanding from "@/pages/IndustryLanding";
import Certifications from "@/pages/Certifications";
import ChartsHub from "@/pages/ChartsHub";
import GeneroHub from "@/pages/GeneroHub";
import TouringHub from "@/pages/TouringHub";
import TouringProfile from "@/pages/TouringProfile";
import LuisMiguelProfile from "@/pages/LuisMiguelProfile";

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
      <Switch>
      <Route path="/" component={HomeV6} />
      <Route path="/artists" component={ArtistRoster} />
      <Route path="/charts" component={ChartsHub} />
      <Route path="/generos" component={GeneroHub} />
      <Route path="/industria" component={IndustryLanding} />
      <Route path="/industry/certifications" component={Certifications} />
      <Route path="/insights/mexico-top-10-ifpi-2026" component={InsightIFPI2026} />
      <Route path="/touring/luis-miguel" component={LuisMiguelProfile} />
      <Route path="/touring/:slug" component={TouringProfile} />
      <Route path="/touring" component={TouringHub} />
      <Route path="/artist/:slug" component={ArtistDetail} />
      <Route path="/v1" component={HomeV1} />
      <Route path="/v3" component={HomeV3} />
      <Route path="/v4" component={HomeV4} />
      <Route path="/v5" component={HomeV5} />
      <Route path="/v6" component={HomeV6} />
      <Route component={NotFound} />
    </Switch>
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

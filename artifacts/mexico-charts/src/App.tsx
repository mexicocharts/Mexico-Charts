import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeV6} />
      <Route path="/artists" component={ArtistRoster} />
      <Route path="/insights/mexico-top-10-ifpi-2026" component={InsightIFPI2026} />
      <Route path="/artist/:slug" component={ArtistDetail} />
      <Route path="/v1" component={HomeV1} />
      <Route path="/v3" component={HomeV3} />
      <Route path="/v4" component={HomeV4} />
      <Route path="/v5" component={HomeV5} />
      <Route path="/v6" component={HomeV6} />
      <Route component={NotFound} />
    </Switch>
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

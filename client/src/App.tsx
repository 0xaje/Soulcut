import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import CreativeDNA from "@/pages/CreativeDNA";
import CreativeEvolution from "@/pages/CreativeEvolution";
import LiveWalkthrough from "@/pages/LiveWalkthrough";
import Home from "@/pages/Home";
import Workspace from "@/pages/Workspace";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/app" component={Workspace} />
      <Route path="/dna" component={CreativeDNA} />
      <Route path="/evolution" component={CreativeEvolution} />
      <Route path="/walkthrough" component={LiveWalkthrough} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <TooltipProvider>
          <Toaster theme="dark" position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { LanguageProvider } from '@/lib/contexts/LanguageContext';
import { AccessibilityProvider } from '@/lib/contexts/AccessibilityContext';
import { Layout } from '@/components/layout/Layout';

import Dashboard from '@/pages/dashboard/Dashboard';
import PlantList from '@/pages/plants/PlantList';
import PlantNew from '@/pages/plants/PlantNew';
import PlantDetail from '@/pages/plants/PlantDetail';
import PlantIdentifier from '@/pages/ai/PlantIdentifier';
import DiseaseDetector from '@/pages/ai/DiseaseDetector';
import Weather from '@/pages/weather/Weather';
import Reminders from '@/pages/reminders/Reminders';
import Settings from '@/pages/settings/Settings';
import Help from '@/pages/help/Help';
import About from '@/pages/about/About';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/plants" component={PlantList} />
        <Route path="/plants/new" component={PlantNew} />
        <Route path="/plants/:id" component={PlantDetail} />
        <Route path="/ai/identify" component={PlantIdentifier} />
        <Route path="/ai/disease" component={DiseaseDetector} />
        <Route path="/weather" component={Weather} />
        <Route path="/reminders" component={Reminders} />
        <Route path="/settings" component={Settings} />
        <Route path="/help" component={Help} />
        <Route path="/about" component={About} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AccessibilityProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AccessibilityProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;

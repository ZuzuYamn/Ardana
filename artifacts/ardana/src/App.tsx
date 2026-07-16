import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

import { LanguageProvider, useLanguage } from '@/lib/contexts/LanguageContext';
import { AccessibilityProvider } from '@/lib/contexts/AccessibilityContext';
import { AuthProvider, useAuth } from '@/lib/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';

import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import Dashboard from '@/pages/dashboard/Dashboard';
import PlantList from '@/pages/plants/PlantList';
import PlantNew from '@/pages/plants/PlantNew';
import PlantDetail from '@/pages/plants/PlantDetail';
import PlantIdentifier from '@/pages/ai/PlantIdentifier';
import DiseaseDetector from '@/pages/ai/DiseaseDetector';
import AiChat from '@/pages/ai/AiChat';
import Weather from '@/pages/weather/Weather';
import Reminders from '@/pages/reminders/Reminders';
import Settings from '@/pages/settings/Settings';
import Help from '@/pages/help/Help';
import About from '@/pages/about/About';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.response?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{t('app.loading')}</p>
      </div>
    </div>
  );
}

// Redirect component — must be a proper component so hooks work correctly
function RedirectToLogin() {
  const [, navigate] = useLocation();
  React.useEffect(() => { navigate('/auth/login'); }, [navigate]);
  return <LoadingScreen />;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/auth/login" component={Login} />
        <Route path="/auth/register" component={Register} />
        <Route component={RedirectToLogin} />
      </Switch>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/plants" component={PlantList} />
        <Route path="/plants/new" component={PlantNew} />
        <Route path="/plants/:id" component={PlantDetail} />
        <Route path="/ai/chat" component={AiChat} />
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
          <AuthProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <AppRoutes />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </AccessibilityProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
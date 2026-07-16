import React from 'react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { 
  LayoutDashboard, 
  Leaf, 
  Bell, 
  CloudSun, 
  ScanSearch, 
  Stethoscope, 
  Settings, 
  HelpCircle, 
  Info 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const [location] = useLocation();
  const { t, isRTL } = useLanguage();

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { href: '/plants', icon: Leaf, label: t('nav.my_farm') },
    { href: '/reminders', icon: Bell, label: t('nav.reminders') },
    { href: '/weather', icon: CloudSun, label: t('nav.weather') },
  ];

  const aiItems = [
    { href: '/ai/identify', icon: ScanSearch, label: t('nav.ai_identify') },
    { href: '/ai/disease', icon: Stethoscope, label: t('nav.ai_disease') },
  ];

  const bottomItems = [
    { href: '/settings', icon: Settings, label: t('nav.settings') },
    { href: '/help', icon: HelpCircle, label: t('nav.help') },
    { href: '/about', icon: Info, label: t('nav.about') },
  ];

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = location === href || (href !== '/' && location.startsWith(href));
    return (
      <Link 
        href={href} 
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
          isActive 
            ? "bg-primary text-primary-foreground shadow-sm" 
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className={cn(
      "fixed inset-y-0 z-40 hidden w-64 bg-sidebar border-sidebar-border overflow-y-auto md:flex flex-col",
      isRTL ? "right-0 border-l" : "left-0 border-r"
    )}>
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Leaf className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-sidebar-foreground tracking-tight">Ardana</h1>
            <p className="text-xs text-sidebar-foreground/60 font-medium">Our Land. Our Life.</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-8 mt-4">
        <div>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <NavLink {...item} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Ardana AI
          </h3>
          <ul className="space-y-1">
            {aiItems.map((item) => (
              <li key={item.href}>
                <NavLink {...item} />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="p-4 mt-auto">
        <ul className="space-y-1">
          {bottomItems.map((item) => (
            <li key={item.href}>
              <NavLink {...item} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

import React from 'react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  LayoutDashboard, Bell, CloudSun, ScanSearch, Stethoscope,
  Settings, HelpCircle, Info, Leaf, LogOut, User, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArdanaLogo } from '@/components/ui/ArdanaLogo';
import { Button } from '@/components/ui/button';

export function Sidebar() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { href: '/plants', icon: Leaf, label: t('nav.my_farm') },
    { href: '/reminders', icon: Bell, label: t('nav.reminders') },
    { href: '/weather', icon: CloudSun, label: t('nav.weather') },
  ];

  const aiItems = [
    { href: '/ai/chat', icon: MessageSquare, label: t('nav.ai_chat') },
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
      "fixed inset-y-0 left-0 z-40 hidden w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto md:flex flex-col"
    )}>
      {/* Logo */}
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3">
          <ArdanaLogo size={42} variant="dark" />
          <div>
            <h1 className="font-serif text-2xl font-bold text-sidebar-foreground tracking-tight">{t('brand.name')}</h1>
            <p className="text-xs text-sidebar-foreground/60 font-medium">{t('sidebar.tagline')}</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-6 mt-2">
        <div>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}><NavLink {...item} /></li>
            ))}
          </ul>
        </div>

        <div>
          <p className="px-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            {t('sidebar.ai_tools_label')}
          </p>
          <ul className="space-y-1">
            {aiItems.map((item) => (
              <li key={item.href}><NavLink {...item} /></li>
            ))}
          </ul>
        </div>

        <div>
          <ul className="space-y-1">
            {bottomItems.map((item) => (
              <li key={item.href}><NavLink {...item} /></li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="w-4 h-4" />
                {t('sidebar.sign_out')}
        </Button>
      </div>
    </aside>
  );
}

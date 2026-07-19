import React from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Leaf, Bell, ScanSearch, Menu, LogOut, User, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArdanaLogo } from '@/components/ui/ArdanaLogo';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { CloudSun, Stethoscope, Settings, HelpCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MobileNav() {
  const [location] = useLocation();
  const { t, isRTL } = useLanguage();
  const { user, logout } = useAuth();

  const mainNav = [
    { href: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { href: '/plants', icon: Leaf, label: t('nav.my_farm') },
    { href: '/ai/chat', icon: MessageSquare, label: t('nav.ai_chat') },
    { href: '/reminders', icon: Bell, label: t('nav.reminders') },
  ];

  const allItems = [
    { href: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { href: '/plants', icon: Leaf, label: t('nav.my_farm') },
    { href: '/reminders', icon: Bell, label: t('nav.reminders') },
    { href: '/weather', icon: CloudSun, label: t('nav.weather') },
    { href: '/ai/chat', icon: MessageSquare, label: t('nav.ai_chat') },
    { href: '/ai/identify', icon: ScanSearch, label: t('nav.ai_identify') },
    { href: '/ai/disease', icon: Stethoscope, label: t('nav.ai_disease') },
    { href: '/settings', icon: Settings, label: t('nav.settings') },
    { href: '/help', icon: HelpCircle, label: t('nav.help') },
    { href: '/about', icon: Info, label: t('nav.about') },
  ];

  return (
    <>
      {/* Top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b z-40 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <ArdanaLogo size={34} variant="dark" />
          <h1 className="font-serif text-xl font-bold tracking-tight">{t('brand.name')}</h1>
        </Link>

        <Sheet>
          <SheetTrigger asChild>
            <button className="p-2 -mr-2 text-foreground/70 hover:text-foreground">
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side={isRTL ? 'left' : 'right'} className="w-[80vw] sm:w-[350px] p-0 flex flex-col">
            {/* User header */}
            <div className="p-6 bg-sidebar text-sidebar-foreground">
              <SheetHeader>
                <SheetTitle className="text-left text-sidebar-foreground flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-serif text-2xl">{t('brand.name')}</span>
                </SheetTitle>
              </SheetHeader>
              {user && (
                <div className="flex items-center gap-2.5 mt-4 px-1">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</p>
                    <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Nav items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {allItems.map((item) => {
                const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/70 hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Logout */}
            <div className="p-4 border-t">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                onClick={logout}
              >
                <LogOut className="w-4 h-4" />
                {t('sidebar.sign_out')}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t z-40 px-6">
        <div className="h-full flex items-center justify-between">
          {mainNav.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-6 h-6", isActive && "fill-primary/20")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

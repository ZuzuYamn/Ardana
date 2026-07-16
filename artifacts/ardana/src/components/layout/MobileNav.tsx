import React from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Leaf, Bell, ScanSearch, Menu } from 'lucide-react';
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
import { CloudSun, Stethoscope, Settings, HelpCircle, Info } from 'lucide-react';

export function MobileNav() {
  const [location] = useLocation();
  const { t, isRTL } = useLanguage();

  const mainNav = [
    { href: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { href: '/plants', icon: Leaf, label: t('nav.my_farm') },
    { href: '/ai/identify', icon: ScanSearch, label: t('nav.ai_identify') },
    { href: '/reminders', icon: Bell, label: t('nav.reminders') },
  ];

  const allItems = [
    { href: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { href: '/plants', icon: Leaf, label: t('nav.my_farm') },
    { href: '/reminders', icon: Bell, label: t('nav.reminders') },
    { href: '/weather', icon: CloudSun, label: t('nav.weather') },
    { href: '/ai/identify', icon: ScanSearch, label: t('nav.ai_identify') },
    { href: '/ai/disease', icon: Stethoscope, label: t('nav.ai_disease') },
    { href: '/settings', icon: Settings, label: t('nav.settings') },
    { href: '/help', icon: HelpCircle, label: t('nav.help') },
    { href: '/about', icon: Info, label: t('nav.about') },
  ];

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b z-40 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <ArdanaLogo size={34} variant="dark" />
          <h1 className="font-serif text-xl font-bold tracking-tight">Ardana</h1>
        </Link>

        <Sheet>
          <SheetTrigger asChild>
            <button className="p-2 -mr-2 text-foreground/70 hover:text-foreground">
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side={isRTL ? "left" : "right"} className="w-[80vw] sm:w-[350px] p-0 flex flex-col">
            <div className="p-6 bg-sidebar text-sidebar-foreground">
              <SheetHeader>
                <SheetTitle className="text-left text-sidebar-foreground flex items-center gap-2">
                   <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-serif text-2xl">Ardana</span>
                </SheetTitle>
              </SheetHeader>
            </div>
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
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>

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
            )
          })}
        </div>
      </div>
    </>
  );
}

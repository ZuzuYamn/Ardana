import React from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  // Language only affects nav labels — layout stays LTR

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      <Sidebar />
      <MobileNav />
      <main className={cn(
        "flex flex-col min-h-[100dvh] pb-16 md:pb-0 pt-16 md:pt-0 transition-all duration-300",
        "md:pl-64"
      )}>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 lg:p-10"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

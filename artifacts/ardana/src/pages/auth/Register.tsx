import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { ArdanaLogo } from '@/components/ui/ArdanaLogo';
import { motion } from 'framer-motion';
import { AuthLayout } from '@/components/layout/AuthLayout';

export default function Register() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const schema = z.object({
    name: z.string().min(1, t('auth.name_required')).max(100),
    email: z.string().email(t('auth.email_invalid')),
    password: z.string().min(8, t('auth.password_required')),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      await register(data.name, data.email, data.password);
      navigate('/');
    } catch (err) {
      toast({
        title: t('auth.register_failed'),
        description: err instanceof Error ? err.message : t('auth.register_failed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full"
      >
        {/* Card — frosted glass */}
        <div
          className="rounded-3xl shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.6)',
          }}
        >
          {/* Brand header strip */}
          <div className="px-8 pt-8 pb-6 border-b border-black/5">
            <div className="flex items-center gap-3">
              <ArdanaLogo size={42} variant="dark" />
              <div>
                <p className="font-serif text-2xl font-bold tracking-tight leading-none text-foreground">
                  {t("sidebar.brand")}
                </p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  {t('sidebar.tagline')}
                </p>
              </div>
            </div>
            <div className="mt-5">
              <h2 className="font-serif text-2xl font-bold text-foreground tracking-tight">
                {t('auth.create_account')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('auth.register_subtitle')}
              </p>
            </div>
          </div>

          {/* Form body */}
          <div className="px-8 py-7">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.full_name')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder={t('auth.name_placeholder')}
                            className="pl-9 h-11 bg-white/70"
                            autoComplete="name"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.email')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder={t('auth.email_placeholder')}
                            className="pl-9 h-11 bg-white/70"
                            autoComplete="email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.password')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t('auth.password_placeholder')}
                            className="pl-9 pr-10 h-11 bg-white/70"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold mt-1"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('auth.creating')}</>
                  ) : (
                    t('auth.create_account')
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t('auth.have_account')}{' '}
              <Link href="/auth/login" className="text-primary font-semibold hover:underline">
                {t('auth.sign_in_link')}
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </AuthLayout>
  );
}

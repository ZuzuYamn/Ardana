import React, { useState } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { 
  useGetPlant, 
  useUpdatePlant, 
  useDeletePlant, 
  useListPlantReminders,
  useCreateReminder,
  useUpdateReminder,
  getGetPlantQueryKey,
  getListPlantRemindersQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft, Leaf, Droplets, Sprout, Calendar, MapPin, 
  Trash2, Edit, Check, AlertCircle, Droplet, Clock, Plus, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export default function PlantDetail() {
  const [, params] = useRoute('/plants/:id');
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: plant, isLoading, error } = useGetPlant(id, { query: { enabled: id > 0, queryKey: getGetPlantQueryKey(id) } });
  const { data: reminders, isLoading: remindersLoading } = useListPlantReminders(id, { query: { enabled: id > 0, queryKey: getListPlantRemindersQueryKey(id) } });

  const updatePlant = useUpdatePlant();
  const deletePlant = useDeletePlant();
  const updateReminder = useUpdateReminder();

  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-serif font-bold text-foreground">{t('plant.not_found')}</h2>
        <p className="text-muted-foreground mt-2 mb-6">{t('plant.not_found_desc')}</p>
        <Button onClick={() => setLocation('/plants')}>{t('plant.return')}</Button>
      </div>
    );
  }

  const handleQuickLog = (action: 'water' | 'fertilize' | 'prune') => {
    const now = new Date().toISOString();
    const updates: any = {};

    if (action === 'water') updates.lastWateredDate = now;
    if (action === 'fertilize') updates.lastFertilizedDate = now;
    if (action === 'prune') updates.lastPrunedDate = now;

    updatePlant.mutate({ id, data: updates }, {
      onSuccess: (updatedData) => {
        // Optimistic cache update
        queryClient.setQueryData(getGetPlantQueryKey(id), (old: any) => 
          old ? { ...old, ...updates } : old
        );
        const actionLabel = action === 'water' ? t('plant.log_water') : action === 'fertilize' ? t('plant.log_fertilize') : t('plant.log_prune');
        toast({ title: t('plant.logged', { action: actionLabel }), description: t('plant.logged_desc') });
      }
    });
  };

  const handleDelete = () => {
    deletePlant.mutate({ id }, {
      onSuccess: () => {
        toast({ title: t('plant.deleted'), description: t('plant.deleted_desc') });
        setLocation('/plants');
      }
    });
  };

  const handleCompleteReminder = (reminderId: number) => {
    updateReminder.mutate({ id: reminderId, data: { completed: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlantRemindersQueryKey(id) });
        toast({ title: t('plant.task_completed'), description: t('plant.task_completed_desc') });
      }
    });
  };

  if (isLoading || !plant) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-48 h-8" />
        </div>
        <Skeleton className="w-full h-[300px] rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="w-full h-[200px] rounded-2xl col-span-2" />
          <Skeleton className="w-full h-[200px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/plants" className="w-10 h-10 rounded-full border bg-card flex items-center justify-center hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground leading-tight">{plant.name}</h1>
            <p className="text-muted-foreground italic flex items-center gap-2">
              {plant.species || t('plants.unknown_species')} • <span className="capitalize">{plant.type}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground">{t('plant.quick_log')}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">{t('plant.log_activity')}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                <Button 
                  variant="outline" 
                  className="h-14 justify-start gap-4 text-left font-medium" 
                  onClick={() => { handleQuickLog('water'); setIsLogDialogOpen(false); }}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-blue-600" />
                  </div>
                  {t('plant.mark_watered_now')}
                </Button>
                <Button 
                  variant="outline" 
                  className="h-14 justify-start gap-4 text-left font-medium"
                  onClick={() => { handleQuickLog('fertilize'); setIsLogDialogOpen(false); }}
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Sprout className="w-4 h-4 text-amber-600" />
                  </div>
                  {t('plant.mark_fertilized_now')}
                </Button>
                <Button 
                  variant="outline" 
                  className="h-14 justify-start gap-4 text-left font-medium"
                  onClick={() => { handleQuickLog('prune'); setIsLogDialogOpen(false); }}
                >
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Leaf className="w-4 h-4 text-green-600" />
                  </div>
                  {t('plant.mark_pruned_now')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('plant.delete_confirm_title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('plant.delete_confirm_desc', { name: plant.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('plant.delete_cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t('plant.delete_confirm_btn')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Hero Image */}
      <div className="w-full h-[300px] md:h-[400px] rounded-3xl overflow-hidden relative shadow-sm group">
        {plant.photoUrl ? (
          <img src={plant.photoUrl} alt={plant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-secondary/10 flex items-center justify-center">
            <Sprout className="w-24 h-24 text-secondary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
          <div className="flex gap-2">
            <span className={cn(
              "px-3 py-1.5 rounded-full text-sm font-bold shadow-sm backdrop-blur-md",
              plant.healthStatus === 'healthy' ? "bg-green-500/90 text-white" :
              plant.healthStatus === 'poor' ? "bg-red-500/90 text-white" :
              "bg-amber-500/90 text-white"
            )}>
              {t(`plants.health_${plant.healthStatus}`)}
            </span>
          </div>
          <div className="flex gap-2 text-white/90">
            {plant.location && (
              <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md text-sm font-medium">
                <MapPin className="w-4 h-4" /> {plant.location}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-serif font-bold text-foreground mb-4">{t('plant.care_history')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <Droplet className="w-5 h-5" />
                  <span className="font-semibold text-sm">{t('plant.last_watered')}</span>
                </div>
                <p className="text-lg font-medium text-foreground">
                  {plant.lastWateredDate ? formatDistanceToNow(new Date(plant.lastWateredDate), { addSuffix: true }) : t('plant.never')}
                </p>
                {plant.wateringIntervalDays && (
                  <p className="text-xs text-muted-foreground mt-1">{t('plant.every_days', { days: String(plant.wateringIntervalDays) })}</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <Sprout className="w-5 h-5" />
                  <span className="font-semibold text-sm">{t('plant.last_fertilized')}</span>
                </div>
                <p className="text-lg font-medium text-foreground">
                  {plant.lastFertilizedDate ? formatDistanceToNow(new Date(plant.lastFertilizedDate), { addSuffix: true }) : t('plant.never')}
                </p>
                {plant.fertilizingIntervalDays && (
                  <p className="text-xs text-muted-foreground mt-1">{t('plant.every_days', { days: String(plant.fertilizingIntervalDays) })}</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <Leaf className="w-5 h-5" />
                  <span className="font-semibold text-sm">{t('plant.last_pruned')}</span>
                </div>
                <p className="text-lg font-medium text-foreground">
                  {plant.lastPrunedDate ? formatDistanceToNow(new Date(plant.lastPrunedDate), { addSuffix: true }) : t('plant.never')}
                </p>
              </div>
            </div>
          </div>

          {plant.notes && (
            <div className="bg-card border rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-serif font-bold text-foreground mb-3">{t('plant.notes')}</h2>
              <div className="text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {plant.notes}
              </div>
            </div>
          )}

          <div className="bg-card border rounded-2xl p-6 shadow-sm">
             <h2 className="text-xl font-serif font-bold text-foreground mb-4">{t('plant.registration_details')}</h2>
             <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">{t('plant.planted')}</p>
                  <p className="font-medium text-foreground">{plant.plantedDate ? format(new Date(plant.plantedDate), 'MMMM d, yyyy') : t('plant.unknown_date')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{t('plant.added_to_ardana')}</p>
                  <p className="font-medium text-foreground">{format(new Date(plant.createdAt), 'MMMM d, yyyy')}</p>
                </div>
             </div>
          </div>
        </div>

        {/* Sidebar Reminders */}
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent-foreground" />
                {t('plant.tasks')}
              </h2>
            </div>

            {remindersLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : reminders && reminders.filter(r => !r.completed).length > 0 ? (
              <div className="space-y-3">
                {reminders.filter(r => !r.completed).map(reminder => (
                  <div key={reminder.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="w-8 h-8 rounded-full border-muted-foreground/30 hover:bg-primary hover:text-primary-foreground hover:border-primary shrink-0"
                      onClick={() => handleCompleteReminder(reminder.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground capitalize truncate">
                        {reminder.type === 'water' ? t('plant.log_water') : reminder.type === 'fertilize' ? t('plant.log_fertilize') : reminder.type === 'prune' ? t('plant.log_prune') : reminder.type}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(reminder.scheduledDate), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('plant.no_pending_tasks')}</p>
              </div>
            )}

            <div className="mt-6 pt-6 border-t text-center">
               <Link href="/reminders" className="text-sm text-primary font-medium hover:underline">
                 {t('plant.manage_reminders')}
               </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
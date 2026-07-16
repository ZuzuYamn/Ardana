import React, { useState } from 'react';
import { useListReminders, useUpdateReminder, getListRemindersQueryKey, useListPlants, useCreateReminder } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Circle, Sprout, Droplets, Leaf, Calendar, Filter, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';

const formSchema = z.object({
  plantId: z.coerce.number().min(1, "Plant is required"),
  type: z.string().min(1, "Type is required"),
  scheduledDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Reminders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('upcoming');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: reminders, isLoading } = useListReminders({ 
    completed: tab === 'completed' ? 'true' : 'false' 
  });
  
  const { data: plants } = useListPlants();
  
  const updateReminder = useUpdateReminder();
  const createReminder = useCreateReminder();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'watering',
      scheduledDate: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const handleToggleComplete = (id: number, currentStatus: boolean) => {
    updateReminder.mutate({ id, data: { completed: !currentStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey({ completed: 'false' }) });
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey({ completed: 'true' }) });
        if (!currentStatus) {
          toast({ title: "Task completed", description: "Good job!" });
        }
      }
    });
  };

  const onSubmit = (data: FormValues) => {
    createReminder.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey({ completed: 'false' }) });
        toast({ title: "Reminder added", description: "Task has been scheduled." });
        setIsAddOpen(false);
        form.reset();
      }
    });
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'watering': return <Droplets className="w-5 h-5 text-blue-500" />;
      case 'fertilizing': return <Sprout className="w-5 h-5 text-amber-500" />;
      case 'pruning': return <Leaf className="w-5 h-5 text-green-500" />;
      default: return <Clock className="w-5 h-5 text-slate-500" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case 'watering': return "bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900";
      case 'fertilizing': return "bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900";
      case 'pruning': return "bg-green-50/50 border-green-100 dark:bg-green-950/20 dark:border-green-900";
      default: return "bg-slate-50/50 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Reminders
          </h1>
          <p className="text-muted-foreground mt-1">Stay on top of your farm's maintenance schedule.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary text-primary-foreground">
              <Plus className="w-4 h-4" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">New Task</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="plantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plant</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select plant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plants?.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="watering">Watering</SelectItem>
                            <SelectItem value="fertilizing">Fertilizing</SelectItem>
                            <SelectItem value="pruning">Pruning</SelectItem>
                            <SelectItem value="spraying">Spraying</SelectItem>
                            <SelectItem value="harvesting">Harvesting</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createReminder.isPending}>
                  Schedule Task
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="upcoming" className="rounded-lg">Pending Tasks</TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg">Completed</TabsTrigger>
        </TabsList>
        
        <div className="mt-8">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
          ) : reminders && reminders.length > 0 ? (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {reminders.map(reminder => {
                  const date = new Date(reminder.scheduledDate);
                  const isOverdue = !reminder.completed && isPast(date) && !isToday(date);
                  
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      key={reminder.id}
                    >
                      <Card className={cn(
                        "overflow-hidden border transition-all hover:shadow-md",
                        getColorClass(reminder.type),
                        isOverdue && "border-destructive/50 bg-destructive/5"
                      )}>
                        <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                          <button 
                            onClick={() => handleToggleComplete(reminder.id, reminder.completed)}
                            className="group shrink-0"
                          >
                            {reminder.completed ? (
                              <CheckCircle2 className="w-8 h-8 text-primary" />
                            ) : (
                              <Circle className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                            )}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-1">
                              <h3 className="font-bold text-lg text-foreground truncate">{reminder.plantName}</h3>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className={cn(isOverdue && "text-destructive font-bold")}>
                                  {isToday(date) ? 'Today' : format(date, 'MMM d, yyyy')}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              {getIconForType(reminder.type)}
                              <span className="capitalize">{reminder.type}</span>
                            </div>
                            
                            {reminder.notes && (
                              <p className="text-sm text-foreground/70 bg-background/50 p-2 rounded-lg border border-border/50">
                                {reminder.notes}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          ) : (
             <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed bg-card/50">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="font-serif text-2xl font-bold mb-2">All caught up!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {tab === 'upcoming' 
                    ? "You have no pending tasks. Enjoy your day on the farm!" 
                    : "No completed tasks yet. Check pending tasks to see what needs to be done."}
                </p>
             </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}

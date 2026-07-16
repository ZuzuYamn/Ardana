import React, { useState } from 'react';
import { useCreatePlant } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Leaf, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  species: z.string().optional(),
  type: z.string().min(1, "Type is required"),
  location: z.string().optional(),
  plantedDate: z.string().optional(),
  healthStatus: z.string().default("healthy"),
  wateringIntervalDays: z.coerce.number().min(1).optional().or(z.literal("")),
  fertilizingIntervalDays: z.coerce.number().min(1).optional().or(z.literal("")),
  notes: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function PlantNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createPlant = useCreatePlant();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      species: '',
      type: 'plant',
      location: '',
      plantedDate: new Date().toISOString().split('T')[0],
      healthStatus: 'healthy',
      notes: '',
      photoUrl: '',
    },
  });

  const onSubmit = (data: FormValues) => {
    // Clean up empty string number fields
    const payload = {
      ...data,
      wateringIntervalDays: data.wateringIntervalDays === "" ? undefined : Number(data.wateringIntervalDays),
      fertilizingIntervalDays: data.fertilizingIntervalDays === "" ? undefined : Number(data.fertilizingIntervalDays),
      photoUrl: data.photoUrl === "" ? undefined : data.photoUrl,
    };

    createPlant.mutate({ data: payload }, {
      onSuccess: (newPlant) => {
        toast({
          title: "Plant added",
          description: `${newPlant.name} has been added to your farm.`,
        });
        setLocation(`/plants/${newPlant.id}`);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to add plant. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/plants" className="w-10 h-10 rounded-full border bg-card flex items-center justify-center hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Add New Record</h1>
          <p className="text-muted-foreground text-sm">Register a new crop or plant in your farmbook.</p>
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="h-32 bg-sidebar flex items-end px-8 pb-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center"></div>
          <Leaf className="w-12 h-12 text-primary absolute right-8 top-8 opacity-20" />
          <h2 className="text-xl font-serif font-semibold text-sidebar-foreground relative z-10">Plant Details</h2>
        </div>
        
        <div className="p-6 md:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Common Name / Nickname *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Tomato Patch 1, Olive Tree" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="species"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Species / Variety</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Solanum lycopersicum" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="crop">Crop</SelectItem>
                          <SelectItem value="tree">Tree</SelectItem>
                          <SelectItem value="plant">Plant</SelectItem>
                          <SelectItem value="flower">Flower</SelectItem>
                          <SelectItem value="herb">Herb</SelectItem>
                          <SelectItem value="shrub">Shrub</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="healthStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Initial Health</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="healthy">Healthy</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="poor">Poor</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. North Terrace, Greenhouse A" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plantedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Planted Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-8">
                <h3 className="text-lg font-serif font-semibold mb-4 text-foreground">Care Schedule</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="wateringIntervalDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Watering Interval (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 2" {...field} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fertilizingIntervalDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Fertilizing Interval (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 30" {...field} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-8">
                <h3 className="text-lg font-serif font-semibold mb-4 text-foreground">Media & Notes</h3>
                
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Photo URL (Optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="https://..." {...field} className="pl-9 bg-background" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-semibold">Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any specific care instructions or observations..." 
                            className="min-h-[100px] bg-background"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => setLocation('/plants')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPlant.isPending} className="min-w-[120px]">
                  {createPlant.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Record'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

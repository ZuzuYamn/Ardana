import React, { useState } from 'react';
import { useListPlants } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Leaf, Plus, Search, Filter, Sprout, AlertCircle, Droplets, MapPin, Activity } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

export default function PlantList() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
  const [healthStatus, setHealthStatus] = useState<string>('all');

  const { data: plants, isLoading } = useListPlants({
    search: search || undefined,
    type: type !== 'all' ? type : undefined,
    healthStatus: healthStatus !== 'all' ? healthStatus : undefined
  });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-3">
            <Leaf className="w-8 h-8 text-primary" />
            My Farm
          </h1>
          <p className="text-muted-foreground mt-1">Manage and track all your plants and crops.</p>
        </div>
        <Link href="/plants/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2 gap-2">
          <Plus className="w-4 h-4" />
          Add Plant
        </Link>
      </div>

      <div className="bg-card border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or species..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 sm:gap-4">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[140px] md:w-[180px]">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="crop">Crop</SelectItem>
              <SelectItem value="tree">Tree</SelectItem>
              <SelectItem value="plant">Plant</SelectItem>
              <SelectItem value="flower">Flower</SelectItem>
              <SelectItem value="herb">Herb</SelectItem>
              <SelectItem value="shrub">Shrub</SelectItem>
            </SelectContent>
          </Select>

          <Select value={healthStatus} onValueChange={setHealthStatus}>
            <SelectTrigger className="w-[140px] md:w-[180px]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder="Health" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="poor">Poor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-2xl border bg-card p-4 space-y-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : plants && plants.length > 0 ? (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {plants.map(plant => (
            <motion.div variants={item} key={plant.id}>
              <Link href={`/plants/${plant.id}`} className="block h-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring rounded-2xl group">
                <div className="h-full rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                  <div className="h-48 bg-muted relative overflow-hidden">
                    {plant.photoUrl ? (
                      <img src={plant.photoUrl} alt={plant.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/10">
                        <Sprout className="w-16 h-16 text-secondary/40" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md",
                        plant.healthStatus === 'healthy' ? "bg-green-500/90 text-white" :
                        plant.healthStatus === 'poor' ? "bg-red-500/90 text-white" :
                        "bg-amber-500/90 text-white"
                      )}>
                        {plant.healthStatus}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-black/50 text-white backdrop-blur-md capitalize shadow-sm">
                        {plant.type}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <h3 className="font-serif text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{plant.name}</h3>
                    <p className="text-sm text-muted-foreground italic mb-4">{plant.species || 'Unknown species'}</p>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-foreground/80">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{plant.location || 'No location'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-foreground/80">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span className="truncate">
                          {plant.lastWateredDate 
                            ? formatDistanceToNow(new Date(plant.lastWateredDate), { addSuffix: true }) 
                            : 'Never watered'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-20 px-4 rounded-2xl border-2 border-dashed bg-card/50">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Sprout className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="font-serif text-2xl font-bold mb-2">No plants found</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            {search || type !== 'all' || healthStatus !== 'all' 
              ? "We couldn't find any plants matching your current filters. Try adjusting them." 
              : "Your farm is currently empty. Add your first plant to start tracking its growth."}
          </p>
          {(search || type !== 'all' || healthStatus !== 'all') ? (
            <Button variant="outline" onClick={() => { setSearch(''); setType('all'); setHealthStatus('all'); }}>
              Clear Filters
            </Button>
          ) : (
            <Link href="/plants/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 py-2 gap-2">
              <Plus className="w-4 h-4" />
              Add First Plant
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

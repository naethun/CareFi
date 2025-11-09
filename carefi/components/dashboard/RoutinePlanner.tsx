'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sunrise, Moon, Flame, Clock, CheckCircle2, Circle, Sparkles, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import type { Recommendation } from '@/lib/types';

interface RoutineStep {
  id: string;
  label: string;
  type: 'cleanser' | 'toner' | 'treatment' | 'moisturizer' | 'sunscreen' | 'exfoliant';
  completed: boolean;
  timeMinutes: number;
  product?: Recommendation;
  tip?: string;
}

/**
 * Routine Planner Component
 *
 * Dynamic AM/PM routine with real product recommendations and progress tracking
 */
export function RoutinePlanner() {
  const [streak, setStreak] = useState(1);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<'am' | 'pm'>('am');

  // Fetch recommendations
  const { data: recommendations = [], isLoading } = useQuery<Recommendation[]>({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) return [];

      const result = await response.json();
      return result.success && result.data?.recommendations ? result.data.recommendations : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Map products to routine steps
  const mappedProducts = useMemo(() => {
    const map: Record<string, Recommendation | undefined> = {
      cleanser: recommendations.find(r => 
        r.name.toLowerCase().includes('cleanser') || 
        r.name.toLowerCase().includes('wash')
      ),
      treatment: recommendations.find(r => 
        r.name.toLowerCase().includes('serum') || 
        r.name.toLowerCase().includes('treatment') ||
        r.name.toLowerCase().includes('essence')
      ),
      moisturizer: recommendations.find(r => 
        r.name.toLowerCase().includes('moisturizer') || 
        r.name.toLowerCase().includes('cream') ||
        r.name.toLowerCase().includes('lotion')
      ),
      sunscreen: recommendations.find(r => 
        r.name.toLowerCase().includes('sunscreen') || 
        r.name.toLowerCase().includes('spf') ||
        r.name.toLowerCase().includes('sun')
      ),
      exfoliant: recommendations.find(r => 
        r.name.toLowerCase().includes('exfoliant') || 
        r.name.toLowerCase().includes('bha') ||
        r.name.toLowerCase().includes('aha')
      ),
    };
    return map;
  }, [recommendations]);

  // Initialize routine steps with real products
  const [amSteps, setAmSteps] = useState<RoutineStep[]>([
    { 
      id: 'am-cleanser', 
      label: 'Gentle cleanser', 
      type: 'cleanser',
      completed: false,
      timeMinutes: 2,
      tip: 'Use lukewarm water and gentle circular motions'
    },
    { 
      id: 'am-treatment', 
      label: 'Treatment serum', 
      type: 'treatment',
      completed: false,
      timeMinutes: 1,
      tip: 'Apply to damp skin for better absorption'
    },
    { 
      id: 'am-moisturizer', 
      label: 'Light moisturizer', 
      type: 'moisturizer',
      completed: false,
      timeMinutes: 1,
      tip: 'Wait 1-2 minutes before applying sunscreen'
    },
    { 
      id: 'am-sunscreen', 
      label: 'SPF 30+ sunscreen', 
      type: 'sunscreen',
      completed: true,
      timeMinutes: 1,
      tip: 'Reapply every 2 hours when outdoors'
    },
  ]);

  const [pmSteps, setPmSteps] = useState<RoutineStep[]>([
    { 
      id: 'pm-cleanser', 
      label: 'Double cleanse', 
      type: 'cleanser',
      completed: false,
      timeMinutes: 3,
      tip: 'First oil-based, then water-based cleanser'
    },
    { 
      id: 'pm-exfoliant', 
      label: 'Exfoliant (2-3x/week)', 
      type: 'exfoliant',
      completed: false,
      timeMinutes: 1,
      tip: 'Skip on days when skin feels sensitive'
    },
    { 
      id: 'pm-treatment', 
      label: 'Night treatment', 
      type: 'treatment',
      completed: false,
      timeMinutes: 1,
      tip: 'Layer lightest to heaviest texture'
    },
    { 
      id: 'pm-moisturizer', 
      label: 'Rich night cream', 
      type: 'moisturizer',
      completed: false,
      timeMinutes: 1,
      tip: 'Apply while skin is still slightly damp'
    },
  ]);

  // Update steps with product data when available
  useEffect(() => {
    if (recommendations.length > 0) {
      setAmSteps(prev => prev.map(step => ({
        ...step,
        product: mappedProducts[step.type]
      })));
      setPmSteps(prev => prev.map(step => ({
        ...step,
        product: mappedProducts[step.type]
      })));
    }
  }, [recommendations, mappedProducts]);

  // Calculate progress
  const amProgress = useMemo(() => {
    const completed = amSteps.filter(s => s.completed).length;
    return Math.round((completed / amSteps.length) * 100);
  }, [amSteps]);

  const pmProgress = useMemo(() => {
    const completed = pmSteps.filter(s => s.completed).length;
    return Math.round((completed / pmSteps.length) * 100);
  }, [pmSteps]);

  const totalTime = useMemo(() => {
    const currentSteps = activeTab === 'am' ? amSteps : pmSteps;
    return currentSteps.reduce((sum, step) => sum + step.timeMinutes, 0);
  }, [activeTab, amSteps, pmSteps]);

  const toggleStep = (
    id: string,
    steps: RoutineStep[],
    setSteps: React.Dispatch<React.SetStateAction<RoutineStep[]>>
  ) => {
    setSteps(
      steps.map((step) =>
        step.id === id ? { ...step, completed: !step.completed } : step
      )
    );
  };

  const handleMarkDayComplete = () => {
    const allCompleted =
      amSteps.every((s) => s.completed) && pmSteps.every((s) => s.completed);

    if (allCompleted && !todayCompleted) {
      setStreak(streak + 1);
      setTodayCompleted(true);
      // Show celebration
      alert('🎉 Amazing! Day complete. Keep up the great work!');
    } else {
      alert('Complete all steps in both AM and PM routines first.');
    }
  };

  const renderSteps = (
    steps: RoutineStep[],
    setSteps: React.Dispatch<React.SetStateAction<RoutineStep[]>>
  ) => (
    <div className="space-y-3">
      {steps.map((step) => (
        <div 
          key={step.id} 
          className={`rounded-lg border p-3 transition-all ${
            step.completed 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-white border-neutral-200 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id={step.id}
              checked={step.completed}
              onCheckedChange={() => toggleStep(step.id, steps, setSteps)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <label
                htmlFor={step.id}
                className={`block text-sm font-medium cursor-pointer ${
                  step.completed
                    ? 'text-emerald-700 line-through'
                    : 'text-neutral-900'
                }`}
              >
                {step.label}
              </label>
              
              {/* Product info */}
              {step.product ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-600 truncate">
                      {step.product.name}
                    </span>

                  </div>
                  {step.product.key_ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {step.product.key_ingredients.slice(0, 2).map((ingredient, i) => (
                        <span key={i} className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  )}

                </div>
              ) : isLoading ? (
                <Skeleton className="h-4 w-32 mt-2" />
              ) : (
                <p className="text-xs text-neutral-500 mt-1 italic">
                  No product matched yet
                </p>
              )}

              {/* Tip */}
              {step.tip && !step.completed && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-neutral-600">
                  <Sparkles className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                  <span>{step.tip}</span>
                </div>
              )}
            </div>
            
            {/* Time estimate */}
            <div className="flex items-center gap-1 text-xs text-neutral-500 shrink-0">
              <Clock className="h-3 w-3" />
              {step.timeMinutes}m
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Routine Planner</CardTitle>
            {isLoading && (
              <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-50 to-red-50 px-3 py-1 text-sm font-semibold text-orange-700 border border-orange-200">
            <Flame className="h-4 w-4" />
            <span>{streak} day streak</span>
          </div>
        </div>
        
        {/* Overall progress */}
        {isLoading ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Loading your routine...</span>
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-600">
              <span>Daily progress</span>
              <span className="font-medium">
                {Math.round((amProgress + pmProgress) / 2)}%
              </span>
            </div>
            <Progress value={(amProgress + pmProgress) / 2} className="h-2" />
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'am' | 'pm')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="am" className="relative">
                <Sunrise className="mr-2 h-4 w-4" />
                Morning
                {isLoading ? (
                  <Loader2 className="ml-2 h-3 w-3 animate-spin text-neutral-400" />
                ) : (
                  <>
                    {amProgress > 0 && amProgress < 100 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {amProgress}%
                      </Badge>
                    )}
                    {amProgress === 100 && (
                      <CheckCircle2 className="ml-2 h-4 w-4 text-emerald-600" />
                    )}
                  </>
                )}
              </TabsTrigger>
              <TabsTrigger value="pm" className="relative">
                <Moon className="mr-2 h-4 w-4" />
                Night
                {isLoading ? (
                  <Loader2 className="ml-2 h-3 w-3 animate-spin text-neutral-400" />
                ) : (
                  <>
                    {pmProgress > 0 && pmProgress < 100 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {pmProgress}%
                      </Badge>
                    )}
                    {pmProgress === 100 && (
                      <CheckCircle2 className="ml-2 h-4 w-4 text-emerald-600" />
                    )}
                  </>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="am" className="mt-4">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-neutral-400 mb-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading routine steps...</span>
                  </div>
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                <div className="animate-in fade-in duration-300">
                  <div className="mb-3 flex items-center gap-2 text-sm text-neutral-600">
                    <Clock className="h-4 w-4" />
                    <span>~{totalTime} minutes total</span>
                  </div>
                  {renderSteps(amSteps, setAmSteps)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pm" className="mt-4">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-neutral-400 mb-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading routine steps...</span>
                  </div>
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                <div className="animate-in fade-in duration-300">
                  <div className="mb-3 flex items-center gap-2 text-sm text-neutral-600">
                    <Clock className="h-4 w-4" />
                    <span>~{totalTime} minutes total</span>
                  </div>
                  {renderSteps(pmSteps, setPmSteps)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Button
          onClick={handleMarkDayComplete}
          className="mt-6 w-full"
          variant={todayCompleted ? "secondary" : "default"}
          disabled={todayCompleted || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : todayCompleted ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Day Complete!
            </>
          ) : (
            <>
              <Circle className="mr-2 h-4 w-4" />
              Mark Day Complete
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}


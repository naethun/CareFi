'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, ShoppingCart, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, Column } from '@/components/ui/data-table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/format';
import type { Recommendation } from '@/lib/types';

interface RecommendationsTableProps {
  userId?: string;
  analysisId?: string;
  skinConcerns?: string[];
}

/**
 * Recommendations Table Component
 *
 * Displays AI-powered product recommendations based on skin analysis.
 * Uses OpenAI to re-rank candidate products from the database.
 */
// Loading step component
function LoadingStep({ 
  label, 
  isActive, 
  isComplete 
}: { 
  label: string; 
  isActive: boolean; 
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      {isComplete ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
      ) : isActive ? (
        <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-neutral-300 flex-shrink-0" />
      )}
      <span className={`text-sm ${
        isComplete ? 'text-emerald-700 font-medium' : 
        isActive ? 'text-blue-700 font-medium' : 
        'text-neutral-400'
      }`}>
        {label}
      </span>
    </div>
  );
}

export function RecommendationsTable({ 
  userId, 
  analysisId,
  skinConcerns = [] 
}: RecommendationsTableProps) {
  const [cart, setCart] = useState<Set<string>>(new Set());
  const [loadingStep, setLoadingStep] = useState(0);

  // Fetch recommendations using the new API endpoint
  const { data, isLoading, error, refetch } = useQuery<Recommendation[]>({
    queryKey: ['recommendations', userId, analysisId],
    queryFn: async () => {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          analysisId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to fetch recommendations');
      }

      const result = await response.json();
      
      // API returns { success: true, data: { recommendations: Recommendation[] } }
      if (result.success && result.data?.recommendations) {
        return result.data.recommendations;
      }
      
      throw new Error('Invalid response format from recommendations API');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - recommendations don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    retry: 1, // Only retry once on failure
  });

  // Animate through loading steps
  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }

    const steps = [
      { delay: 0 },      // Step 0: Analyzing skin profile
      { delay: 2000 },   // Step 1: Building candidate pool (2s)
      { delay: 3000 },   // Step 2: Matching ingredients (5s total)
      { delay: 3000 },   // Step 3: AI ranking (8s total)
    ];

    let timeoutId: NodeJS.Timeout;
    let currentStep = 0;

    const scheduleNextStep = () => {
      if (currentStep < steps.length - 1) {
        timeoutId = setTimeout(() => {
          currentStep++;
          setLoadingStep(currentStep);
          scheduleNextStep();
        }, steps[currentStep + 1].delay);
      }
    };

    scheduleNextStep();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading]);

  const addToCart = (productId: string) => {
    setCart((prev) => new Set(prev).add(productId));
    // In real app: update global cart state or trigger checkout flow
  };

  const columns: Column<Recommendation>[] = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium text-neutral-900">{item.name}</p>
          <p className="text-xs text-neutral-500">{item.vendor}</p>
        </div>
      ),
    },
    {
      key: 'concern_tags',
      label: 'Concerns',
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.concern_tags && item.concern_tags.length > 0 ? (
            <>
              {item.concern_tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {item.concern_tags.length > 2 && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="secondary" 
                        className="text-xs cursor-help hover:bg-neutral-300 transition-colors"
                      >
                        +{item.concern_tags.length - 2}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="top" 
                      className="bg-neutral-900 text-white border-none shadow-lg max-w-xs"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-semibold mb-1">All concerns:</div>
                        <div className="flex flex-wrap gap-1">
                          {item.concern_tags.map((tag) => (
                            <span 
                              key={tag} 
                              className="text-xs px-2 py-0.5 bg-white/10 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'key_ingredients',
      label: 'Key Ingredients',
      render: (item) => (
        <span className="text-sm text-neutral-700">
          {item.key_ingredients && item.key_ingredients.length > 0 ? (
            <>
              {item.key_ingredients.slice(0, 2).join(', ')}
              {item.key_ingredients.length > 2 && ` +${item.key_ingredients.length - 2}`}
            </>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </span>
      ),
    },
    {
      key: 'price_usd',
      label: 'Price',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-semibold text-neutral-900">
            {formatCurrency(item.price_usd)}
          </p>
          {item.retail_usd > item.price_usd && (
            <p className="text-xs text-neutral-400 line-through">
              {formatCurrency(item.retail_usd)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'savings',
      label: 'Savings',
      sortable: true,
      sortFn: (a, b) => (b.retail_usd - b.price_usd) - (a.retail_usd - a.price_usd),
      render: (item) => {
        const savings = item.retail_usd - item.price_usd;
        const percent = savings > 0 ? Math.round((savings / item.retail_usd) * 100) : 0;
        return savings > 0 ? (
          <span className="text-sm font-medium text-emerald-600">
            -{percent}%
          </span>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => addToCart(item.id)}
            disabled={cart.has(item.id)}
          >
            {cart.has(item.id) ? (
              'Added'
            ) : (
              <>
                <ShoppingCart className="mr-1 h-3 w-3" />
                Add
              </>
            )}
          </Button>
          {item.url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(item.url, '_blank')}
              aria-label={`View ${item.name} on ${item.vendor}`}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Personalized Recommendations</CardTitle>
          {!isLoading && data && data.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {data.length} products
            </Badge>
          )}
        </div>
        {skinConcerns.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-sm text-neutral-500 mr-2">Based on:</span>
            {skinConcerns.map((concern) => (
              <Badge key={concern} variant="outline" className="text-xs">
                {concern}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">Generating Your Recommendations</h3>
                <p className="text-sm text-neutral-500">Our AI is analyzing your skin profile...</p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="mb-8 bg-neutral-50 rounded-lg p-5 border border-neutral-200">
              <LoadingStep 
                label="Analyzing your skin profile and concerns" 
                isActive={loadingStep === 0}
                isComplete={loadingStep > 0}
              />
              <LoadingStep 
                label="Building candidate pool from database" 
                isActive={loadingStep === 1}
                isComplete={loadingStep > 1}
              />
              <LoadingStep 
                label="Matching active ingredients to your needs" 
                isActive={loadingStep === 2}
                isComplete={loadingStep > 2}
              />
              <LoadingStep 
                label="AI-powered intelligent ranking" 
                isActive={loadingStep === 3}
                isComplete={loadingStep > 3}
              />
            </div>
          </div>
        ) : error ? (
          <EmptyState
            title="Unable to load recommendations"
            description={
              error instanceof Error 
                ? error.message 
                : "Please try again or contact support if the issue persists"
            }
            action={
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            }
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No recommendations available"
            description="Complete your skin analysis to get personalized product recommendations"
            action={
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Refresh
              </Button>
            }
          />
        ) : (
          <div>
            <p className="text-sm text-neutral-600 mb-4">
              These products are ranked by AI based on your skin analysis, budget, and preferences.
            </p>
            <DataTable
              data={data}
              columns={columns}
              getRowKey={(item) => item.id}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

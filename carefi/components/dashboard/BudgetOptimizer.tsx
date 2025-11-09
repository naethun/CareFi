'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { TrendingDown, ShoppingBag, AlertCircle, Sparkles, Package, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BudgetSlider } from '@/components/ui/budget-slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { useBudget } from '@/lib/budget-context';
import type { Recommendation } from '@/lib/types';

/**
 * Budget Optimizer Component
 *
 * Dynamic budget optimization that:
 * - Fetches real recommendation data
 * - Filters products by current budget range
 * - Calculates actual savings based on retail prices
 * - Shows product distribution by category
 * - Provides smart budget suggestions
 */
export function BudgetOptimizer() {
  const { min, max, absoluteMin, absoluteMax, setRange } = useBudget();
  const [isCalculating, setIsCalculating] = useState(false);

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

  // Show calculating state briefly when budget changes
  useEffect(() => {
    setIsCalculating(true);
    const timer = setTimeout(() => setIsCalculating(false), 300);
    return () => clearTimeout(timer);
  }, [min, max]);

  // Filter products within current budget range and calculate metrics
  const budgetMetrics = useMemo(() => {
    const productsInBudget = recommendations.filter(
      (rec) => rec.price_usd >= min && rec.price_usd <= max
    );

    const currentTotal = productsInBudget.reduce((sum, rec) => sum + rec.price_usd, 0);
    const retailTotal = productsInBudget.reduce((sum, rec) => sum + rec.retail_usd, 0);
    const savings = retailTotal - currentTotal;
    const savingsPercent = retailTotal > 0 ? Math.round((savings / retailTotal) * 100) : 0;

    // Calculate product distribution by price tier
    const lowPrice = productsInBudget.filter((r) => r.price_usd < 15).length;
    const midPrice = productsInBudget.filter((r) => r.price_usd >= 15 && r.price_usd < 40).length;
    const highPrice = productsInBudget.filter((r) => r.price_usd >= 40).length;

    // Calculate average product price in budget
    const avgPrice = productsInBudget.length > 0 ? currentTotal / productsInBudget.length : 0;

    return {
      count: productsInBudget.length,
      currentTotal,
      retailTotal,
      savings,
      savingsPercent,
      lowPrice,
      midPrice,
      highPrice,
      avgPrice,
    };
  }, [recommendations, min, max]);

  // Smart suggestion: optimal budget based on recommendation distribution
  const suggestion = useMemo(() => {
    if (recommendations.length === 0) return null;

    // Find the budget range that captures most essential products (cleanser, treatment, moisturizer, sunscreen)
    const essentialProducts = recommendations.filter((rec) => 
      rec.name.toLowerCase().includes('cleanser') ||
      rec.name.toLowerCase().includes('treatment') ||
      rec.name.toLowerCase().includes('moisturizer') ||
      rec.name.toLowerCase().includes('sunscreen') ||
      rec.name.toLowerCase().includes('serum')
    );

    if (essentialProducts.length === 0) return null;

    const prices = essentialProducts.map((r) => r.price_usd).sort((a, b) => a - b);
    const suggestedMin = Math.floor(prices[0] * 0.8);
    const suggestedMax = Math.ceil(prices[Math.min(3, prices.length - 1)] * 1.2);

    // Only show suggestion if user's range is significantly different
    if (min < suggestedMin * 0.7 || max > suggestedMax * 1.5) {
      return { min: suggestedMin, max: suggestedMax };
    }

    return null;
  }, [recommendations, min, max]);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Budget Optimizer</CardTitle>
          {isLoading ? (
            <Badge variant="outline" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              {isCalculating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ShoppingBag className="h-3 w-3" />
              )}
              {budgetMetrics.count} products
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 flex-1 flex flex-col">
        <div className="space-y-6 flex-1">
          <BudgetSlider
            min={min}
            max={max}
            absoluteMin={absoluteMin}
            absoluteMax={absoluteMax}
            onChange={setRange}
          />

          {/* Smart Suggestion */}
          {!isLoading && suggestion && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-900">
                    Suggested range: {formatCurrency(suggestion.min)} - {formatCurrency(suggestion.max)}
                  </p>
                  <button
                    onClick={() => setRange(suggestion.min, suggestion.max)}
                    className="mt-1 text-xs text-blue-700 hover:text-blue-800 underline"
                  >
                    Apply suggestion
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State for Metrics */}
          {isLoading ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4">
                <div className="flex items-start gap-3">
                  <Loader2 className="h-5 w-5 text-neutral-400 animate-spin flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <div className="pt-2">
                      <Skeleton className="h-3 w-1/2 mb-2" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Savings Summary */}
              {budgetMetrics.count > 0 ? (
            <div className={`rounded-lg bg-emerald-50 border border-emerald-200 p-4 transition-opacity duration-200 ${
              isCalculating ? 'opacity-50' : 'opacity-100'
            }`}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {isCalculating ? (
                    <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      You're saving {budgetMetrics.savingsPercent}%
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      {budgetMetrics.count} products total{' '}
                      <span className="font-semibold">{formatCurrency(budgetMetrics.currentTotal)}</span>{' '}
                      vs{' '}
                      <span className="line-through">{formatCurrency(budgetMetrics.retailTotal)}</span>{' '}
                      retail
                    </p>
                  </div>

                  {/* Product Distribution */}
                  <div className="pt-2 border-t border-emerald-200">
                    <p className="text-xs font-medium text-emerald-800 mb-2">Price distribution:</p>
                    <div className="flex gap-2 text-xs">
                      {budgetMetrics.lowPrice > 0 && (
                        <Badge variant="outline" className="bg-white/50 text-emerald-700 border-emerald-300">
                          {budgetMetrics.lowPrice} under $15
                        </Badge>
                      )}
                      {budgetMetrics.midPrice > 0 && (
                        <Badge variant="outline" className="bg-white/50 text-emerald-700 border-emerald-300">
                          {budgetMetrics.midPrice} mid-range
                        </Badge>
                      )}
                      {budgetMetrics.highPrice > 0 && (
                        <Badge variant="outline" className="bg-white/50 text-emerald-700 border-emerald-300">
                          {budgetMetrics.highPrice} premium
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Average Price */}
                  {budgetMetrics.avgPrice > 0 && (
                    <p className="text-xs text-emerald-600 pt-1">
                      Avg: {formatCurrency(budgetMetrics.avgPrice)}/product
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    No products in this range
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Try adjusting your budget to see recommendations
                  </p>
                </div>
              </div>
            </div>
              )}
            </>
          )}
        </div>

        {/* Action Button */}
        <Button 
          asChild 
          variant="outline" 
          className="w-full"
          disabled={isLoading || budgetMetrics.count === 0}
        >
          <Link href="/checkout">
            <Package className="h-4 w-4 mr-2" />
            {isLoading ? 'Loading...' : `View ${budgetMetrics.count} products`}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

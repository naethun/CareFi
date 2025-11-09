/**
 * Recommendation System Schemas and Types
 *
 * Provides Zod validation schemas, TypeScript types, and mapping logic
 * for the OpenAI-powered product recommendation system.
 */

import { z } from 'zod';

// ============================================================================
// TRAIT-TO-ACTIVE MAPPING
// ============================================================================

/**
 * Maps detected skin traits to evidence-based active ingredients
 * that target those specific concerns.
 */
export const TRAIT_ACTIVE_MAP: Record<string, string[]> = {
  acne: ['Salicylic Acid', 'Benzoyl Peroxide', 'Niacinamide', 'Azelaic Acid'],
  oiliness: ['Niacinamide', 'Zinc PCA', 'Salicylic Acid'],
  dryness: ['Hyaluronic Acid', 'Glycerin', 'Ceramides', 'Squalane'],
  sensitivity: ['Centella Asiatica', 'Allantoin', 'Panthenol', 'Bisabolol', 'Niacinamide'],
  redness: ['Centella Asiatica', 'Allantoin', 'Panthenol', 'Bisabolol', 'Niacinamide'],
  hyperpigmentation: ['Niacinamide', 'Vitamin C', 'Azelaic Acid', 'Kojic Acid', 'Arbutin'],
  'fine-lines': ['Retinol', 'Peptides', 'Bakuchiol', 'Hyaluronic Acid'],
  'large-pores': ['Niacinamide', 'Salicylic Acid', 'Retinol'],
};

/**
 * Product types for building a complete skincare routine
 */
export const ROUTINE_PRODUCT_TYPES = ['Cleanser', 'Treatment', 'Moisturizer', 'Sunscreen'] as const;

/**
 * Valid merchant/vendor options
 */
export const VALID_VENDORS = ['amazon', 'yesstyle', 'sephora'] as const;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Schema for POST /api/recommendations request body
 */
export const RecommendationsRequestSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID (optional, inferred from session if not provided)'),
  analysisId: z.string().uuid().optional().describe('Specific analysis ID to use (optional, uses latest if not provided)'),
});

export type RecommendationsRequest = z.infer<typeof RecommendationsRequestSchema>;

/**
 * Schema for a single product recommendation
 * Matches the Recommendation type in lib/types.ts
 */
export const RecommendationSchema = z.object({
  id: z.string().describe('Product UUID'),
  name: z.string().describe('Product name'),
  concern_tags: z.array(z.string()).describe('Skin concerns this product addresses'),
  key_ingredients: z.array(z.string()).describe('Active ingredients'),
  price_usd: z.number().describe('Current price'),
  retail_usd: z.number().describe('Original retail price (or same as price if no discount)'),
  vendor: z.enum(VALID_VENDORS).describe('Primary merchant'),
  url: z.string().describe('Product purchase URL'),
});

export type RecommendationOutput = z.infer<typeof RecommendationSchema>;

/**
 * Schema for API response
 */
export const RecommendationsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    recommendations: z.array(RecommendationSchema),
  }),
});

export type RecommendationsResponse = z.infer<typeof RecommendationsResponseSchema>;

// ============================================================================
// INTERNAL SERVICE TYPES
// ============================================================================

/**
 * Compact product representation for LLM input
 * (limited fields to reduce token usage)
 */
export const CandidateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  brand: z.string(),
  product_type: z.string(),
  price_usd: z.number(),
  active_ingredients: z.array(z.string()),
  merchants: z.array(z.string()),
  // dupe_group_id and product_link excluded from LLM payload to reduce size
});

export type CandidateProduct = z.infer<typeof CandidateProductSchema>;

/**
 * Full product row from database
 */
export interface ProductRow {
  id: string;
  name: string;
  brand: string;
  product_type: string;
  price_usd: number;
  merchants: string[];
  active_ingredients: string[];
  all_ingredients: string | null;
  product_link: string | null;
  image_url: string | null;
  dupe_group_id: string | null;
  is_active: boolean;
}

/**
 * Detected skin trait from analysis
 */
export interface SkinTrait {
  id: string;
  name: string;
  severity: 'low' | 'moderate' | 'high';
  description: string;
}

/**
 * User profile data for recommendation context
 */
export interface UserProfile {
  skin_concerns: string[];
  skin_goals: string[];
  ingredients_to_avoid: string[];
  budget_min_usd: number;
  budget_max_usd: number;
}

// ============================================================================
// LLM INPUT/OUTPUT SCHEMAS
// ============================================================================

/**
 * Schema for the input sent to OpenAI for reranking
 */
export const LLMRankInputSchema = z.object({
  user_profile: z.object({
    skin_concerns: z.array(z.string()),
    skin_goals: z.array(z.string()),
    ingredients_to_avoid: z.array(z.string()),
    budget_min_usd: z.number(),
    budget_max_usd: z.number(),
  }),
  detected_traits: z.array(
    z.object({
      name: z.string(),
      severity: z.enum(['low', 'moderate', 'high']),
    })
  ),
  candidate_products: z.array(CandidateProductSchema),
  instructions: z.object({
    return_count_min: z.number().default(8),
    return_count_max: z.number().default(12),
    required_steps: z.array(z.string()).default(['Cleanser', 'Treatment', 'Moisturizer', 'Sunscreen']),
  }),
});

export type LLMRankInput = z.infer<typeof LLMRankInputSchema>;

/**
 * Schema for a single ranked item from OpenAI
 */
export const LLMRankedItemSchema = z.object({
  product_id: z.string().uuid().describe('Product UUID from candidate list'),
  score: z.number().min(0).max(1).describe('Relevance score 0.0 to 1.0'),
  reason: z.string().max(200).describe('Short rationale (<=20 words)'),
  step: z.string().describe('Routine step category'),
  selected_vendor: z.string().describe('Chosen merchant from available options'),
});

export type LLMRankedItem = z.infer<typeof LLMRankedItemSchema>;

/**
 * Schema for the complete LLM response
 */
export const LLMRankOutputSchema = z.object({
  items: z
    .array(LLMRankedItemSchema)
    .min(8)
    .max(12)
    .describe('8-12 ranked products balanced across routine steps'),
  confidence: z.number().min(0).max(100).describe('Overall confidence in recommendations 0-100'),
});

export type LLMRankOutput = z.infer<typeof LLMRankOutputSchema>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize an ingredient name for case-insensitive comparison
 */
export function normalizeIngredient(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Map detected traits and user goals to a prioritized list of active ingredients
 *
 * @param traits - Array of detected skin traits
 * @param goals - Array of user-stated skin goals
 * @returns Deduplicated array of active ingredients, prioritized by severity
 */
export function mapTraitsToActives(traits: SkinTrait[], goals: string[]): string[] {
  const activesSet = new Set<string>();

  // Sort traits by severity (high -> moderate -> low) for priority
  const sortedTraits = [...traits].sort((a, b) => {
    const severityOrder = { high: 3, moderate: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  // Add actives based on detected traits
  for (const trait of sortedTraits) {
    const actives = TRAIT_ACTIVE_MAP[trait.id] || [];
    actives.forEach((active) => activesSet.add(active));
  }

  // Add actives based on user goals (map common goal phrases to traits)
  const goalToTraitMap: Record<string, string> = {
    'clear skin': 'acne',
    'even tone': 'hyperpigmentation',
    hydration: 'dryness',
    'anti-aging': 'fine-lines',
    'oil control': 'oiliness',
    calming: 'sensitivity',
  };

  for (const goal of goals) {
    const normalizedGoal = goal.toLowerCase();
    const traitId = goalToTraitMap[normalizedGoal];
    if (traitId) {
      const actives = TRAIT_ACTIVE_MAP[traitId] || [];
      actives.forEach((active) => activesSet.add(active));
    }
  }

  return Array.from(activesSet);
}

/**
 * Filter out products containing any ingredients the user wants to avoid
 *
 * @param products - Array of products to filter
 * @param ingredientsToAvoid - Array of ingredient names to exclude (can be null/undefined)
 * @returns Filtered array of products
 */
export function filterAllergies(
  products: ProductRow[], 
  ingredientsToAvoid: string[] | null | undefined
): ProductRow[] {
  // Handle null, undefined, or non-array values
  if (!ingredientsToAvoid || !Array.isArray(ingredientsToAvoid) || ingredientsToAvoid.length === 0) {
    return products;
  }

  const normalizedAvoid = ingredientsToAvoid.map(normalizeIngredient);

  return products.filter((product) => {
    // Check active ingredients
    const hasAvoidedActive = product.active_ingredients.some((active) =>
      normalizedAvoid.some((avoid) => normalizeIngredient(active).includes(avoid))
    );

    if (hasAvoidedActive) {
      return false;
    }

    // Check full ingredient list if available
    if (product.all_ingredients) {
      const normalizedAll = normalizeIngredient(product.all_ingredients);
      const hasAvoidedInAll = normalizedAvoid.some((avoid) => normalizedAll.includes(avoid));
      if (hasAvoidedInAll) {
        return false;
      }
    }

    return true;
  });
}

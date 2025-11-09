/**
 * Recommendation Service
 *
 * Core orchestration for product recommendations:
 * 1. Build candidate pool from PostgreSQL (budget, allergies, trait-matched actives)
 * 2. Rerank candidates with OpenAI (compact payload, deterministic)
 * 3. Transform LLM output to Recommendation[] type
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  CandidateProduct,
  ProductRow,
  SkinTrait,
  UserProfile,
  LLMRankInput,
  LLMRankOutput,
  RecommendationOutput,
  mapTraitsToActives,
  filterAllergies,
  ROUTINE_PRODUCT_TYPES,
  VALID_VENDORS,
  TRAIT_ACTIVE_MAP,
} from './schema';
import { rerankProducts } from '@/lib/ai/openai';

// ============================================================================
// CANDIDATE POOL BUILDING
// ============================================================================

/**
 * Build a diversified candidate pool of products based on user context
 *
 * Steps:
 * 1. Fetch latest skin analysis for detected traits
 * 2. Fetch user onboarding data for budget + allergies + goals
 * 3. Map traits/goals to active ingredients
 * 4. Query products table with filters:
 *    - is_active = TRUE
 *    - price within budget range
 *    - active ingredients overlap with mapped actives
 * 5. Filter out allergy conflicts
 * 6. Diversify across product types (cap per type to avoid over-representation)
 * 7. Return 60-100 candidates
 *
 * @param supabase - Authenticated Supabase client (respects RLS)
 * @param userId - User UUID
 * @param analysisId - Optional specific analysis ID (uses latest if not provided)
 * @returns Array of candidate products for LLM reranking
 */
export async function buildCandidatePool(
  supabase: SupabaseClient,
  userId: string,
  analysisId?: string
): Promise<{ candidates: CandidateProduct[]; userProfile: UserProfile; traits: SkinTrait[] }> {
  // 1. Fetch skin analysis
  let analysis: { id: string; detected_traits: any; confidence_score: number } | null = null;

  if (analysisId) {
    const { data, error } = await supabase
      .from('skin_analyses')
      .select('id, detected_traits, confidence_score')
      .eq('id', analysisId)
      .eq('user_id', userId)
      .eq('status', 'complete')
      .single();

    if (error) {
      console.error('[Service] Failed to fetch analysis by ID:', error);
      throw new Error(`Analysis not found: ${analysisId}`);
    }
    analysis = data;
  } else {
    // Fetch latest completed analysis
    const { data, error } = await supabase
      .from('skin_analyses')
      .select('id, detected_traits, confidence_score')
      .eq('user_id', userId)
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[Service] Failed to fetch latest analysis:', error);
      throw new Error('No completed skin analysis found for user');
    }
    analysis = data;
  }

  const traits: SkinTrait[] = Array.isArray(analysis.detected_traits) ? analysis.detected_traits : [];

  if (traits.length === 0) {
    console.warn('[Service] Analysis has no detected traits');
  }

  // 2. Fetch user onboarding data
  const { data: onboarding, error: onboardingError } = await supabase
    .from('onboarding_data')
    .select('skin_concerns, skin_goals, ingredients_to_avoid, budget_min_usd, budget_max_usd')
    .eq('user_id', userId)
    .single();

  if (onboardingError || !onboarding) {
    console.error('[Service] Failed to fetch onboarding data:', onboardingError);
    throw new Error('User onboarding data not found');
  }

  const userProfile: UserProfile = {
    skin_concerns: Array.isArray(onboarding.skin_concerns) ? onboarding.skin_concerns : [],
    skin_goals: Array.isArray(onboarding.skin_goals) ? onboarding.skin_goals : [],
    ingredients_to_avoid: Array.isArray(onboarding.ingredients_to_avoid) 
      ? onboarding.ingredients_to_avoid 
      : [],
    budget_min_usd: parseFloat(String(onboarding.budget_min_usd)),
    budget_max_usd: parseFloat(String(onboarding.budget_max_usd)),
  };

  // 3. Map traits + goals to active ingredients
  const targetActives = mapTraitsToActives(traits, userProfile.skin_goals);

  console.log('[Service] Target actives:', targetActives.slice(0, 5), '...');

  // 4. Query products (with budget + active filters)
  // Note: We query broadly and then filter/diversify in-memory for simplicity
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(
      'id, name, brand, product_type, price_usd, merchants, active_ingredients, all_ingredients, product_link, image_url, dupe_group_id, is_active'
    )
    .eq('is_active', true)
    .gte('price_usd', userProfile.budget_min_usd)
    .lte('price_usd', userProfile.budget_max_usd)
    .order('price_usd', { ascending: true });

  if (productsError) {
    console.error('[Service] Failed to fetch products:', productsError);
    throw new Error('Failed to retrieve products from database');
  }

  let productRows: ProductRow[] = products || [];

  console.log(`[Service] Fetched ${productRows.length} products within budget`);

  // 5. Filter out allergy conflicts
  productRows = filterAllergies(productRows, userProfile.ingredients_to_avoid);

  console.log(`[Service] ${productRows.length} products after allergy filtering`);

  // 6. Score products by active ingredient overlap
  interface ScoredProduct {
    product: ProductRow;
    score: number;
  }

  const scoredProducts: ScoredProduct[] = productRows.map((product) => {
    let score = 0;

    // Count how many target actives this product has
    for (const active of product.active_ingredients) {
      if (targetActives.some((target) => active.toLowerCase().includes(target.toLowerCase()))) {
        score += 1;
      }
    }

    // Bonus for products in routine steps
    if (ROUTINE_PRODUCT_TYPES.includes(product.product_type as any)) {
      score += 0.5;
    }

    return { product, score };
  });

  // Sort by score descending
  scoredProducts.sort((a, b) => b.score - a.score);

  // 7. Diversify across product types (max 6 per type)
  const typeCount: Record<string, number> = {};
  const MAX_PER_TYPE = 6;
  const MAX_TOTAL_CANDIDATES = 25; // Optimized for speed while maintaining quality

  const diversified: ProductRow[] = [];

  for (const { product } of scoredProducts) {
    const currentCount = typeCount[product.product_type] || 0;

    if (currentCount < MAX_PER_TYPE && diversified.length < MAX_TOTAL_CANDIDATES) {
      diversified.push(product);
      typeCount[product.product_type] = currentCount + 1;
    }

    if (diversified.length >= MAX_TOTAL_CANDIDATES) {
      break;
    }
  }

  console.log(`[Service] Diversified to ${diversified.length} candidates across types:`, typeCount);

  // 8. Convert to compact CandidateProduct format (only essential fields for LLM)
  const candidates: CandidateProduct[] = diversified.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    product_type: p.product_type,
    price_usd: parseFloat(String(p.price_usd)),
    active_ingredients: p.active_ingredients,
    merchants: p.merchants,
    // Removed dupe_group_id and product_link to reduce payload size
  }));

  return { candidates, userProfile, traits };
}

// ============================================================================
// LLM RERANKING
// ============================================================================

/**
 * Rerank candidate products using OpenAI
 *
 * @param input - Structured input for LLM (user profile, traits, candidates)
 * @returns Ranked output from LLM (validated against schema)
 */
export async function rankWithOpenAI(input: LLMRankInput): Promise<LLMRankOutput> {
  console.log(`[Service] Sending ${input.candidate_products.length} candidates to OpenAI for reranking`);

  const result = await rerankProducts(input);

  console.log(`[Service] OpenAI returned ${result.items.length} ranked items (confidence: ${result.confidence})`);

  return result;
}

// ============================================================================
// OUTPUT TRANSFORMATION
// ============================================================================

/**
 * Transform LLM ranked output to Recommendation[] format
 *
 * Maps LLM product_id selections back to full product data and applies:
 * - Dupe logic for retail_usd (if product has dupe_group_id, find highest price in group)
 * - Vendor selection from LLM choice
 * - Concern tags derived from matched traits AND user's stated skin concerns
 *
 * @param ranked - LLM output with product_id rankings
 * @param productsById - Map of product ID to full ProductRow
 * @param traits - Detected skin traits for generating concern tags
 * @param userProfile - User profile with skin concerns from onboarding
 * @param supabase - Supabase client for database queries
 * @returns Array of Recommendation objects
 */
export async function toRecommendations(
  ranked: LLMRankOutput,
  productsById: Map<string, ProductRow>,
  traits: SkinTrait[],
  userProfile: UserProfile,
  supabase: SupabaseClient
): Promise<RecommendationOutput[]> {
  const recommendations: RecommendationOutput[] = [];

  // Build dupe group price map (for retail_usd calculation)
  const dupeGroupMaxPrices: Map<string, number> = new Map();

  for (const product of productsById.values()) {
    if (product.dupe_group_id) {
      const currentMax = dupeGroupMaxPrices.get(product.dupe_group_id) || 0;
      const price = parseFloat(String(product.price_usd));
      if (price > currentMax) {
        dupeGroupMaxPrices.set(product.dupe_group_id, price);
      }
    }
  }

  // If we have dupe groups but need to fetch more products for retail prices
  const dupeGroupIds = Array.from(dupeGroupMaxPrices.keys());
  if (dupeGroupIds.length > 0) {
    // Fetch all products in these dupe groups to ensure we have max price
    const { data: dupeProducts } = await supabase
      .from('products')
      .select('dupe_group_id, price_usd')
      .in('dupe_group_id', dupeGroupIds)
      .eq('is_active', true);

    if (dupeProducts) {
      for (const dp of dupeProducts) {
        if (dp.dupe_group_id) {
          const currentMax = dupeGroupMaxPrices.get(dp.dupe_group_id) || 0;
          const price = parseFloat(String(dp.price_usd));
          if (price > currentMax) {
            dupeGroupMaxPrices.set(dp.dupe_group_id, price);
          }
        }
      }
    }
  }

  // Transform each ranked item
  for (const item of ranked.items) {
    const product = productsById.get(item.product_id);

    if (!product) {
      console.warn(`[Service] Product not found for ID: ${item.product_id}`);
      continue;
    }

    const price = parseFloat(String(product.price_usd));
    let retail = price;

    // If product has dupe_group_id, use highest price in group as retail
    if (product.dupe_group_id) {
      const maxPrice = dupeGroupMaxPrices.get(product.dupe_group_id);
      if (maxPrice && maxPrice > price) {
        retail = maxPrice;
      }
    }

    // Derive concern tags by matching product ingredients to user's specific concerns
    const concernTagsSet = new Set<string>();
    
    // Build a set of user's actual concerns (from both detected traits and stated concerns)
    const userConcerns = new Set<string>();
    
    // Add high/moderate severity detected traits
    for (const trait of traits) {
      if (trait.severity === 'high' || trait.severity === 'moderate') {
        userConcerns.add(trait.id.toLowerCase().replace(/[_\s]+/g, '-'));
      }
    }
    
    // Add user's stated skin concerns from onboarding
    for (const concern of userProfile.skin_concerns) {
      const normalized = concern.toLowerCase().replace(/[_\s]+/g, '-');
      userConcerns.add(normalized);
    }
    
    // Match product's active ingredients to concerns it can address
    // Only include concerns that: (1) the user has AND (2) this product can treat
    for (const userConcern of userConcerns) {
      // Get the active ingredients that treat this concern
      const treatingActives = TRAIT_ACTIVE_MAP[userConcern] || [];
      
      // Check if this product has any of those actives
      const productHasRelevantActive = product.active_ingredients.some((productActive) =>
        treatingActives.some((treatingActive) =>
          productActive.toLowerCase().includes(treatingActive.toLowerCase())
        )
      );
      
      // If product can treat this concern, add it to the tags
      if (productHasRelevantActive) {
        concernTagsSet.add(userConcern);
      }
    }
    
    const concernTags = Array.from(concernTagsSet);

    // Validate vendor selection
    let vendor: (typeof VALID_VENDORS)[number] = 'amazon'; // default
    const normalizedVendor = item.selected_vendor.toLowerCase();
    if (VALID_VENDORS.includes(normalizedVendor as any)) {
      vendor = normalizedVendor as (typeof VALID_VENDORS)[number];
    } else if (product.merchants.length > 0) {
      // Fallback to first available merchant
      const firstMerchant = product.merchants[0].toLowerCase();
      if (VALID_VENDORS.includes(firstMerchant as any)) {
        vendor = firstMerchant as (typeof VALID_VENDORS)[number];
      }
    }

    // Build URL (use product_link if available, otherwise construct generic)
    let url = product.product_link || '';
    if (!url) {
      // Fallback URL construction
      const encodedName = encodeURIComponent(product.name);
      if (vendor === 'amazon') {
        url = `https://www.amazon.com/s?k=${encodedName}`;
      } else if (vendor === 'sephora') {
        url = `https://www.sephora.com/search?keyword=${encodedName}`;
      } else if (vendor === 'yesstyle') {
        url = `https://www.yesstyle.com/en/search.html?q=${encodedName}`;
      }
    }

    recommendations.push({
      id: product.id,
      name: product.name,
      concern_tags: concernTags,
      key_ingredients: product.active_ingredients,
      price_usd: price,
      retail_usd: retail,
      vendor,
      url,
    });
  }

  return recommendations;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Generate product recommendations for a user
 *
 * Main entry point that orchestrates:
 * 1. Build candidate pool (SQL filters + diversification)
 * 2. Rerank with OpenAI (compact payload, deterministic)
 * 3. Transform to Recommendation[] output
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - User UUID
 * @param analysisId - Optional specific analysis ID
 * @returns Array of recommendations
 */
export async function generateRecommendations(
  supabase: SupabaseClient,
  userId: string,
  analysisId?: string
): Promise<RecommendationOutput[]> {
  console.log(`[Service] Generating recommendations for user: ${userId}`);

  // 1. Build candidate pool
  const { candidates, userProfile, traits } = await buildCandidatePool(supabase, userId, analysisId);

  if (candidates.length === 0) {
    console.warn('[Service] No candidates found - returning empty recommendations');
    return [];
  }

  // 2. Prepare LLM input
  const llmInput: LLMRankInput = {
    user_profile: {
      skin_concerns: userProfile.skin_concerns,
      skin_goals: userProfile.skin_goals,
      ingredients_to_avoid: userProfile.ingredients_to_avoid,
      budget_min_usd: userProfile.budget_min_usd,
      budget_max_usd: userProfile.budget_max_usd,
    },
    detected_traits: traits.map((t) => ({
      name: t.name,
      severity: t.severity,
    })),
    candidate_products: candidates,
    instructions: {
      return_count_min: 8,
      return_count_max: 12,
      required_steps: ['Cleanser', 'Treatment', 'Moisturizer', 'Sunscreen'],
    },
  };

  // 3. Rerank with OpenAI
  const ranked = await rankWithOpenAI(llmInput);

  // 4. Build product lookup map
  const productsById = new Map<string, ProductRow>();
  const productIds = candidates.map((c) => c.id);

  const { data: fullProducts, error } = await supabase
    .from('products')
    .select('id, name, brand, product_type, price_usd, merchants, active_ingredients, all_ingredients, product_link, image_url, dupe_group_id, is_active')
    .in('id', productIds);

  if (error) {
    console.error('[Service] Failed to fetch full product details:', error);
    throw new Error('Failed to retrieve product details');
  }

  for (const product of fullProducts || []) {
    productsById.set(product.id, product as ProductRow);
  }

  // 5. Transform to Recommendation[] output
  const recommendations = await toRecommendations(ranked, productsById, traits, userProfile, supabase);

  console.log(`[Service] Generated ${recommendations.length} final recommendations`);

  return recommendations;
}


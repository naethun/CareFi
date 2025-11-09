import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ok, badRequest, unauthorized, internalServerError } from '@/lib/http/response';
import { RecommendationsRequestSchema } from '@/lib/recommendations/schema';
import { generateRecommendations } from '@/lib/recommendations/service';

/**
 * POST /api/recommendations
 *
 * Generates personalized product recommendations using:
 * - Latest skin analysis (detected traits + confidence)
 * - User onboarding data (concerns, goals, budget, allergies)
 * - OpenAI-powered intelligent reranking
 *
 * Request body (JSON):
 * {
 *   "userId": "uuid" (optional, inferred from session),
 *   "analysisId": "uuid" (optional, uses latest if not provided)
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "recommendations": [
 *       {
 *         "id": "uuid",
 *         "name": "Product Name",
 *         "concern_tags": ["acne", "oily"],
 *         "key_ingredients": ["Niacinamide", "Salicylic Acid"],
 *         "price_usd": 24.99,
 *         "retail_usd": 29.99,
 *         "vendor": "amazon",
 *         "url": "https://..."
 *       }
 *     ]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized('Authentication required');
    }

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const parseResult = RecommendationsRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return badRequest('Invalid request format', parseResult.error.errors);
    }

    const { userId, analysisId } = parseResult.data;

    // 3. Resolve userId (use from body or session)
    const targetUserId = userId || user.id;

    // 4. Security: Ensure user can only access their own data
    if (targetUserId !== user.id) {
      return unauthorized('Cannot access recommendations for another user');
    }

    console.log(`[API] Generating recommendations for user: ${targetUserId}`);

    // 5. Generate recommendations
    const recommendations = await generateRecommendations(supabase, targetUserId, analysisId);

    console.log(`[API] Successfully generated ${recommendations.length} recommendations`);

    // 6. Return standardized success response
    return ok({ recommendations });
  } catch (error: any) {
    console.error('[API] /api/recommendations error:', error);

    // Handle specific error types
    if (error.message?.includes('not found')) {
      return badRequest(error.message);
    }

    if (error.name === 'RerankError' || error.name === 'VisionAnalysisError') {
      return internalServerError('AI service error: ' + error.message);
    }

    return internalServerError('Failed to generate recommendations');
  }
}

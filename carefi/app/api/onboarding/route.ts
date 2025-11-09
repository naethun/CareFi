/**
 * POST /api/onboarding
 *
 * Save onboarding data for an authenticated user.
 *
 * This endpoint:
 * 1. Verifies the user is authenticated via session cookies
 * 2. Validates the request body (concerns, goals, routine, irritants, budget)
 * 3. Verifies the user exists in the database
 * 4. Saves onboarding data to the onboarding_data table
 * 5. Updates user profile to mark onboarding as completed
 * 6. Returns the saved onboarding data
 *
 * Authentication:
 * - User must be authenticated via session cookies (set during signup/login)
 * - User ID is obtained from the authenticated session, not from request body
 *
 * Request Body:
 * {
 *   "concerns": ["Acne", "Dryness"],
 *   "goals": ["Clear skin", "Hydration"],
 *   "currentRoutine": "I use a cleanser and moisturizer",
 *   "irritants": "Fragrance, alcohol",
 *   "budgetMin": "20",
 *   "budgetMax": "100"
 * }
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "userId": "uuid",
 *     "concerns": ["Acne", "Dryness"],
 *     "goals": ["Clear skin", "Hydration"],
 *     "currentRoutine": "I use a cleanser and moisturizer",
 *     "ingredientsToAvoid": "Fragrance, alcohol",
 *     "budgetMin": 20,
 *     "budgetMax": 100,
 *     "createdAt": "2024-01-01T00:00:00Z",
 *     "updatedAt": "2024-01-01T00:00:00Z"
 *   }
 * }
 *
 * Error Responses:
 * - 400: Invalid input (validation errors)
 * - 401: Not authenticated (no valid session)
 * - 404: User not found
 * - 409: Onboarding data already exists (will update instead)
 * - 500: Server error
 *
 * Example cURL:
 * ```bash
 * curl -X POST http://localhost:3000/api/onboarding \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: sb-<project>-auth-token=<session-token>" \
 *   -d '{
 *     "concerns": ["Acne", "Dryness"],
 *     "goals": ["Clear skin", "Hydration"],
 *     "currentRoutine": "I use a cleanser and moisturizer",
 *     "irritants": "Fragrance, alcohol",
 *     "budgetMin": "20",
 *     "budgetMax": "100"
 *   }'
 * ```
 *
 * Security:
 * - Requires authenticated session (session cookies)
 * - Enforces 1MB request size limit
 * - Validates all input data
 * - Verifies user exists before saving data
 * - Uses admin client to bypass RLS for data insertion
 */

import { createPostHandler } from '@/lib/http/handler';
import { ok } from '@/lib/http/response';
import { onboardingSchema } from '@/lib/validation/onboarding';
import { saveOnboardingData } from '@/lib/onboarding/service';
import { createServerClient } from '@/lib/supabase/server';
import { UnauthorizedError, ErrorCodes } from '@/lib/http/errors';

/**
 * Force dynamic rendering for this route
 * Prevents Next.js from statically optimizing this API route
 */
export const dynamic = 'force-dynamic';

/**
 * POST /api/onboarding handler
 *
 * The createPostHandler wrapper provides:
 * - Method enforcement (only POST allowed)
 * - JSON body parsing with size limit (1MB)
 * - Zod schema validation
 * - Automatic error handling and response formatting
 * - Request ID generation for tracing
 */
export const POST = createPostHandler(
  onboardingSchema,
  async (req, body) => {
    console.log('🚀 [ONBOARDING] Starting onboarding data save...');

    // Step 1: Get authenticated user from session cookies
    // This follows the AUTH_ARCHITECTURE.md pattern
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('❌ [ONBOARDING] Not authenticated:', authError?.message);
      throw new UnauthorizedError(
        'Authentication required. Please sign in to continue.',
        ErrorCodes.MISSING_CREDENTIALS
      );
    }

    console.log('✅ [ONBOARDING] User authenticated:', {
      userId: user.id,
      email: user.email,
    });

    // Step 2: Save onboarding data
    // This function handles:
    // - Verifying user exists
    // - Inserting or updating onboarding data
    // - Updating user profile to mark onboarding as completed
    const data = await saveOnboardingData(user.id, body);

    console.log('✨ [ONBOARDING] Onboarding data saved successfully:', {
      onboardingId: data.id,
      userId: data.userId,
      concernsCount: data.concerns.length,
      goalsCount: data.goals.length,
    });

    // Return saved data
    return ok(data);
  }
);


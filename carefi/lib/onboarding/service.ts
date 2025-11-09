/**
 * Onboarding Service Layer
 *
 * Pure business logic functions for onboarding data management.
 * These functions are framework-agnostic and can be tested independently.
 *
 * Responsibilities:
 * - Saving onboarding data to the database
 * - Verifying user exists before saving
 * - Updating user profile to mark onboarding as completed
 * - Handling upsert logic (insert or update)
 *
 * IMPORTANT: This module uses the Supabase admin client
 * Only call these functions from server-side code (API routes, server actions)
 */

import { createAdminClient } from '@/lib/supabase/server';
import { NotFoundError, InternalServerError, ErrorCodes } from '@/lib/http/errors';
import type { OnboardingInput } from '@/lib/validation/onboarding';
import { updateUserProfile } from '@/lib/users/service';

/**
 * Onboarding data returned after successful save
 */
export interface OnboardingData {
  id: string;
  userId: string;
  concerns: string[];
  goals: string[];
  currentRoutine: string | null;
  ingredientsToAvoid: string | null;
  budgetMin: number;
  budgetMax: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Verify that a user exists in the database
 *
 * @param {string} userId - User ID to verify
 * @throws {NotFoundError} If user doesn't exist
 */
async function verifyUserExists(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new NotFoundError('User not found', ErrorCodes.RESOURCE_NOT_FOUND);
  }
}

/**
 * Save onboarding data for a user
 *
 * This function:
 * 1. Verifies the user exists
 * 2. Inserts or updates onboarding data (upsert based on user_id unique constraint)
 * 3. Updates user profile to mark onboarding as completed
 *
 * @param {string} userId - User ID (from authenticated session)
 * @param {OnboardingInput} input - Validated onboarding data
 * @returns {Promise<OnboardingData>} Saved onboarding data
 * @throws {NotFoundError} If user doesn't exist
 * @throws {InternalServerError} If save operation fails
 *
 * @example
 * ```ts
 * const data = await saveOnboardingData(userId, {
 *   concerns: ['Acne', 'Dryness'],
 *   goals: ['Clear skin', 'Hydration'],
 *   currentRoutine: 'I use a cleanser and moisturizer',
 *   irritants: 'Fragrance, alcohol',
 *   budgetMin: 20,
 *   budgetMax: 100,
 * });
 * ```
 */
export async function saveOnboardingData(
  userId: string,
  input: OnboardingInput
): Promise<OnboardingData> {
  const admin = createAdminClient();

  // Step 1: Verify user exists
  await verifyUserExists(userId);

  // Step 2: Prepare data for database insertion
  // Map frontend field names to database column names
  const onboardingData = {
    user_id: userId,
    skin_concerns: input.concerns,
    skin_goals: input.goals,
    current_routine: input.currentRoutine || null,
    ingredients_to_avoid: input.irritants || null,
    budget_min_usd: input.budgetMin,
    budget_max_usd: input.budgetMax,
  };

  // Step 3: Upsert onboarding data
  // The unique constraint on user_id ensures only one record per user
  // If record exists, it will be updated; otherwise, it will be inserted
  const { data, error } = await admin
    .from('onboarding_data')
    .upsert(onboardingData, {
      onConflict: 'user_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save onboarding data:', error);
    throw new InternalServerError('Failed to save onboarding data');
  }

  if (!data) {
    throw new InternalServerError('Failed to save onboarding data');
  }

  // Step 4: Update user profile to mark onboarding as completed
  try {
    await updateUserProfile(userId, {
      onboardingCompleted: true,
    });
  } catch (error) {
    // Log error but don't fail the request
    // The onboarding data is already saved
    console.error('Failed to update user profile onboarding status:', error);
  }

  // Step 5: Map database response to return type
  return {
    id: data.id,
    userId: data.user_id,
    concerns: data.skin_concerns || [],
    goals: data.skin_goals || [],
    currentRoutine: data.current_routine,
    ingredientsToAvoid: data.ingredients_to_avoid,
    budgetMin: parseFloat(data.budget_min_usd.toString()),
    budgetMax: parseFloat(data.budget_max_usd.toString()),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}


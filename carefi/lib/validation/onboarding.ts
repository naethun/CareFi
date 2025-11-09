/**
 * Onboarding Validation Schemas
 *
 * Zod schemas for validating onboarding-related requests.
 * Provides type-safe validation with detailed error messages.
 *
 * Validation Rules:
 * - Concerns: Array of strings, at least 1 required
 * - Goals: Array of strings, at least 1 required
 * - Current Routine: Optional text field
 * - Ingredients to Avoid: Optional text field
 * - Budget Min: Required, numeric, minimum $1
 * - Budget Max: Required, numeric, must be >= budget min
 */

import { z } from 'zod';

/**
 * Onboarding request validation schema
 *
 * Validates the request body for POST /api/onboarding
 */
export const onboardingSchema = z.object({
  concerns: z
    .array(z.string().min(1, 'Concern cannot be empty'))
    .min(1, 'At least one skin concern is required'),

  goals: z
    .array(z.string().min(1, 'Goal cannot be empty'))
    .min(1, 'At least one skin goal is required'),

  currentRoutine: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null), // Convert empty string to null

  irritants: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null), // Convert empty string to null

  budgetMin: z
    .string()
    .min(1, 'Minimum budget is required')
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 1;
      },
      { message: 'Minimum budget must be at least $1' }
    )
    .transform((val) => parseFloat(val)), // Convert to number

  budgetMax: z
    .string()
    .min(1, 'Maximum budget is required')
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 1;
      },
      { message: 'Maximum budget must be at least $1' }
    )
    .transform((val) => parseFloat(val)), // Convert to number
}).refine(
  (data) => data.budgetMin <= data.budgetMax,
  {
    message: 'Minimum budget cannot exceed maximum budget',
    path: ['budgetMin'], // Attach error to budgetMin field
  }
);

/**
 * Inferred TypeScript type from onboarding schema
 *
 * Use this type for type-safe access to validated onboarding data
 *
 * @example
 * ```ts
 * const input: OnboardingInput = {
 *   concerns: ['Acne', 'Dryness'],
 *   goals: ['Clear skin', 'Hydration'],
 *   currentRoutine: 'I use a cleanser and moisturizer',
 *   irritants: 'Fragrance, alcohol',
 *   budgetMin: 20,
 *   budgetMax: 100,
 * };
 * ```
 */
export type OnboardingInput = z.infer<typeof onboardingSchema>;


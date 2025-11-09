/**
 * OpenAI Vision Integration
 *
 * Provides client configuration, Zod schemas, and API call logic
 * for analyzing skin images using OpenAI's Vision API.
 *
 * IMPORTANT: Only use on the server side (API routes, server actions)
 * Never import this in client components as it requires the API key.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '@/lib/env';

/**
 * OpenAI client instance
 * Configured with API key from environment variables
 */
export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Vision model to use for analysis
 * Defaults to gpt-4o-mini for cost efficiency
 */
export const VISION_MODEL = env.OPENAI_VISION_MODEL;

/**
 * Schema for a single skin trait detected in the analysis
 */
export const SkinTraitSchema = z.object({
  id: z.string().min(1).describe('Kebab-case identifier (e.g., "acne", "dryness")'),
  name: z.string().min(1).describe('Human-readable label'),
  severity: z.enum(['low', 'moderate', 'high']).describe('Severity level'),
  description: z.string().min(1).describe('User-friendly description of the trait'),
});

export type SkinTrait = z.infer<typeof SkinTraitSchema>;

/**
 * Schema for the complete vision analysis response
 * This validates the JSON returned by OpenAI
 */
export const VisionAnalysisSchema = z.object({
  skinType: z.enum(['Dry', 'Oily', 'Combination', 'Normal', 'Sensitive']).describe('Overall skin type classification'),
  confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
  primaryConcern: z.string().min(1).describe('Main skin concern identified'),
  traits: z.array(SkinTraitSchema).min(1).describe('Array of detected skin traits'),
  notes: z.array(z.string()).default([]).describe('Additional observations and recommendations'),
  modelVersion: z.string().min(1).describe('Model identifier for tracking'),
});

export type VisionAnalysis = z.infer<typeof VisionAnalysisSchema>;

/**
 * Build the system prompt for OpenAI Vision
 *
 * Instructs the model to:
 * - Analyze skin for specific traits
 * - Return strict JSON matching VisionAnalysisSchema
 * - Consider all three image angles jointly
 * - Rate severities consistently
 * - Provide user-friendly notes
 *
 * @returns System prompt string
 */
export function buildVisionPrompt(): string {
  return `You are a dermatologist assistant specializing in skin analysis. Given three facial images (front view, left 45° view, right 45° view), perform a comprehensive skin analysis.

ANALYSIS REQUIREMENTS:
1. Determine the overall skin type: Dry, Oily, Combination, Normal, or Sensitive
2. Estimate confidence in your analysis (0-100 scale)
3. Identify the primary concern (most prominent issue)
4. Detect and rate the following skin traits:
   - acne: Active breakouts, comedones, or acne-prone areas
   - dryness: Dry patches, flakiness, or dehydrated appearance
   - oiliness: Excess sebum, shine, or enlarged pores from oil
   - sensitivity: Redness, reactivity, or inflammation signs
   - hyperpigmentation: Dark spots, melasma, or uneven tone
   - fine-lines: Early wrinkles, expression lines, or age signs
   - redness: General redness, rosacea, or irritation
   - large-pores: Visibly enlarged pores

SEVERITY RATINGS:
- low: Minimal presence, barely noticeable
- moderate: Clearly visible, affecting some areas
- high: Prominent, widespread, or severe

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema (no additional text):
{
  "skinType": "Dry" | "Oily" | "Combination" | "Normal" | "Sensitive",
  "confidence": <number 0-100>,
  "primaryConcern": "<string>",
  "traits": [
    {
      "id": "<kebab-case-id>",
      "name": "<Human Name>",
      "severity": "low" | "moderate" | "high",
      "description": "<Brief user-friendly description>"
    }
  ],
  "notes": [
    "<Observation or recommendation>"
  ],
  "modelVersion": "${VISION_MODEL}"
}

IMPORTANT GUIDELINES:
- Consider all three image angles together for a complete assessment
- Only include traits that are actually present (at least at low severity)
- Keep descriptions concise and user-friendly (avoid medical jargon)
- Provide 2-4 actionable notes about skincare recommendations
- Return ONLY the JSON object, no markdown formatting or extra text`;
}

/**
 * Error class for OpenAI Vision API failures
 */
export class VisionAnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'VisionAnalysisError';
  }
}

/**
 * Retry configuration for API calls
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Calculate exponential backoff delay with jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * Determine if an error is retryable
 *
 * @param error - Error from OpenAI API
 * @returns True if the error warrants a retry
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    // Retry on rate limits and server errors
    return error.status === 429 || (error.status >= 500 && error.status < 600);
  }
  return false;
}

/**
 * Build the system prompt for OpenAI product reranking
 *
 * Instructs the model to:
 * - Select 8-12 products that best fit user's skin profile
 * - Prioritize evidence-based actives matched to concerns
 * - Exclude products with avoided ingredients
 * - Ensure price is within budget
 * - Diversify across routine steps (Cleanser, Treatment, Moisturizer, Sunscreen)
 * - Return strict JSON matching schema
 *
 * @returns System prompt string
 */
export function buildRerankPrompt(): string {
  return `You are a clinical, deterministic product reranker for skincare. Your job is to select and order products that best fit the user's detected skin traits, stated goals, allergies, and budget.

RULES:
- Prefer evidence-backed active ingredients matched to concerns.
- Exclude any product containing avoided ingredients.
- Ensure prices are within budget range.
- Diversify across routine steps (at least: Cleanser, Treatment/Serum, Moisturizer, Sunscreen).
- Select between 8-12 products total.
- Return EXACTLY the JSON structure shown below, no extra keys, no prose.
- Temperature = 0. Be consistent and repeatable.

REQUIRED OUTPUT FORMAT (JSON only):
{
  "items": [
    {
      "product_id": "uuid-string-from-candidate-list",
      "score": 0.95,
      "reason": "Matches acne concerns with Salicylic Acid",
      "step": "Cleanser",
      "selected_vendor": "Amazon"
    }
  ],
  "confidence": 85
}

FIELD REQUIREMENTS:
- "items": Array of 8-12 ranked products (REQUIRED)
  - "product_id": Must match an ID from candidate_products (REQUIRED, string)
  - "score": Relevance score 0.0-1.0 (REQUIRED, number)
  - "reason": Brief rationale under 20 words (REQUIRED, string)
  - "step": Product category: "Cleanser", "Treatment", "Moisturizer", "Sunscreen", "Toner", "Serum", "Eye Cream", or "Mask" (REQUIRED, string)
  - "selected_vendor": Merchant name from the product's merchants array (REQUIRED, string)
- "confidence": Overall confidence score 0-100 (REQUIRED, number)

Return ONLY valid JSON matching this exact structure. Do not include markdown, explanations, or any text outside the JSON object.`;
}

/**
 * Schema for LLM rerank input (imported from recommendations schema)
 */
import type { LLMRankInput, LLMRankOutput } from '@/lib/recommendations/schema';
import { LLMRankOutputSchema } from '@/lib/recommendations/schema';

/**
 * Error class for OpenAI reranking failures
 */
export class RerankError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'RerankError';
  }
}

/**
 * Call OpenAI to rerank products
 *
 * Sends compact product candidate list to OpenAI for intelligent reranking.
 * Implements exponential backoff with jitter for rate limits and server errors.
 * Validates response against LLMRankOutputSchema.
 *
 * @param input - Structured input with user profile, traits, and candidates
 * @returns Validated LLM ranking output
 * @throws RerankError on validation or API failures
 */
export async function rerankProducts(input: LLMRankInput): Promise<LLMRankOutput> {
  let lastError: unknown;

  // Retry loop (same config as vision)
  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      // Add delay for retries
      if (attempt > 0) {
        const delay = getRetryDelay(attempt - 1);
        console.log(`[OpenAI] Retry attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      console.log(`[OpenAI] Calling rerank API (attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts})`);

      // Limit candidate payload to avoid excessive tokens (keep top 25 for speed)
      const limitedInput = {
        ...input,
        candidate_products: input.candidate_products.slice(0, 25),
      };

      // Build user message with compact JSON (no indentation to reduce size)
      const userMessage = JSON.stringify(limitedInput);

      console.log(`[OpenAI] Rerank payload size: ${userMessage.length} chars, ${limitedInput.candidate_products.length} candidates`);

      // Call OpenAI Chat Completions API
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast, cost-efficient model
        messages: [
          {
            role: 'system',
            content: buildRerankPrompt(),
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        max_tokens: 1500, // Reduced from 2000 for faster generation
        temperature: 0, // Deterministic
        response_format: { type: 'json_object' }, // Ensure JSON response
      });

      // Extract response content
      const content_text = response.choices[0]?.message?.content;
      if (!content_text) {
        throw new RerankError('OpenAI returned empty response', undefined, true);
      }

      console.log(`[OpenAI] Received rerank response (${content_text.length} chars)`);

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(content_text);
      } catch (parseError) {
        console.error('[OpenAI] Failed to parse JSON. Raw response:', content_text.substring(0, 500));
        throw new RerankError('OpenAI response is not valid JSON', parseError, false);
      }

      // Log parsed structure for debugging
      console.log('[OpenAI] Parsed response structure:', {
        hasItems: 'items' in (parsed as any),
        itemsType: typeof (parsed as any).items,
        itemsLength: Array.isArray((parsed as any).items) ? (parsed as any).items.length : 'not an array',
        hasConfidence: 'confidence' in (parsed as any),
        confidenceType: typeof (parsed as any).confidence,
        topLevelKeys: Object.keys(parsed as any),
      });

      // Try to normalize response structure if OpenAI used different field names
      let normalizedResponse = parsed as any;
      
      // Handle case where OpenAI might wrap in extra layer or use different names
      if (!normalizedResponse.items && !normalizedResponse.confidence) {
        // Check for common variations
        if (normalizedResponse.recommendations && !normalizedResponse.items) {
          normalizedResponse.items = normalizedResponse.recommendations;
        }
        if (normalizedResponse.ranked_products && !normalizedResponse.items) {
          normalizedResponse.items = normalizedResponse.ranked_products;
        }
        if (normalizedResponse.products && !normalizedResponse.items) {
          normalizedResponse.items = normalizedResponse.products;
        }
        if (normalizedResponse.overall_confidence && !normalizedResponse.confidence) {
          normalizedResponse.confidence = normalizedResponse.overall_confidence;
        }
        if (normalizedResponse.confidence_score && !normalizedResponse.confidence) {
          normalizedResponse.confidence = normalizedResponse.confidence_score;
        }
      }

      // Validate against schema
      const validationResult = LLMRankOutputSchema.safeParse(normalizedResponse);
      if (!validationResult.success) {
        console.error('[OpenAI] Rerank schema validation failed:', JSON.stringify(validationResult.error.errors, null, 2));
        console.error('[OpenAI] Actual response received:', JSON.stringify(parsed, null, 2).substring(0, 1000));
        throw new RerankError(
          'OpenAI response does not match expected schema',
          validationResult.error,
          false
        );
      }

      console.log(`[OpenAI] Rerank complete:`, {
        itemCount: validationResult.data.items.length,
        confidence: validationResult.data.confidence,
      });

      return validationResult.data;
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (error instanceof RerankError && !error.retryable) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt === RETRY_CONFIG.maxAttempts - 1) {
        break;
      }

      // Check if we should retry
      if (!isRetryableError(error)) {
        throw error;
      }

      console.warn(`[OpenAI] Retryable error on attempt ${attempt + 1}:`, error);
    }
  }

  // All retries exhausted
  throw new RerankError(
    `OpenAI rerank API failed after ${RETRY_CONFIG.maxAttempts} attempts`,
    lastError,
    false
  );
}

/**
 * Call OpenAI Vision API with retry logic
 *
 * Sends three image URLs to OpenAI Vision for skin analysis.
 * Implements exponential backoff with jitter for rate limits and server errors.
 * Validates response against VisionAnalysisSchema.
 *
 * @param imageUrls - Array of signed URLs (must be exactly 3)
 * @returns Parsed and validated VisionAnalysis object
 * @throws VisionAnalysisError on validation or API failures
 */
export async function callVision(imageUrls: string[]): Promise<VisionAnalysis> {
  // Validate input
  if (imageUrls.length !== 3) {
    throw new VisionAnalysisError(
      `Expected exactly 3 image URLs, received ${imageUrls.length}`,
      undefined,
      false
    );
  }

  // Check for valid URLs
  for (const url of imageUrls) {
    try {
      new URL(url);
    } catch {
      throw new VisionAnalysisError(
        `Invalid image URL: ${url.substring(0, 50)}...`,
        undefined,
        false
      );
    }
  }

  let lastError: unknown;

  // Retry loop
  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      // Add delay for retries
      if (attempt > 0) {
        const delay = getRetryDelay(attempt - 1);
        console.log(`[OpenAI] Retry attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      console.log(`[OpenAI] Calling Vision API (attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts})`);
      console.log(`[OpenAI] Model: ${VISION_MODEL}`);

      // Build message content with text instruction + 3 images
      const content: OpenAI.Chat.ChatCompletionContentPart[] = [
        {
          type: 'text',
          text: buildVisionPrompt(),
        },
        ...imageUrls.map((url) => ({
          type: 'image_url' as const,
          image_url: {
            url,
            detail: 'high' as const, // Use high detail for better analysis
          },
        })),
      ];

      // Call OpenAI Chat Completions API with vision
      const response = await openai.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3, // Lower temperature for more consistent analysis
        response_format: { type: 'json_object' }, // Ensure JSON response
      });

      // Extract response content
      const content_text = response.choices[0]?.message?.content;
      if (!content_text) {
        throw new VisionAnalysisError(
          'OpenAI returned empty response',
          undefined,
          true
        );
      }

      console.log(`[OpenAI] Received response (${content_text.length} chars)`);

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(content_text);
      } catch (parseError) {
        throw new VisionAnalysisError(
          'OpenAI response is not valid JSON',
          parseError,
          false
        );
      }

      // Validate against schema
      const validationResult = VisionAnalysisSchema.safeParse(parsed);
      if (!validationResult.success) {
        console.error('[OpenAI] Schema validation failed:', validationResult.error.errors);
        throw new VisionAnalysisError(
          'OpenAI response does not match expected schema',
          validationResult.error,
          false
        );
      }

      console.log(`[OpenAI] Analysis complete:`, {
        skinType: validationResult.data.skinType,
        confidence: validationResult.data.confidence,
        traitsCount: validationResult.data.traits.length,
      });

      return validationResult.data;
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (error instanceof VisionAnalysisError && !error.retryable) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt === RETRY_CONFIG.maxAttempts - 1) {
        break;
      }

      // Check if we should retry
      if (!isRetryableError(error)) {
        throw error;
      }

      console.warn(`[OpenAI] Retryable error on attempt ${attempt + 1}:`, error);
    }
  }

  // All retries exhausted
  throw new VisionAnalysisError(
    `OpenAI Vision API failed after ${RETRY_CONFIG.maxAttempts} attempts`,
    lastError,
    false
  );
}

import { z } from 'zod'

/**
 * Optional numeric form field.
 *
 * `z.coerce.number().optional()` is a trap with react-hook-form: an untouched
 * input arrives as '' (empty string), which coerce turns into 0 rather than
 * leaving it undefined — so blank fields silently save as 0. This wraps the
 * number schema in a preprocess step that maps blank/NaN inputs to undefined
 * first, so `?? null` on submit correctly yields null for empty fields.
 */
export const optionalNumber = (inner: z.ZodNumber) =>
  z.preprocess(
    v => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    inner.optional()
  )

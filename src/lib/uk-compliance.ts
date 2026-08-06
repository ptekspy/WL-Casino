/**
 * UK Gambling Commission requirements this site follows, even as a fake-money
 * prototype:
 *
 * - Remote gambling and software technical standards (2021): a minimum 2.5s
 *   floor between the start of one round and being able to start the next,
 *   and no autoplay — every spin needs an active button press (autoplay was
 *   removed outright rather than modelled here; see wildwood-game.tsx).
 * - Online slots stake limits (live since April/May 2025): £5 max stake for
 *   players 25 and over, £2 max stake for 18-24 year olds, on every
 *   UK-licensed online slot.
 */

/** Minimum time (ms) between the start of one round and being able to start the next. */
export const MIN_ROUND_MS = 2500;

export const MIN_PLAYER_AGE = 18;

/** Stake cap (mirrors £) for players aged 18-24. */
export const YOUNG_ADULT_MAX_STAKE = 2;

/** Stake cap (mirrors £) for players 25 and over. */
export const ADULT_MAX_STAKE = 5;

/** Whole-years age as of today, from an ISO date-of-birth string. */
export function ageFromDateOfBirth(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/** 0 if under the minimum play age, otherwise the UK age-banded stake cap. */
export function maxStakeForAge(age: number): number {
  if (age < MIN_PLAYER_AGE) return 0;
  if (age < 25) return YOUNG_ADULT_MAX_STAKE;
  return ADULT_MAX_STAKE;
}

/** 0 when there's no usable date of birth on file (also covers under-18). */
export function maxStakeForDateOfBirth(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 0;
  return maxStakeForAge(ageFromDateOfBirth(dateOfBirth));
}

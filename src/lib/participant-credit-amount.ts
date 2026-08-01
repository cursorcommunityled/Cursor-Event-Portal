/** Participant Cursor credit amount (USD) by event slug. Default is $20. */
export function participantCreditAmountForSlug(slug: string | null | undefined): number {
  if (slug === "cafe-cursor-calgary-aug-2026") return 50;
  return 20;
}

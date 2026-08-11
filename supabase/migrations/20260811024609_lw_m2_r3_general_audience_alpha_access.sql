-- LW-M2-R3 owner policy correction. The previous migration is already live
-- and remains immutable. This removes only its runtime adult-confirmation
-- coupling; the allowlist continues to gate controlled DEV rollout, abuse,
-- and provider cost.

alter table public.alpha_generation_access
  drop constraint if exists alpha_generation_access_enabled_requires_adult;

comment on table public.alpha_generation_access is
  'Controlled DEV generation allowlist for rollout, abuse, and cost protection. Not an age-verification table. GENERAL_AUDIENCE_13_PLUS; MINOR_GUARDIAN_CONSENT_REQUIRED; PRODUCTION_POLICY_REVIEW_REQUIRED.';

comment on column public.alpha_generation_access.adult_confirmed_at is
  'Deprecated and ignored by runtime authorization after LW-M2-R3 policy correction. Retained temporarily to avoid unnecessary schema churn; not verified identity or consent.';

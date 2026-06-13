-- Phase 1 actions — analysis_lenses lookup (design doc §5.5).
-- Lenses are editable DATA (slug + prompt skeleton + grounding metadata), NOT JS constants and NOT
-- action_templates rows (those need an embedding + are the Phase-2 auto-suggest engine). The Analyze
-- route reads the chosen lens row to build its prompt (with an in-code fallback mirror for resilience).
-- 'custom' is the free-text marker: its skeleton interpolates {{custom_lens}} from the click payload.
-- Additive (new table) + non-destructive. Grants restored per lesson #96.

create table if not exists public.analysis_lenses (
  slug               text primary key,
  display_name       text not null,
  description        text not null,
  prompt_skeleton    text not null,
  hallucination_risk text not null default 'low'
                     check (hallucination_risk in ('low', 'medium', 'high')),
  grounding_rule     text not null,
  sort_order         integer not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

comment on table public.analysis_lenses is
  'Phase 1: editable catalog of Analyze lenses. Lenses-as-data (Rule 55). custom = free-text marker; {{custom_lens}} is interpolated server-side.';

-- Lookup/reference data: every signed-in user may read; nobody writes via the app (seed/admin only).
alter table public.analysis_lenses enable row level security;

drop policy if exists analysis_lenses_read on public.analysis_lenses;
create policy analysis_lenses_read
  on public.analysis_lenses
  for select
  to authenticated
  using (true);

grant select on public.analysis_lenses to anon, authenticated, service_role;

insert into public.analysis_lenses
  (slug, display_name, description, prompt_skeleton, hallucination_risk, grounding_rule, sort_order)
values
  ('key_facts', 'Key Facts',
   'The verifiable who/what/when/where and the concrete numbers.',
   'Extract the key verifiable facts from this article: who, what, when, where, and every concrete number. List ONLY facts explicitly stated in the article. Do not infer, predict, or add context not present in the text.',
   'low', 'Every number or quote must appear verbatim in the article.', 1),

  ('market_implications', 'Market Implications',
   'What this means for investors and operators.',
   'Explain the market and financial implications of this article for investors and operators. Ground every claim strictly in what the article states. Clearly separate facts stated in the article from your own reasoning. Do not invent prices, percentages, or tickers not in the article.',
   'medium', 'Stated facts must trace to the article; mark reasoning as reasoning.', 2),

  ('political_angle', 'Political / Policy Angle',
   'The regulatory, policy, and political stakes.',
   'Analyze the political, regulatory, and policy angle of this article. Identify the actors, the stakes, and the stated positions, grounded strictly in the article. Do not attribute positions or quotes that are not in the text.',
   'medium', 'Actors, positions and quotes must come from the article.', 3),

  ('what_should_i_do', 'What Should I Do?',
   'Concrete options to consider (not advice).',
   'Given this article, outline concrete options the reader could consider. This is NOT financial, legal, or professional advice. Tie each option to a specific fact in the article. Do not promise outcomes or fabricate figures.',
   'high', 'Each option must reference a specific fact from the article.', 4),

  ('risks', 'Risks & Downsides',
   'The downsides and failure modes.',
   'Identify the risks, downsides, and failure modes implied by this article. Ground them strictly in the article. Separate risks explicitly stated in the text from risks you are inferring, and label which is which.',
   'medium', 'Stated risks must trace to the article; mark inferences.', 5),

  ('explain_simply', 'Explain Simply',
   'Plain language without losing accuracy.',
   'Explain this article in plain language a smart 15-year-old would understand, without losing accuracy. Use ONLY facts from the article. Do not add examples, numbers, or context that are not in the text.',
   'low', 'Use only facts present in the article.', 6),

  ('custom', 'Custom Lens',
   'Your own question or angle (free text).',
   'Analyze this article specifically through the following user-defined lens: "{{custom_lens}}". Stay strictly grounded in the article. If the lens asks about something the article does not cover, say so plainly rather than inventing an answer.',
   'high', 'Answer only from the article; flag anything the article does not cover.', 7)
on conflict (slug) do nothing;

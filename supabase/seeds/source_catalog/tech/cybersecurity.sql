-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — tech / cybersecurity
-- Curated by source-catalog-curator subagent on 2026-05-15
-- All URLs verified reachable + producing valid feed content
-- ════════════════════════════════════════════════════════════════════
--
-- REJECTIONS (URLs that failed verification and were excluded):
--   https://www.cisa.gov/cybersecurity-advisories/all.xml         — HTTP 403 (all CISA RSS paths blocked)
--   https://www.cisa.gov/cybersecurity-advisories/alerts.xml      — HTTP 403
--   https://www.cisa.gov/uscert/ncas/alerts.xml                   — HTTP 403
--   https://www.cisa.gov/ncas/alerts.xml                          — HTTP 403
--   https://www.cisa.gov/cybersecurity-advisories/ics-advisories.xml — HTTP 403
--   https://nvd.nist.gov/feeds/json/cve/1.1/nvdcve-1.1-recent.json.gz — HTTP 403
--   https://sophossecurity.com/news/feed/                         — ECONNREFUSED (domain not found)
--   https://www.sophos.com/blog/en-us/feed/                       — HTTP 404
--   https://www.rapid7.com/blog/rss.xml                           — HTTP 404 (correct path is /rss/)
--   https://www.rapid7.com/blog/feed/                             — HTTP 404
--   https://feeds.feedburner.com/securityintelligence             — Resolves to IBM.com HTML, not a feed
--   https://www.securityintelligence.com/feed/                    — Redirects to ibm.com (feed gone)
--   https://portswigger.net/daily-swig/rss                        — Returns HTML, no RSS endpoint found
--   https://portswigger.net/daily-swig/feed                       — Returns HTML, not a feed
--   https://www.mandiant.com/resources/blog/rss.xml               — 301 redirect handled via canonical URL below
--   labs.watchguard.com/blog/feed                                 — ECONNREFUSED

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  (
    'Krebs on Security',
    'rss',
    'https://krebsonsecurity.com/feed/',
    'Investigative cybersecurity journalism by Brian Krebs covering cybercrime, data breaches, and threat actors with deep sourcing and original reporting unavailable elsewhere.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.95,
    false,
    null,
    array['cybercrime', 'data_breaches', 'threat_actors', 'fraud', 'identity_theft', 'ransomware', 'breach_investigations']
  ),

  (
    'Schneier on Security',
    'rss',
    'https://www.schneier.com/blog/atom.xml',
    'Bruce Schneier''s long-running security blog covering cryptography, policy, surveillance, and the intersection of technology and society — authoritative primary analysis from a leading security thinker.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.93,
    false,
    null,
    array['cryptography', 'security_policy', 'surveillance', 'privacy_tech', 'security_research', 'ai_security', 'national_security']
  ),

  (
    'CISA Known Exploited Vulnerabilities Catalog',
    'custom_api',
    'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    'CISA''s authoritative JSON catalog of vulnerabilities confirmed to be actively exploited in the wild, updated daily with CVE IDs, vendor/product details, required mitigations, and compliance deadlines — the definitive prioritization signal for defenders.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.97,
    false,
    null,
    array['vulnerability_management', 'cve_tracking', 'patch_management', 'threat_intelligence', 'zero_day', 'ransomware', 'ics_security']
  ),

  (
    'SANS Internet Storm Center',
    'rss',
    'https://isc.sans.edu/rssfeed_full.xml',
    'SANS ISC publishes daily diaries from practicing security professionals analyzing live attack data, malware samples, and emerging threats — among the fastest-reacting public infosec feeds for IOCs and incident analysis.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.92,
    false,
    null,
    array['malware_analysis', 'threat_intelligence', 'incident_response', 'ioc_indicators', 'vulnerability_analysis', 'network_security', 'honeypots']
  ),

  (
    'Google Threat Intelligence Blog',
    'rss',
    'https://cloudblog.withgoogle.com/topics/threat-intelligence/rss/',
    'Google''s threat intelligence team (formerly Mandiant) publishes primary research on APT campaigns, malware families, and zero-days — direct from one of the largest incident response and threat hunting organizations in the industry.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.93,
    false,
    null,
    array['apt_groups', 'threat_intelligence', 'malware_research', 'zero_day', 'nation_state_actors', 'incident_response', 'ransomware']
  ),

  (
    'UK National Cyber Security Centre (NCSC)',
    'rss',
    'https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml',
    'Official guidance, advisories, and research from the UK''s government cybersecurity authority, covering threat assessments, technical analysis, and actionable defensive guidance for organizations of all sizes.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'weekly',
    array['eu', 'global'],
    0.91,
    false,
    null,
    array['security_advisories', 'threat_assessments', 'critical_infrastructure', 'supply_chain_security', 'ransomware', 'ai_security', 'government_security']
  ),

  (
    'The Hacker News',
    'rss',
    'https://feeds.feedburner.com/TheHackersNews',
    'High-volume cybersecurity news publication covering vulnerabilities, malware campaigns, data breaches, and APT activity — among the most widely-read infosec news feeds with consistent same-day coverage of major incidents.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.78,
    false,
    null,
    array['cybersecurity_news', 'malware', 'data_breaches', 'vulnerability_disclosures', 'apt_groups', 'phishing', 'ransomware']
  ),

  (
    'BleepingComputer',
    'rss',
    'https://www.bleepingcomputer.com/feed/',
    'Technically detailed security news site known for fast, accurate reporting on ransomware attacks, malware reverse engineering, zero-day exploits, and Windows security — strong community and original research.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.82,
    false,
    null,
    array['ransomware', 'malware', 'vulnerability_disclosures', 'zero_day', 'windows_security', 'data_breaches', 'exploit_analysis']
  ),

  (
    'SecurityWeek',
    'rss',
    'https://www.securityweek.com/feed/',
    'Enterprise-focused security news publication covering industry developments, breach disclosures, M&A activity, and vulnerability advisories with a strong emphasis on corporate risk and regulatory context.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.78,
    false,
    null,
    array['enterprise_security', 'data_breaches', 'cybersecurity_industry', 'vulnerability_management', 'compliance', 'threat_intelligence', 'ics_security']
  ),

  (
    'Dark Reading',
    'rss',
    'https://www.darkreading.com/rss.xml',
    'Long-running trade publication for security practitioners covering threat research, security operations, cloud security, and application security — mix of news, analysis, and practitioner-authored content.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.75,
    false,
    null,
    array['security_operations', 'cloud_security', 'application_security', 'threat_research', 'zero_trust', 'identity_security', 'ot_ics_security']
  ),

  (
    'Unit 42 (Palo Alto Networks)',
    'rss',
    'https://unit42.paloaltonetworks.com/feed/',
    'Primary threat research from Palo Alto Networks'' Unit 42 team — in-depth technical analysis of malware families, APT TTPs, and zero-day exploitation with IoC data and MITRE ATT&CK mappings.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'weekly',
    array['global'],
    0.88,
    false,
    null,
    array['malware_research', 'apt_groups', 'threat_intelligence', 'vulnerability_analysis', 'ioc_indicators', 'cloud_security', 'zero_day']
  ),

  (
    'Check Point Research',
    'rss',
    'https://research.checkpoint.com/feed',
    'Technical threat intelligence from Check Point''s research division, publishing detailed malware analyses, ransomware operator breakdowns, and weekly threat intelligence bulletins with quantitative attack data.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'weekly',
    array['global'],
    0.87,
    false,
    null,
    array['malware_analysis', 'ransomware', 'threat_intelligence', 'mobile_security', 'supply_chain_attacks', 'apt_groups', 'phishing']
  ),

  (
    'Malwarebytes Labs',
    'rss',
    'https://www.malwarebytes.com/blog/feed',
    'Vendor research blog from Malwarebytes covering consumer and SMB threat landscapes, malware reverse engineering, privacy issues, and practical threat analysis with accessible explanations for non-specialist audiences.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.76,
    false,
    null,
    array['malware', 'privacy_tech', 'consumer_security', 'phishing', 'adware', 'smb_security', 'mobile_threats']
  ),

  (
    'Recorded Future Intelligence Blog',
    'rss',
    'https://www.recordedfuture.com/feed',
    'Threat intelligence research from Recorded Future covering CVE landscape analysis, ransomware ecosystem trends, nation-state activity, and AI-augmented threat hunting methodologies.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.82,
    false,
    null,
    array['threat_intelligence', 'cve_tracking', 'ransomware', 'nation_state_actors', 'dark_web_monitoring', 'vulnerability_prioritization', 'ai_security']
  ),

  (
    'Rapid7 Blog',
    'rss',
    'https://www.rapid7.com/blog/rss/',
    'Vulnerability research and security operations content from Rapid7, featuring CVE technical analysis, penetration testing techniques, and attacker behavior research from the team behind Metasploit.',
    array['tech'],
    array['cybersecurity'],
    'free',
    null,
    'daily',
    array['global'],
    0.83,
    false,
    null,
    array['vulnerability_research', 'penetration_testing', 'cve_analysis', 'exploit_development', 'threat_detection', 'cloud_security', 'incident_response']
  )

on conflict (type, url) do update set
  name = excluded.name,
  description = excluded.description,
  categories = excluded.categories,
  subcategories = excluded.subcategories,
  paywall_tier = excluded.paywall_tier,
  paywall_cost_usd_monthly = excluded.paywall_cost_usd_monthly,
  update_cadence = excluded.update_cadence,
  geography = excluded.geography,
  quality_score = excluded.quality_score,
  requires_oauth = excluded.requires_oauth,
  oauth_provider = excluded.oauth_provider,
  recommended_for_topics = excluded.recommended_for_topics,
  updated_at = now();

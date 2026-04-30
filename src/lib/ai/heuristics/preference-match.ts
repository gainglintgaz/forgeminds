export function calculatePreferenceBoost(
  articleCategory: string,
  articleEntities: string[],
  userTopics: string[]
): number {
  let boost = 0;

  // Topic match
  const categoryLower = (articleCategory || "").toLowerCase();
  for (const topic of userTopics) {
    if (categoryLower.includes(topic.toLowerCase())) {
      boost += 2;
      break;
    }
  }

  // Entity match (if user follows specific tickers)
  // Future: check against user's watchlist
  // For now, just a slight boost for having resolved entities (shows relevance)
  if (articleEntities.length > 0) {
    boost += 1;
  }

  return boost;
}

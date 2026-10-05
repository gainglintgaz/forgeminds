export interface Entity {
  id: string;
  name: string;
  type: "stock" | "crypto" | "index" | "commodity" | "company" | "person" | "organization" | "other";
  symbol: string | null;
  metadata: Record<string, unknown>;
}

export interface EntityAlias {
  id: string;
  entity_id: string;
  alias: string;
}

export interface ResolvedEntity {
  entityId: string;
  symbol: string;
  name: string;
  type: Entity["type"];
  matchedAlias: string;
}

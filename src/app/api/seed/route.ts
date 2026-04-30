import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { seedEntities } from "@/lib/entities/seed";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const result = await seedEntities(supabase);

  return NextResponse.json({
    message: `Seeded ${result.created} entities (${result.skipped} already existed)`,
    ...result,
  });
}

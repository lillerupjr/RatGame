import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type LeaderboardRow = {
  rank: number;
  display_name: string;
  heat: number;
  kills: number;
  character_id: string;
  isYou?: boolean; // client-only
};

export type LeaderboardPreview = {
  seasonId: string;
  rank: number;
  top: LeaderboardRow[];
  around: LeaderboardRow[];
};

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sanitizeName(raw: string) {
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/[^A-Za-z0-9 _-]/g, "");
  return cleaned.slice(0, 12);
}

const FALLBACK_CHARACTER_ID = "UNKNOWN";

function normalizeCharacterId(raw: unknown): string {
  const upper = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!/^[A-Z][A-Z0-9_]{2,23}$/.test(upper)) return FALLBACK_CHARACTER_ID;
  return upper;
}

function normalizeRow(raw: any): LeaderboardRow {
  return {
    rank: clampInt(Number(raw?.rank ?? 1), 1, 2_000_000_000),
    display_name: typeof raw?.display_name === "string" && raw.display_name.length > 0
      ? raw.display_name
      : "ANON",
    heat: clampInt(Number(raw?.heat ?? 0), 0, 100000),
    kills: clampInt(Number(raw?.kills ?? 0), 0, 2_000_000_000),
    character_id: normalizeCharacterId(raw?.character_id),
    isYou: !!raw?.isYou,
  };
}

export class LeaderboardClient {
  private supabase: SupabaseClient;
  private seasonId: string;

  constructor(opts: { supabaseUrl: string; supabaseAnonKey: string; seasonId?: string }) {
    this.supabase = createClient(opts.supabaseUrl, opts.supabaseAnonKey);
    this.seasonId = opts.seasonId ?? "alpha";
  }

  async previewRun(input: { heat: number; kills: number; topLimit?: number; window?: number })
    : Promise<LeaderboardPreview> {

    const heat = clampInt(input.heat, 0, 100000);
    const kills = clampInt(input.kills, 0, 2_000_000_000);

    const { data, error } = await this.supabase.rpc("leaderboard_preview", {
      p_season_id: this.seasonId,
      p_heat: heat,
      p_kills: kills,
      p_top_limit: clampInt(input.topLimit ?? 20, 1, 100),
      p_window: clampInt(input.window ?? 6, 0, 50),
    });

    if (error) throw error;

    const topRows = Array.isArray(data?.top) ? data.top.map((row: any) => normalizeRow(row)) : [];
    const aroundRows = Array.isArray(data?.around) ? data.around.map((row: any) => normalizeRow(row)) : [];

    const parsed: LeaderboardPreview = {
      seasonId: data.seasonId,
      rank: data.rank,
      top: topRows,
      around: aroundRows,
    };

    // Inject a virtual YOU row at the computed rank for display.
    const youRow: LeaderboardRow = {
      rank: parsed.rank,
      display_name: "YOU",
      heat,
      kills,
      character_id: FALLBACK_CHARACTER_ID,
      isYou: true,
    };

    const sameRankIndex = parsed.around.findIndex((r) => r.rank === parsed.rank);
    if (sameRankIndex === -1) {
      parsed.around.push(youRow);
      parsed.around.sort((a, b) => a.rank - b.rank);
    } else {
      // If a public entry already has that rank, insert YOU immediately after it (visual-only).
      parsed.around.splice(sameRankIndex + 1, 0, youRow);
    }

    return parsed;
  }

  async submitName(input: { heat: number; kills: number; displayName: string; characterId: string }) {
    const heat = clampInt(input.heat, 0, 100000);
    const kills = clampInt(input.kills, 0, 2_000_000_000);
    const display_name = sanitizeName(input.displayName);
    const character_id = normalizeCharacterId(input.characterId);

    if (!display_name.length) throw new Error("Display name is empty after sanitization.");

    const { data, error } = await this.supabase
      .from("leaderboard_entries")
      .insert({
        season_id: this.seasonId,
        heat,
        kills,
        display_name,
        character_id,
      })
      .select("id, season_id, heat, kills, display_name, character_id, created_at")
      .single();

    if (error) throw error;
    return data;
  }
}

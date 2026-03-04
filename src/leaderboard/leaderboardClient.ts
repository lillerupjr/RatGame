import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type LeaderboardRow = {
  rank: number;
  display_name: string;
  depth: number;
  kills: number;
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

export class LeaderboardClient {
  private supabase: SupabaseClient;
  private seasonId: string;

  constructor(opts: { supabaseUrl: string; supabaseAnonKey: string; seasonId?: string }) {
    this.supabase = createClient(opts.supabaseUrl, opts.supabaseAnonKey);
    this.seasonId = opts.seasonId ?? "alpha";
  }

  async previewRun(input: { depth: number; kills: number; topLimit?: number; window?: number })
    : Promise<LeaderboardPreview> {

    const depth = clampInt(input.depth, 0, 100000);
    const kills = clampInt(input.kills, 0, 2_000_000_000);

    const { data, error } = await this.supabase.rpc("leaderboard_preview", {
      p_season_id: this.seasonId,
      p_depth: depth,
      p_kills: kills,
      p_top_limit: clampInt(input.topLimit ?? 20, 1, 100),
      p_window: clampInt(input.window ?? 6, 0, 50),
    });

    if (error) throw error;

    const parsed: LeaderboardPreview = {
      seasonId: data.seasonId,
      rank: data.rank,
      top: data.top ?? [],
      around: data.around ?? [],
    };

    // Inject a virtual YOU row at the computed rank for display.
    const youRow: LeaderboardRow = {
      rank: parsed.rank,
      display_name: "YOU",
      depth,
      kills,
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

  async submitName(input: { depth: number; kills: number; displayName: string }) {
    const depth = clampInt(input.depth, 0, 100000);
    const kills = clampInt(input.kills, 0, 2_000_000_000);
    const display_name = sanitizeName(input.displayName);

    if (!display_name.length) throw new Error("Display name is empty after sanitization.");

    const { data, error } = await this.supabase
      .from("leaderboard_entries")
      .insert({
        season_id: this.seasonId,
        depth,
        kills,
        display_name,
      })
      .select("id, season_id, depth, kills, display_name, created_at")
      .single();

    if (error) throw error;
    return data;
  }
}

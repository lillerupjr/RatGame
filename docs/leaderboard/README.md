# RatGame Leaderboard Setup

1. Create a Supabase project.
2. Add environment variables for the web client:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Schema changes are tracked in `supabase/migrations/`.
4. On every push to the `live` branch, GitHub Actions links to production and runs `supabase db push` to apply pending migrations.
5. Optional manual bootstrap: run SQL from `supabase/migrations/202603051200_init.sql` once if you need to initialize without CI.

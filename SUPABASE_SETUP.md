# Supabase Setup Guide for The Waiting Game

## Step 1: Create a Supabase Account & Project

1. Go to https://supabase.com and click "Start your project"
2. Sign up with GitHub (recommended) or email
3. Click "New Project"
4. Fill in:
   - **Name**: WaitingGame
   - **Database Password**: 9kEABmMz2N5BQKos
   - **Region**: choose the closest to your users (e.g., US East for East Coast)
5. Click "Create new project" and wait ~2 minutes for provisioning

## Step 2: Get Your API Keys

1. In the Supabase dashboard, go to **Settings > API** (left sidebar)
2. Copy these two values — you'll paste them into `auth.js`:
   - **Project URL**: looks like `https://cwhiaiiqdkjfchgxxyoj.supabase.co`
   - **anon (public) key**: sb_publishable_hkqrBrAlrzEYxawusQE_cw_bB-RipO_
3. These are safe to use in client-side code (Row Level Security protects your data)

## Step 3: Run the Database Migration

1. In the Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click "New query"
3. Open the file `supabase-migration.sql` from this project
4. Copy the ENTIRE contents and paste it into the SQL editor
5. Click "Run" (or Ctrl+Enter)
6. You should see "Success. No rows returned" — this creates all tables and policies

## Step 4: Enable Email Auth (already enabled by default)

1. Go to **Authentication > Providers** in the dashboard
2. Confirm "Email" is enabled
3. Optional: Under **Authentication > Settings**, you can:
   - Disable "Enable email confirmations" for easier testing
   - Set "Minimum password length" (default 6 is fine)

## Step 5: Configure Your Project URL

1. Open `auth.js` in this project
2. Replace the placeholder values at the top:
   ```js
   const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
   ```
3. Paste in your actual Project URL and anon key from Step 2

## Step 6: Add Your Site URL to Supabase

1. Go to **Authentication > URL Configuration**
2. Set **Site URL** to your production URL (e.g., `https://yourdomain.com`)
3. Under **Redirect URLs**, add:
   - `https://yourdomain.com` (production)
   - `http://localhost:8080` (local dev, if needed)

## Step 7: Deploy

Your existing GitHub Actions deploy workflow will push the new files automatically.
Just commit and push to `main`.

## Step 8: Generate Unlock Keys

Unlock keys are 8-digit codes stored in the `unlock_keys` table. To generate them:

1. Go to **SQL Editor** in Supabase dashboard
2. Run this to generate 10 keys:
   ```sql
   INSERT INTO unlock_keys (code)
   SELECT LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0')
   FROM generate_series(1, 10);
   ```
3. To see all unused keys:
   ```sql
   SELECT code FROM unlock_keys WHERE redeemed_by IS NULL ORDER BY created_at;
   ```
4. Distribute these codes to users however you like (email, print, etc.)

## Architecture Overview

```
User visits site
    |
    v
[Auth Screen] -- email/password login or register
    |              (collects: name, email, location)
    v
[Config Screen] -- existing game config
    |              (preferences saved to Supabase per-user)
    v
[Game] -- guest: 25 questions from guest-questions.json
          unlocked: unlimited from questions.json / hard+questions.json
    |
    v (after 25 questions, if guest)
[Unlock Screen] -- enter 8-digit code to unlock
```

## Useful SQL Queries

```sql
-- See all registered users
SELECT p.display_name, p.email, p.location, p.created_at, p.is_unlocked
FROM profiles p ORDER BY p.created_at DESC;

-- See all unlock keys and their status
SELECT code, redeemed_by, redeemed_at FROM unlock_keys ORDER BY created_at;

-- Manually unlock a user
UPDATE profiles SET is_unlocked = true WHERE email = 'user@example.com';

-- Generate a single key
INSERT INTO unlock_keys (code)
VALUES (LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0'))
RETURNING code;
```

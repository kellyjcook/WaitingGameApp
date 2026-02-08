-- Supabase Migration for The Waiting Game
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Safe to re-run: uses IF NOT EXISTS and CREATE OR REPLACE

-- 1. Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(25) NOT NULL DEFAULT 'Player',
    email VARCHAR(255) NOT NULL DEFAULT '',
    location VARCHAR(100) DEFAULT '',
    is_unlocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User preferences (game config saved per user)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    default_player_count INTEGER DEFAULT 2,
    player_names JSONB DEFAULT '[]'::jsonb,
    hard_mode BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Unlock keys (8-digit codes distributed to users)
CREATE TABLE IF NOT EXISTS unlock_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(8) NOT NULL UNIQUE,
    redeemed_by UUID REFERENCES profiles(id),
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS) --

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlock_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running (safe idempotent approach)
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can check key validity" ON unlock_keys;
DROP POLICY IF EXISTS "Users can redeem a key" ON unlock_keys;

-- Profiles: users can read and update their own profile
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- User preferences: users can read/write their own preferences
CREATE POLICY "Users can read own preferences"
    ON user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON user_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- Unlock keys: users can read keys (to validate) and update (to redeem)
CREATE POLICY "Users can check key validity"
    ON unlock_keys FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can redeem a key"
    ON unlock_keys FOR UPDATE
    USING (auth.uid() IS NOT NULL AND redeemed_by IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Function to handle new user signup: auto-create profile + preferences rows
-- Uses SECURITY DEFINER to bypass RLS (trigger runs as DB owner)
-- Sets search_path explicitly for Supabase security requirements
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'Player'),
        COALESCE(NEW.email, '')
    );
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log but don't block signup; profile can be created on first login
        RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Trigger: run after each new auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 4. Custom Question Sets
-- =====================================================

-- Question sets (metadata for user-created question collections)
CREATE TABLE IF NOT EXISTS question_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    share_code VARCHAR(8) UNIQUE,
    question_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Question set items (individual questions within a set)
CREATE TABLE IF NOT EXISTS question_set_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
    question VARCHAR(500) NOT NULL,
    answer INTEGER NOT NULL CHECK (answer >= 1 AND answer <= 30),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qsi_set_id ON question_set_items(set_id);
CREATE INDEX IF NOT EXISTS idx_qs_owner_id ON question_sets(owner_id);
CREATE INDEX IF NOT EXISTS idx_qs_share_code ON question_sets(share_code) WHERE share_code IS NOT NULL;

-- Add active_question_set column to user_preferences
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_preferences' AND column_name = 'active_question_set'
    ) THEN
        ALTER TABLE user_preferences
            ADD COLUMN active_question_set UUID REFERENCES question_sets(id) ON DELETE SET NULL;
    END IF;
END$$;

-- RLS for question_sets
ALTER TABLE question_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read own sets" ON question_sets;
DROP POLICY IF EXISTS "Owner can insert own sets" ON question_sets;
DROP POLICY IF EXISTS "Owner can update own sets" ON question_sets;
DROP POLICY IF EXISTS "Owner can delete own sets" ON question_sets;
DROP POLICY IF EXISTS "Users can read shared sets by code" ON question_sets;

CREATE POLICY "Owner can read own sets"
    ON question_sets FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Owner can insert own sets"
    ON question_sets FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update own sets"
    ON question_sets FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Owner can delete own sets"
    ON question_sets FOR DELETE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can read shared sets by code"
    ON question_sets FOR SELECT
    USING (auth.uid() IS NOT NULL AND share_code IS NOT NULL);

-- RLS for question_set_items
ALTER TABLE question_set_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read own set items" ON question_set_items;
DROP POLICY IF EXISTS "Owner can insert own set items" ON question_set_items;
DROP POLICY IF EXISTS "Owner can update own set items" ON question_set_items;
DROP POLICY IF EXISTS "Owner can delete own set items" ON question_set_items;
DROP POLICY IF EXISTS "Users can read shared set items" ON question_set_items;

CREATE POLICY "Owner can read own set items"
    ON question_set_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM question_sets
        WHERE question_sets.id = question_set_items.set_id
          AND question_sets.owner_id = auth.uid()
    ));

CREATE POLICY "Owner can insert own set items"
    ON question_set_items FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM question_sets
        WHERE question_sets.id = question_set_items.set_id
          AND question_sets.owner_id = auth.uid()
    ));

CREATE POLICY "Owner can update own set items"
    ON question_set_items FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM question_sets
        WHERE question_sets.id = question_set_items.set_id
          AND question_sets.owner_id = auth.uid()
    ));

CREATE POLICY "Owner can delete own set items"
    ON question_set_items FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM question_sets
        WHERE question_sets.id = question_set_items.set_id
          AND question_sets.owner_id = auth.uid()
    ));

CREATE POLICY "Users can read shared set items"
    ON question_set_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM question_sets
        WHERE question_sets.id = question_set_items.set_id
          AND question_sets.share_code IS NOT NULL
          AND auth.uid() IS NOT NULL
    ));

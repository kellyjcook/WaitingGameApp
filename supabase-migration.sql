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
    USING (auth.uid() IS NOT NULL AND redeemed_by IS NULL);

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

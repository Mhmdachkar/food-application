-- Add push_token column to profiles for Expo push notifications
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Index for looking up profiles by push token (e.g. sending targeted pushes)
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
  ON profiles (push_token)
  WHERE push_token IS NOT NULL;

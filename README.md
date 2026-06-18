# Falcon Triathlon Club

A React Native (Expo) app for the Falcon Triathlon Club.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create your `.env` file from the example and add your Supabase keys:
   ```bash
   cp .env.example .env
   ```
   Then fill in:
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   (`.env` is gitignored — your keys stay local.)

3. Start the app:
   ```bash
   npm start
   ```
   Then press `a` (Android), `i` (iOS), or scan the QR code with Expo Go.

## Project structure

```
app/                    # Expo Router screens (file-based routing)
  _layout.tsx           # Root layout, wraps app in AuthProvider
  index.tsx             # Entry — redirects based on auth state
  (auth)/               # Unauthenticated screens
    _layout.tsx
    login.tsx
    signup.tsx
  (app)/                # Authenticated screens
    _layout.tsx         # Route guard
    profile.tsx
components/
  Avatar.tsx            # Circular profile-picture placeholder (initials)
context/
  AuthContext.tsx       # Supabase session state, app-wide
lib/
  supabase.ts           # Supabase client initialization
```

## Auth

Email/password auth via Supabase. The user's name is captured at signup and
stored in `user_metadata.full_name`, displayed on the profile screen.

> If "Confirm email" is enabled in your Supabase Auth settings, new users must
> verify their email before they can sign in.

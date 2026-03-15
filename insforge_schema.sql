-- ═══════════════════════════════════════════════════════════════
-- STOCKSAGE AI – InsForge SQL Schema
-- ═══════════════════════════════════════════════════════════════

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users & Profiles
-- Note: Authentication is handled by InsForge Auth, but we store profile data here.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    account_tier TEXT DEFAULT 'Standard',
    api_key_encrypted TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Portfolios
CREATE TABLE IF NOT EXISTS public.portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Main Portfolio',
    currency TEXT DEFAULT 'USD',
    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Holdings
CREATE TABLE IF NOT EXISTS public.holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    shares DECIMAL NOT NULL DEFAULT 0,
    avg_cost DECIMAL NOT NULL DEFAULT 0,
    sector TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'Price', 'Signal', 'RSI'
    condition_value DECIMAL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Trades History
CREATE TABLE IF NOT EXISTS public.trades_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    action TEXT NOT NULL, -- 'BUY', 'SELL'
    price DECIMAL NOT NULL,
    shares DECIMAL NOT NULL,
    strategy TEXT,
    profit_loss DECIMAL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS (Row Level Security) Policies
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades_history ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see and edit their own profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Portfolios: Users can only see and edit their own portfolios
CREATE POLICY "Users can view own portfolios" ON public.portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolios" ON public.portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolios" ON public.portfolios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolios" ON public.portfolios FOR DELETE USING (auth.uid() = user_id);

-- Holdings: Users can manage holdings linked to their portfolios
CREATE POLICY "Users can manage own holdings" ON public.holdings FOR ALL
USING (EXISTS (SELECT 1 FROM public.portfolios WHERE id = public.holdings.portfolio_id AND user_id = auth.uid()));

-- Alerts: Users can manage their own alerts
CREATE POLICY "Users can manage own alerts" ON public.alerts FOR ALL USING (auth.uid() = user_id);

-- Trades History: Users can view their own trade log
CREATE POLICY "Users can view own trades" ON public.trades_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert trades" ON public.trades_history FOR INSERT WITH CHECK (auth.uid() = user_id);

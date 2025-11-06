-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.agent_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_run_id uuid,
  turn_number integer NOT NULL,
  message_type text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_group_id uuid,
  session_title text,
  target_destination text,
  user_message text NOT NULL,
  final_answer text,
  context_data jsonb DEFAULT '{}'::jsonb,
  plan_extracted jsonb,
  itinerary_card_id uuid,
  status text DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])),
  error_message text,
  turn_count integer DEFAULT 0,
  execution_time_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT agent_runs_pkey PRIMARY KEY (id),
  CONSTRAINT agent_runs_new_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.agent_tool_calls (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_run_id uuid,
  turn_number integer NOT NULL,
  tool_name text NOT NULL,
  tool_input text NOT NULL,
  tool_output text,
  observation text,
  execution_time_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_tool_calls_pkey PRIMARY KEY (id)
);
CREATE TABLE public.itinerary_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_group_id uuid NOT NULL UNIQUE,
  title text NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  duration_days integer,
  duration_nights integer,
  travelers integer DEFAULT 1,
  plan_data jsonb NOT NULL,
  natural_plan text,
  total_budget numeric DEFAULT 0,
  budget_per_person numeric DEFAULT 0,
  estimated_cost jsonb DEFAULT '{}'::jsonb,
  currency text DEFAULT 'CNY'::text,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  version integer DEFAULT 1,
  tags jsonb DEFAULT '[]'::jsonb,
  is_public boolean DEFAULT false,
  share_code text UNIQUE,
  cover_image text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT itinerary_cards_pkey PRIMARY KEY (id),
  CONSTRAINT itinerary_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  travel_preferences jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_configs (
  user_id uuid NOT NULL,
  llm_provider text,
  llm_api_key_encrypted text,
  llm_base_url text,
  llm_model text,
  speech_provider text,
  speech_api_key_encrypted text,
  speech_app_id text,
  speech_api_secret text,
  map_provider text,
  map_web_service_key_encrypted text,
  map_js_api_key_encrypted text,
  map_security_code_encrypted text,
  has_completed_setup boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_configs_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
-- ============================================================
-- Seed actual Cursor Popup theme library
-- Replaces the placeholder starter themes from the migration.
-- Run ONCE in Supabase SQL Editor after running the migrations.
-- ============================================================

-- Remove placeholder starter themes (ON DELETE SET NULL keeps event_theme_selections safe)
DELETE FROM conversation_themes;

-- Insert real theme library
INSERT INTO conversation_themes (name, description, emoji, category, sort_order) VALUES
  (
    'Post-Keyboard Computing',
    'Design and prototype input methods that don''t rely on keyboards or mice — voice, gesture, eye-tracking, wearables, context.',
    '🖐️',
    'HCI / Interfaces',
    1
  ),
  (
    'Practical AI for Agriculture',
    'Hands-on session building a small AI/automation workflow for ag operations — scouting notes, crop logs, dispatch, pricing, and more.',
    '🌾',
    'AgTech / AI',
    2
  ),
  (
    '3D on the Web',
    'Create a lightweight 3D scene (Three.js / Babylon.js) with interaction and real performance constraints. No headset required.',
    '🌐',
    '3D / XR',
    3
  ),
  (
    'Support Ops to Smart Ops',
    'Map a support workflow and build an agent that drafts responses, triages tickets, and escalates edge cases responsibly.',
    '🎧',
    'Customer Ops / AI',
    4
  ),
  (
    'MCP Hack Night',
    'Implement at least one MCP tool in your dev workflow and demo a real API call inside a tiny working app.',
    '🔌',
    'Developer Tools',
    5
  ),
  (
    'Beauty-First UI Jam',
    'Compete to create the most beautiful interface. Aesthetics and usability score — functionality is optional.',
    '🎨',
    'UI / Design',
    6
  ),
  (
    'RAG Done Right',
    'Design a retrieval pipeline that answers with evidence: source ingestion, chunking, retrieval, grounded responses, and quick evals.',
    '📚',
    'RAG / Knowledge',
    7
  ),
  (
    'AI for Real Businesses',
    'Pick an existing business and automate one real process end-to-end — intake → processing → output — with clear success criteria.',
    '🏢',
    'Automation / Ops',
    8
  ),
  (
    'One-Shot System Prompt Challenge',
    'You get ONE prompt to define your entire system: role, rules, examples, tool calls, guardrails. Use other LLMs to craft it.',
    '⚡',
    'Prompting / Systems',
    9
  ),
  (
    'Personal Knowledge Systems',
    'Build a personal knowledge base with retrieval + workflows — capture, summarize, tag, search, and weekly review.',
    '🧠',
    'PKM / Knowledge',
    10
  );

# MatchPrep AI — PRD

## Original problem statement
Browser SaaS ($20/month) that prepares medical students for residency interviews.
Design aesthetic: pink but professional.

## Personas
- P1: Fourth-year medical student in interview season.
- P2: Applicant preparing after a gap year or Step failure.
- P3: IMG preparing for US residency interviews.

## Architecture
- Frontend: React (CRA) + Tailwind + shadcn/ui + recharts + sonner.
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations + Stripe SDK.
- Auth: Emergent Google Auth (session_token cookie + Bearer fallback).
- LLM: Claude Sonnet 4.5 (via Emergent Universal Key).
- Voice: OpenAI TTS + Whisper STT (via Universal Key gateway with OpenAI fallback).
- Payments: Stripe Flow A claimable sandbox, $20/mo subscription (`matchprep_pro_monthly`).

## Implemented (2026-02)
- 5-tab shell (Dashboard, Practice, Programs, Progress, My Story) with pink-professional design.
- Landing page + Emergent Google Auth sign-in + AuthCallback + Protected routes.
- My Story profile builder (specialty, med school, USMLE, COMLEX, experiences, research, publications, leadership, volunteer, hobbies, geo pref, programs, personal statement, interview date, consent).
- Personalized question bank generated from profile.
- Voice mock interview: 6 personalities, 6 modes, MediaRecorder + Whisper STT + TTS playback, live transcript, per-turn LLM follow-ups, end-of-session category scoring (7 categories).
- SARR framework analysis (per answer).
- Speech analysis (wpm, filler count, structure, confidence).
- Body-language coaching (single frame captured at end of turn when video consented).
- Programs list + Know This Program briefing + Why Us builder.
- Progress radar (7 categories), streak, session history.
- Stripe checkout $20/mo + status polling + webhook.

## Backlog / P1
- P1: Spaced repetition daily 5-min drill screen (data already tracked; UI TBD).
- P1: Curveball question deck view.
- P1: Ask-the-interviewer question generator by role (PD / faculty / resident).
- P1: Consent pre/post evaluation survey capture.
- P2: ERAS PDF upload → parse (currently text paste).
- P2: Multi-frame body language sampling instead of single frame.
- P2: Programs "recent developments" via web scrape.

## Known non-code issue
- Emergent Universal Key budget is currently exhausted (Profile → Manage plan → Universal Key → Add Balance). LLM endpoints will 500 until refilled.

## Next tasks
- Add balance to Universal Key so LLM flows re-enable.
- Iterate on the Practice page based on user feedback.
- Build Spaced Repetition drill view and Curveball deck.

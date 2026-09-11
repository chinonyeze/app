"""MatchPrep AI backend - residency interview prep."""
import os
import uuid
import json
import base64
from io import BytesIO
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Any, Dict

import httpx
import stripe
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Cookie, Header
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
STRIPE_SECRET_KEY = os.environ["STRIPE_SECRET_KEY"]
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

stripe.api_key = STRIPE_SECRET_KEY
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="MatchPrep AI")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- Helpers --------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


# -------- Models --------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    plan: str = "free"
    stripe_customer_id: Optional[str] = None
    created_at: str


class ProfileData(BaseModel):
    specialty: Optional[str] = None
    medical_school: Optional[str] = None
    graduation_year: Optional[str] = None
    usmle_step1: Optional[str] = None
    usmle_step2: Optional[str] = None
    comlex_level1: Optional[str] = None
    comlex_level2: Optional[str] = None
    clinical_experiences: Optional[str] = None
    research: Optional[str] = None
    publications: Optional[str] = None
    leadership: Optional[str] = None
    volunteer: Optional[str] = None
    hobbies: Optional[str] = None
    geographic_preferences: Optional[str] = None
    programs_applied: Optional[str] = None
    personal_statement: Optional[str] = None
    interview_date: Optional[str] = None
    consent_feedback: bool = False


class InterviewMessage(BaseModel):
    role: str
    content: str


class MockStartReq(BaseModel):
    personality: str = "warm_pd"
    mode: str = "behavioral"  # behavioral / rapid_fire / program_specific / stress / curveball
    program_name: Optional[str] = None


class MockChatReq(BaseModel):
    session_id: str
    student_message: str


class SpeechAnalyzeReq(BaseModel):
    transcript: str
    duration_seconds: float


class SARRReq(BaseModel):
    question: str
    answer: str


class FrameAnalyzeReq(BaseModel):
    image_base64: str  # data URL or raw base64
    context: Optional[str] = None


class TTSReq(BaseModel):
    text: str
    voice: str = "nova"


class ProgramCreate(BaseModel):
    name: str
    specialty: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    reasons: Optional[List[str]] = None


class WhyUsReq(BaseModel):
    program_name: str
    reasons: List[str]
    student_experience: Optional[str] = None


class CheckoutReq(BaseModel):
    origin_url: str
    lookup_key: str = "matchprep_pro_monthly"


PLAN_BY_LOOKUP = {
    "matchprep_essential_monthly": "essential",
    "matchprep_pro_monthly": "pro",
    "matchprep_season_pass_one_time": "season_pass",
}


# -------- Auth --------
async def get_current_user(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    token = session_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(None, 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@api.post("/auth/session")
async def create_session(payload: Dict[str, str], response: Response):
    """Exchange Emergent session_id for our session_token cookie."""
    sid = payload.get("session_id")
    if not sid:
        raise HTTPException(400, "session_id required")
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": sid},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid Emergent session")
    data = r.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", email), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email),
            "picture": data.get("picture"),
            "plan": "free",
            "created_at": iso(now_utc()),
        })

    session_token = data["session_token"]
    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": iso(expires_at),
        "created_at": iso(now_utc()),
    })
    response.set_cookie(
        "session_token", session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7 * 24 * 3600,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user}


@api.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# -------- Profile / My Story --------
@api.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    doc = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return doc or {"user_id": user["user_id"]}


@api.put("/profile")
async def update_profile(payload: ProfileData, user=Depends(get_current_user)):
    data = payload.model_dump()
    data["user_id"] = user["user_id"]
    data["updated_at"] = iso(now_utc())
    await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": data}, upsert=True)
    return data


# -------- LLM helper (Emergent Universal Key via emergentintegrations) --------
async def llm_chat(system: str, messages: List[Dict[str, str]], provider: str = "anthropic", model: str = "claude-sonnet-4-5-20250929") -> str:
    """Call Claude via emergentintegrations. Uses Universal Key."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"srv_{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model(provider, model)
    # emergentintegrations LlmChat handles a single-turn send well; feed the last user + inline history in prompt
    if len(messages) > 1:
        joined = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages[:-1])
        prompt = f"[Conversation so far]\n{joined}\n\n[Student]\n{messages[-1]['content']}"
    else:
        prompt = messages[-1]["content"]
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


async def llm_vision(system: str, prompt: str, image_b64: str) -> str:
    """Claude vision through emergentintegrations."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"vis_{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    if image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1]
    msg = UserMessage(text=prompt, file_contents=[ImageContent(image_base64=image_b64)])
    resp = await chat.send_message(msg)
    return resp if isinstance(resp, str) else str(resp)


# -------- Interview personalities --------
PERSONALITIES = {
    "warm_pd": "You are a warm, encouraging Program Director in a residency interview. Ask thoughtful, open-ended questions. Nod when appropriate ('Great story...'). Be supportive but still probing.",
    "skeptic": "You are a skeptical academic faculty member. Push back on vague answers. Ask 'Can you give a specific example?', 'What was your exact role?'. Never rude, but demanding.",
    "rapid_fire": "You are a rapid-fire faculty interviewer. Ask concise questions, one after another. Keep responses under 15 words. Move on quickly.",
    "researcher": "You are a research-focused PhD-MD interviewer. Deep-dive into publications, methodology, statistical understanding, next steps.",
    "resident": "You are a chief resident interviewing a candidate. Focus on culture fit, wellness, on-call scenarios, teamwork.",
    "silent": "You are a silent, minimally-reactive interviewer. Respond very briefly ('Mm-hm.', 'Go on.'). Occasionally ask a short question. Test the candidate's composure.",
}

MODE_INSTRUCTIONS = {
    "behavioral": "Focus on behavioral questions using Situation-Action-Reflection-Relevance framing.",
    "rapid_fire": "Rapid short questions covering many topics quickly.",
    "program_specific": "Focus on 'Why our program', 'Why this specialty', program-specific questions.",
    "stress": "Include challenging, uncomfortable questions to test composure.",
    "curveball": "Include unexpected curveball questions like 'What would you do if you weren't a physician?'",
    "general": "Balanced mix of common residency interview questions.",
}


# -------- Mock Interview --------
@api.post("/interview/start")
async def start_interview(req: MockStartReq, user=Depends(get_current_user)):
    profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    session_id = f"iv_{uuid.uuid4().hex[:12]}"
    profile_summary = json.dumps({k: v for k, v in profile.items() if k != "user_id" and v}, indent=2)
    system = (
        PERSONALITIES.get(req.personality, PERSONALITIES["warm_pd"])
        + "\n\n" + MODE_INSTRUCTIONS.get(req.mode, MODE_INSTRUCTIONS["general"])
        + f"\n\nCandidate profile:\n{profile_summary or '(not filled)'}"
        + (f"\n\nYou represent program: {req.program_name}" if req.program_name else "")
        + "\n\nRules: (1) Ask ONE question at a time. (2) React to prior answers naturally (interruptions allowed for skeptic/rapid_fire). "
        "(3) Occasional follow-ups when answer is vague. (4) Never break character. (5) Keep each interviewer turn concise (1-3 sentences)."
    )
    opener_prompt = "Please deliver the very first line of the interview - a brief welcome and opening question. Do not include stage directions."
    opener = await llm_chat(system, [{"role": "user", "content": opener_prompt}])
    await db.interview_sessions.insert_one({
        "session_id": session_id,
        "user_id": user["user_id"],
        "personality": req.personality,
        "mode": req.mode,
        "program_name": req.program_name,
        "system": system,
        "messages": [{"role": "interviewer", "content": opener, "at": iso(now_utc())}],
        "created_at": iso(now_utc()),
    })
    return {"session_id": session_id, "opener": opener, "personality": req.personality, "mode": req.mode}


@api.post("/interview/message")
async def interview_message(req: MockChatReq, user=Depends(get_current_user)):
    session = await db.interview_sessions.find_one({"session_id": req.session_id, "user_id": user["user_id"]}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    history = session["messages"] + [{"role": "student", "content": req.student_message, "at": iso(now_utc())}]
    llm_messages = [{"role": "assistant" if m["role"] == "interviewer" else "user", "content": m["content"]} for m in history]
    reply = await llm_chat(session["system"], llm_messages)
    history.append({"role": "interviewer", "content": reply, "at": iso(now_utc())})
    await db.interview_sessions.update_one({"session_id": req.session_id}, {"$set": {"messages": history}})
    return {"reply": reply}


@api.post("/interview/end/{session_id}")
async def end_interview(session_id: str, user=Depends(get_current_user)):
    session = await db.interview_sessions.find_one({"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    transcript = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in session["messages"])
    prompt = (
        "You are a residency interview coach. Given the transcript below, score the candidate from 0-100 on each of these categories (return STRICT JSON): "
        "content, conciseness, confidence, specialty_knowledge, program_knowledge, behavioral, body_language. "
        "Then provide 'strengths' (3 bullets), 'improvements' (3 bullets), and 'top_priority' (one sentence).\n\nTranscript:\n" + transcript
    )
    raw = await llm_chat("You output STRICT JSON only. No prose.", [{"role": "user", "content": prompt}])
    scores = _extract_json(raw)
    await db.interview_sessions.update_one({"session_id": session_id}, {"$set": {"ended_at": iso(now_utc()), "scores": scores}})
    # update streak
    await _touch_streak(user["user_id"])
    return scores


def _extract_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        s = text.find("{"); e = text.rfind("}")
        if s != -1 and e != -1:
            try:
                return json.loads(text[s:e+1])
            except Exception:
                pass
    return {"raw": text}


async def _touch_streak(user_id: str):
    today = now_utc().date().isoformat()
    doc = await db.streaks.find_one({"user_id": user_id}, {"_id": 0}) or {"user_id": user_id, "days": 0, "last_day": None}
    if doc.get("last_day") == today:
        return
    if doc.get("last_day") == (now_utc().date() - timedelta(days=1)).isoformat():
        doc["days"] = int(doc.get("days", 0)) + 1
    else:
        doc["days"] = 1
    doc["last_day"] = today
    await db.streaks.update_one({"user_id": user_id}, {"$set": doc}, upsert=True)


@api.get("/interview/sessions")
async def list_sessions(user=Depends(get_current_user)):
    docs = await db.interview_sessions.find({"user_id": user["user_id"]}, {"_id": 0, "system": 0}).sort("created_at", -1).to_list(50)
    return docs


# -------- Speech / SARR / Vision analyses --------
@api.post("/analyze/speech")
async def analyze_speech(req: SpeechAnalyzeReq, user=Depends(get_current_user)):
    words = req.transcript.split()
    wpm = round(len(words) / (req.duration_seconds / 60.0)) if req.duration_seconds > 0 else 0
    fillers = ["um", "uh", "like", "you know", "sort of", "kind of", "basically"]
    filler_count = sum(sum(1 for w in words if w.lower().strip(".,!?") == f) for f in fillers)
    prompt = (
        f"Analyze this residency interview answer. WPM={wpm}, duration={req.duration_seconds:.1f}s, filler words={filler_count}.\n"
        "Return STRICT JSON with keys: pace_feedback, clarity_feedback, structure_feedback, confidence_feedback, "
        "overall_score (0-100), tips (array of 3 strings).\n\nTranscript:\n" + req.transcript
    )
    raw = await llm_chat("You are a speech coach for medical interviews. Output STRICT JSON only.", [{"role": "user", "content": prompt}])
    result = _extract_json(raw)
    result["wpm"] = wpm
    result["filler_count"] = filler_count
    result["duration_seconds"] = req.duration_seconds
    return result


@api.post("/analyze/sarr")
async def analyze_sarr(req: SARRReq, user=Depends(get_current_user)):
    prompt = (
        f"Question: {req.question}\nAnswer: {req.answer}\n\n"
        "Break this answer down using the SARR framework (Situation, Action, Reflection, Relevance). "
        "Return STRICT JSON with keys: situation (string), action (string), reflection (string), relevance (string), "
        "situation_score (0-100), action_score (0-100), reflection_score (0-100), relevance_score (0-100), "
        "overall_score (0-100), coaching (3 bullet tips)."
    )
    raw = await llm_chat("You are an interview framework coach. Output STRICT JSON only.", [{"role": "user", "content": prompt}])
    return _extract_json(raw)


@api.post("/analyze/frame")
async def analyze_frame(req: FrameAnalyzeReq, user=Depends(get_current_user)):
    prompt = (
        "Give brief, non-diagnostic interview coaching for this candidate frame. Assess: eye contact direction, posture, "
        "facial expression, framing, any distracting movement. Frame findings as coaching signals, not personality judgments. "
        "Return STRICT JSON: eye_contact (short), posture, expression, framing, strengths (3 strings), improvements (3 strings), overall_score (0-100)."
        + (f"\nContext: {req.context}" if req.context else "")
    )
    raw = await llm_vision("You are a body-language coach. Output STRICT JSON only.", prompt, req.image_base64)
    return _extract_json(raw)


# -------- Question generation from profile --------
@api.post("/questions/generate")
async def generate_questions(user=Depends(get_current_user)):
    profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    profile_summary = json.dumps({k: v for k, v in profile.items() if k != "user_id" and v}, indent=2)
    prompt = (
        "Given this residency applicant profile, generate 10 tailored interview questions an interviewer might ask, "
        "each with a category tag from [behavioral, specialty, program, curveball, research, personal]. "
        "Return STRICT JSON: {\"questions\": [{\"q\": string, \"category\": string, \"why_asked\": string}]}.\n\n"
        f"Profile:\n{profile_summary or '(empty)'}"
    )
    raw = await llm_chat("You output STRICT JSON only.", [{"role": "user", "content": prompt}])
    result = _extract_json(raw)
    if "questions" in result:
        await db.question_bank.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"user_id": user["user_id"], "questions": result["questions"], "generated_at": iso(now_utc())}},
            upsert=True,
        )
    return result


@api.get("/questions")
async def get_questions(user=Depends(get_current_user)):
    doc = await db.question_bank.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return doc or {"questions": []}


# -------- Programs --------
@api.get("/programs")
async def list_programs(user=Depends(get_current_user)):
    docs = await db.programs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs


@api.post("/programs")
async def create_program(p: ProgramCreate, user=Depends(get_current_user)):
    doc = p.model_dump()
    doc.update({
        "program_id": f"prog_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "created_at": iso(now_utc()),
    })
    await db.programs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/programs/{program_id}")
async def delete_program(program_id: str, user=Depends(get_current_user)):
    await db.programs.delete_one({"program_id": program_id, "user_id": user["user_id"]})
    return {"ok": True}


@api.post("/programs/know")
async def know_program(payload: Dict[str, str], user=Depends(get_current_user)):
    name = payload.get("program_name", "")
    specialty = payload.get("specialty", "")
    prompt = (
        f"Provide a 'Know This Program' briefing for '{name}' ({specialty}) residency. "
        "Return STRICT JSON with keys: mission, likely_strengths (3), curriculum_highlights (3), "
        "research_opportunities (3), suggested_questions_for_pd (3), suggested_questions_for_residents (3), "
        "questions_to_avoid (3), why_us_talking_points (3). Do NOT fabricate specific names or numbers you are unsure about; keep it general."
    )
    raw = await llm_chat("You output STRICT JSON only.", [{"role": "user", "content": prompt}])
    return _extract_json(raw)


@api.post("/programs/why-us")
async def why_us(req: WhyUsReq, user=Depends(get_current_user)):
    profile = await db.profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    prompt = (
        f"Program: {req.program_name}\nCandidate reasons: {req.reasons}\nCandidate context: {req.student_experience or ''}\n"
        f"Candidate profile snippet: {json.dumps({k: v for k, v in profile.items() if v and k not in ('user_id',)})[:1200]}\n\n"
        "Construct a compelling, authentic 60-90 second spoken 'Why Us' answer that ties the candidate's specific experiences to the program's features. "
        "Return STRICT JSON: {\"answer\": string, \"warnings\": [strings of any generic-sounding phrases to fix], \"strong_hooks\": [3 short bullets]}."
    )
    raw = await llm_chat("You output STRICT JSON only.", [{"role": "user", "content": prompt}])
    return _extract_json(raw)


# -------- Progress --------
@api.get("/progress/summary")
async def progress_summary(user=Depends(get_current_user)):
    sessions = await db.interview_sessions.find(
        {"user_id": user["user_id"], "scores": {"$exists": True}},
        {"_id": 0, "scores": 1, "created_at": 1, "mode": 1, "personality": 1}
    ).sort("created_at", -1).to_list(50)
    categories = ["content", "conciseness", "confidence", "specialty_knowledge", "program_knowledge", "behavioral", "body_language"]
    avgs = {c: 0 for c in categories}
    counts = {c: 0 for c in categories}
    for s in sessions:
        sc = s.get("scores", {})
        for c in categories:
            v = sc.get(c)
            if isinstance(v, (int, float)):
                avgs[c] += v
                counts[c] += 1
    for c in categories:
        avgs[c] = round(avgs[c] / counts[c], 1) if counts[c] else 0
    overall = round(sum(avgs.values()) / max(1, sum(1 for c in categories if counts[c])), 1) if any(counts.values()) else 0
    weakest = min(categories, key=lambda c: avgs[c] if counts[c] else 100)
    streak = await db.streaks.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {"days": 0}
    programs_count = await db.programs.count_documents({"user_id": user["user_id"]})
    q_doc = await db.question_bank.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {"questions": []}
    return {
        "categories": avgs,
        "overall_readiness": overall,
        "weakest": weakest,
        "sessions_count": len(sessions),
        "recent_sessions": sessions[:10],
        "streak_days": streak.get("days", 0),
        "programs_researched": programs_count,
        "questions_mastered": len(q_doc.get("questions", [])),
    }


# -------- OpenAI TTS / STT (via emergent-key gateway or standard) --------
@api.post("/tts")
async def tts(req: TTSReq, user=Depends(get_current_user)):
    """OpenAI TTS through Universal Key. Returns MP3 audio."""
    # Emergent Universal Key supports OpenAI. Use OpenAI SDK with base_url override handled by litellm through emergentintegrations,
    # but simplest reliable path: call OpenAI /v1/audio/speech via httpx with the universal key.
    headers = {"Authorization": f"Bearer {EMERGENT_LLM_KEY}", "Content-Type": "application/json"}
    body = {"model": "tts-1", "voice": req.voice, "input": req.text[:4000], "response_format": "mp3"}
    # Try Emergent proxy first; fall back to direct OpenAI-compatible endpoint through integrations
    proxy = os.environ.get("INTEGRATION_PROXY_URL")
    urls = []
    if proxy:
        urls.append(proxy.rstrip("/") + "/openai/v1/audio/speech")
    urls.append("https://api.openai.com/v1/audio/speech")
    last_err = None
    for url in urls:
        try:
            async with httpx.AsyncClient(timeout=30) as hc:
                r = await hc.post(url, headers=headers, json=body)
            if r.status_code == 200:
                return Response(content=r.content, media_type="audio/mpeg")
            last_err = f"{r.status_code}: {r.text[:200]}"
        except Exception as e:
            last_err = str(e)
    raise HTTPException(502, f"TTS failed: {last_err}")


@api.post("/stt")
async def stt(file: UploadFile = File(...), user=Depends(get_current_user)):
    raw = await file.read()
    if len(raw) > 25_000_000:
        raise HTTPException(413, "Audio too large")
    headers = {"Authorization": f"Bearer {EMERGENT_LLM_KEY}"}
    proxy = os.environ.get("INTEGRATION_PROXY_URL")
    urls = []
    if proxy:
        urls.append(proxy.rstrip("/") + "/openai/v1/audio/transcriptions")
    urls.append("https://api.openai.com/v1/audio/transcriptions")
    files = {"file": (file.filename or "audio.webm", raw, file.content_type or "audio/webm")}
    data = {"model": "whisper-1"}
    last_err = None
    for url in urls:
        try:
            async with httpx.AsyncClient(timeout=60) as hc:
                r = await hc.post(url, headers=headers, files=files, data=data)
            if r.status_code == 200:
                return r.json()
            last_err = f"{r.status_code}: {r.text[:200]}"
        except Exception as e:
            last_err = str(e)
    raise HTTPException(502, f"STT failed: {last_err}")


# -------- Stripe subscription --------
@api.post("/payments/checkout")
async def create_checkout(req: CheckoutReq, user=Depends(get_current_user)):
    lookup = req.lookup_key if req.lookup_key in PLAN_BY_LOOKUP else "matchprep_pro_monthly"
    price_list = stripe.Price.list(lookup_keys=[lookup], active=True, limit=1).data
    if not price_list:
        raise HTTPException(500, "Price not configured")
    price = price_list[0]
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription" if price.recurring else "payment",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        customer_email=user["email"],
        metadata={"user_id": user["user_id"], "lookup_key": lookup, "plan": PLAN_BY_LOOKUP[lookup]},
    )
    try:
        session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError as e:
        msg = (e.user_message or "").lower()
        if "managed payments" in msg or "ineligible" in msg:
            session = stripe.checkout.Session.create(
                **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required",
            )
        else:
            raise
    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "user_id": user["user_id"],
        "lookup_key": lookup,
        "plan": PLAN_BY_LOOKUP[lookup],
        "amount": (price.unit_amount or 0),
        "currency": price.currency,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {
                        "status": "completed",
                        "payment_status": "paid",
                        "stripe_subscription_id": s.subscription,
                        "stripe_payment_intent_id": s.payment_intent,
                        "updated_at": iso(now_utc()),
                    }},
                )
                if record.get("user_id"):
                    await db.users.update_one({"user_id": record["user_id"]}, {"$set": {"plan": record.get("plan", "pro")}})
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except Exception:
            pass
    return {
        "session_id": record["session_id"],
        "status": record["status"],
        "payment_status": record["payment_status"],
    }


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {
                "status": "completed",
                "payment_status": obj.get("payment_status", "paid"),
                "stripe_subscription_id": obj.get("subscription"),
                "stripe_payment_intent_id": obj.get("payment_intent"),
                "updated_at": iso(now_utc()),
            }},
        )
        user_id = (obj.get("metadata") or {}).get("user_id")
        plan = (obj.get("metadata") or {}).get("plan", "pro")
        if user_id:
            await db.users.update_one({"user_id": user_id}, {"$set": {"plan": plan}})
    elif t == "customer.subscription.deleted":
        rec = await db.payment_transactions.find_one({"stripe_subscription_id": obj.get("id")}, {"_id": 0, "user_id": 1})
        if rec and rec.get("user_id"):
            await db.users.update_one({"user_id": rec["user_id"]}, {"$set": {"plan": "free"}})
    return {"status": "ok"}


# -------- Health --------
@api.get("/")
async def root():
    return {"ok": True, "service": "matchprep-ai"}


app.include_router(api)


@app.on_event("shutdown")
async def shutdown():
    client.close()

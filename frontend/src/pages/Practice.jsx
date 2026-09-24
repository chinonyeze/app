import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Video, VideoOff, Square, Sparkles, Send, StopCircle } from "lucide-react";
import { toast } from "sonner";
import {
  startInterview, sendInterviewMessage, endInterview,
  analyzeSpeech, analyzeSARR, analyzeFrame, ttsUrl, stt,
} from "@/lib/api";

const PERSONALITIES = [
  { id: "warm_pd", label: "Warm PD", desc: "Encouraging & empathetic", tag: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "skeptic", label: "Skeptic", desc: "Challenges vague answers", tag: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "rapid_fire", label: "Rapid-fire", desc: "Short, quick tempo", tag: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "researcher", label: "Researcher", desc: "Deep publication dive", tag: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "resident", label: "Chief Resident", desc: "Culture & wellness", tag: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "silent", label: "Silent Observer", desc: "Minimal reactions", tag: "bg-slate-100 text-slate-700 border-slate-300" },
];

const MODES = [
  { id: "general", label: "General" },
  { id: "behavioral", label: "Behavioral" },
  { id: "rapid_fire", label: "Rapid-fire" },
  { id: "program_specific", label: "Program-specific" },
  { id: "stress", label: "Stress" },
  { id: "curveball", label: "Curveball" },
];

export default function Practice() {
  const [personality, setPersonality] = useState("warm_pd");
  const [mode, setMode] = useState("behavioral");
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scores, setScores] = useState(null);
  const [sarr, setSarr] = useState(null);
  const [bodyLang, setBodyLang] = useState(null);
  const [speech, setSpeech] = useState(null);
  const [consent, setConsent] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const recordStartRef = useRef(0);
  const audioRef = useRef(null);

  useEffect(() => () => stopStream(), []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const beginSession = async () => {
    setBusy(true);
    try {
      const s = await startInterview({ personality, mode });
      setSessionId(s.session_id);
      setMessages([{ role: "interviewer", content: s.opener }]);
      setScores(null); setSarr(null); setBodyLang(null); setSpeech(null);
      speak(s.opener);
      toast.success("Interview started");
    } catch (e) {
      toast.error("Could not start interview");
    } finally { setBusy(false); }
  };

  const speak = async (t) => {
    try {
      const url = await ttsUrl(t);
      if (audioRef.current) { audioRef.current.pause(); }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch { /* TTS optional */ }
  };

  const submitText = async (message) => {
    if (!sessionId || !message.trim()) return;
    setMessages((m) => [...m, { role: "student", content: message }]);
    setText("");
    setBusy(true);
    try {
      const r = await sendInterviewMessage({ session_id: sessionId, student_message: message });
      setMessages((m) => [...m, { role: "interviewer", content: r.reply }]);
      speak(r.reply);
      // fire SARR on the answer
      const q = messages[messages.length - 1]?.content || "";
      analyzeSARR({ question: q, answer: message }).then(setSarr).catch(() => {});
    } catch { toast.error("Message failed"); }
    finally { setBusy(false); }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Your browser does not support microphone capture");
        return;
      }
      const wantVideo = videoOn && consent;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo ? { width: 640, height: 480 } : false,
      });
      streamRef.current = stream;
      if (wantVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (_) { /* autoplay policy */ }
      }
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        toast.error("No microphone track available");
        stopStream();
        return;
      }
      // Record ONLY audio (Whisper doesn't need video); prevents mimeType mismatch when
      // the stream also contains a video track.
      const audioStream = new MediaStream(audioTracks);
      let mimeType = "";
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
      if (window.MediaRecorder) {
        for (const t of candidates) {
          if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
        }
      }
      let mr;
      try {
        mr = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
      } catch (err) {
        console.error("MediaRecorder init failed", err);
        toast.error("Recording not supported in this browser");
        stopStream();
        return;
      }
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onerror = (e) => { console.error("recorder error", e); toast.error("Recording error"); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        const duration = (Date.now() - recordStartRef.current) / 1000;
        if (!blob.size) { toast.error("Recording was empty — check your mic"); stopStream(); return; }
        // capture one frame BEFORE stopping the stream
        if (wantVideo && videoRef.current) {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            canvas.getContext("2d").drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            analyzeFrame({ image_base64: dataUrl, context: "residency interview" }).then(setBodyLang).catch(() => {});
          } catch {}
        }
        stopStream();
        try {
          const t = await stt(blob);
          const transcript = t.text || "";
          if (transcript.trim()) {
            if (sessionId) submitText(transcript);
            else setText(transcript);
            analyzeSpeech({ transcript, duration_seconds: duration }).then(setSpeech).catch(() => {});
          } else {
            toast.error("No speech detected");
          }
        } catch (err) {
          console.error(err);
          toast.error("Transcription failed");
        }
      };
      mediaRecorderRef.current = mr;
      recordStartRef.current = Date.now();
      mr.start(1000);
      setRecording(true);
    } catch (e) {
      console.error("getUserMedia failed", e);
      const name = e?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        toast.error("Microphone permission denied — check your browser's site settings");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        toast.error("No microphone found on this device");
      } else if (name === "NotReadableError") {
        toast.error("Microphone is in use by another app");
      } else if (window.isSecureContext === false) {
        toast.error("Microphone requires HTTPS");
      } else {
        toast.error(`Mic error: ${e?.message || name || "unknown"}`);
      }
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const endMock = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const s = await endInterview(sessionId);
      setScores(s);
      audioRef.current?.pause();
      toast.success("Interview scored");
    } catch { toast.error("Could not score"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-8" data-testid="practice-view">
      <div>
        <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Practice</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Realistic mock interview</h1>
        <p className="mt-2 text-slate-600">Choose an interviewer style and interview mode. Answer by voice or text — Claude follows up naturally.</p>
      </div>

      {/* Personality picker */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
        {PERSONALITIES.map((p) => (
          <button
            key={p.id}
            data-testid={`personality-${p.id}`}
            onClick={() => setPersonality(p.id)}
            className={`text-left rounded-2xl border p-4 transition ${personality === p.id ? "border-rose-500 bg-rose-50/60 shadow-md shadow-rose-500/10" : "border-slate-200 bg-white hover:border-rose-200"}`}
          >
            <div className="flex items-center justify-between">
              <div className="font-display font-semibold text-slate-900">{p.label}</div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${p.tag} uppercase tracking-wider font-semibold`}>{personality === p.id ? "Selected" : "Choose"}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{p.desc}</div>
          </button>
        ))}
      </div>

      <Card className="rounded-2xl border-rose-100/70">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Mode</div>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger data-testid="mode-select" className="w-56 rounded-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => <SelectItem key={m.id} value={m.id} data-testid={`mode-option-${m.id}`}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 self-end pb-2">
              <input data-testid="consent-checkbox" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              I consent to voice & video processing for coaching feedback
            </label>
            <div className="ml-auto flex items-center gap-2 self-end">
              <Button data-testid="toggle-video" variant="outline" size="sm" className="rounded-full" onClick={() => setVideoOn(v => !v)} disabled={!consent}>
                {videoOn ? <Video className="w-4 h-4 mr-1"/> : <VideoOff className="w-4 h-4 mr-1"/>} Video
              </Button>
              {!sessionId ? (
                <Button data-testid="start-mock-interview-button" onClick={beginSession} disabled={busy} className="rounded-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700">
                  <Sparkles className="w-4 h-4 mr-1"/> Start
                </Button>
              ) : (
                <Button data-testid="end-mock-interview-button" onClick={endMock} disabled={busy} variant="outline" className="rounded-full border-rose-200">
                  <StopCircle className="w-4 h-4 mr-1"/> End & score
                </Button>
              )}
            </div>
          </div>

          {videoOn && consent && (
            <div className="grid sm:grid-cols-2 gap-3">
              <video ref={videoRef} data-testid="video-preview" className="rounded-xl bg-slate-900 aspect-video w-full" muted playsInline/>
              <div className="rounded-xl border border-rose-100 p-4 bg-rose-50/40 text-sm text-slate-600">
                <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold mb-2">Body language capture</div>
                We sample one frame at the end of your recording and send it to the coach model. Frames are used only for coaching feedback.
              </div>
            </div>
          )}

          {/* Transcript */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 max-h-96 overflow-auto space-y-3" data-testid="transcript">
            {messages.length === 0 && <div className="text-sm text-slate-400 text-center py-8">Press Start to begin the interview.</div>}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm max-w-[85%] rounded-2xl p-3 ${m.role === "interviewer" ? "bg-slate-50 border border-slate-200 text-slate-800" : "bg-rose-50 border border-rose-100 text-slate-800 ml-auto"}`}>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1 opacity-60">{m.role}</div>
                {m.content}
              </div>
            ))}
          </div>

          {/* Input row */}
          <div className="flex items-center gap-2">
            <Textarea
              data-testid="answer-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={sessionId ? "Type your answer or use the mic…" : "Start the interview first"}
              rows={2}
              className="flex-1 rounded-2xl"
              disabled={!sessionId || busy}
            />
            <div className="flex flex-col gap-2">
              <Button data-testid="send-answer" onClick={() => submitText(text)} disabled={!sessionId || busy || !text.trim()} className="rounded-full bg-slate-900 hover:bg-slate-800">
                <Send className="w-4 h-4"/>
              </Button>
              {!recording ? (
                <Button data-testid="start-recording" onClick={startRecording} disabled={busy || !consent} variant="outline" className="rounded-full border-rose-200" title={!consent ? "Tick the consent box to record" : "Record answer"}>
                  <Mic className="w-4 h-4"/>
                </Button>
              ) : (
                <Button data-testid="stop-recording" onClick={stopRecording} className="rounded-full bg-rose-600 hover:bg-rose-700">
                  <Square className="w-4 h-4"/>
                </Button>
              )}
            </div>
          </div>
          {recording && (
            <div className="flex items-center gap-2 text-xs text-rose-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-600 pulse-dot"/> Recording — speak your answer, then press stop.
              <span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/>
            </div>
          )}
        </CardContent>
      </Card>

      {sarr && !sarr.raw && (
        <Card className="rounded-2xl border-rose-100/70" data-testid="sarr-card">
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">SARR framework analysis</div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              {[
                ["Situation", sarr.situation, sarr.situation_score, "emerald"],
                ["Action", sarr.action, sarr.action_score, "amber"],
                ["Reflection", sarr.reflection, sarr.reflection_score, "rose"],
                ["Relevance", sarr.relevance, sarr.relevance_score, "indigo"],
              ].map(([label, val, score, c]) => (
                <div key={label} className={`rounded-xl border p-3 bg-${c}-50/60 border-${c}-100`}>
                  <div className="flex items-center justify-between">
                    <div className={`text-xs uppercase tracking-wider font-semibold text-${c}-700`}>{label}</div>
                    <Badge variant="outline" className="rounded-full">{score ?? "—"}/100</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{val || "—"}</p>
                </div>
              ))}
            </div>
            {Array.isArray(sarr.coaching) && (
              <ul className="mt-4 text-sm text-slate-700 list-disc pl-5 space-y-1">
                {sarr.coaching.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {speech && !speech.raw && (
          <Card className="rounded-2xl border-rose-100/70" data-testid="speech-card">
            <CardContent className="p-6">
              <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Speech analysis</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-display font-extrabold text-slate-900">{speech.overall_score ?? "—"}</span>
                <span className="text-slate-500 text-sm">/100</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center"><div className="font-semibold text-slate-900">{speech.wpm}</div><div className="text-slate-500">wpm</div></div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center"><div className="font-semibold text-slate-900">{speech.filler_count}</div><div className="text-slate-500">fillers</div></div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center"><div className="font-semibold text-slate-900">{speech.duration_seconds?.toFixed?.(0) ?? "—"}s</div><div className="text-slate-500">duration</div></div>
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-slate-700">
                <div><b>Pace:</b> {speech.pace_feedback}</div>
                <div><b>Clarity:</b> {speech.clarity_feedback}</div>
                <div><b>Structure:</b> {speech.structure_feedback}</div>
                <div><b>Confidence:</b> {speech.confidence_feedback}</div>
              </div>
            </CardContent>
          </Card>
        )}
        {bodyLang && !bodyLang.raw && (
          <Card className="rounded-2xl border-rose-100/70" data-testid="body-card">
            <CardContent className="p-6">
              <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Body language coaching</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-display font-extrabold text-slate-900">{bodyLang.overall_score ?? "—"}</span>
                <span className="text-slate-500 text-sm">/100</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                <li><b>Eye contact:</b> {bodyLang.eye_contact}</li>
                <li><b>Posture:</b> {bodyLang.posture}</li>
                <li><b>Expression:</b> {bodyLang.expression}</li>
                <li><b>Framing:</b> {bodyLang.framing}</li>
              </ul>
              {Array.isArray(bodyLang.improvements) && (
                <div className="mt-3 text-sm text-slate-700">
                  <div className="font-semibold mb-1">Improvements</div>
                  <ul className="list-disc pl-5 space-y-1">{bodyLang.improvements.map((s,i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {scores && !scores.raw && (
        <Card className="rounded-2xl border-rose-200 bg-gradient-to-br from-rose-50/70 to-white" data-testid="final-scores">
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Interview readiness — this session</div>
            <div className="mt-4 grid sm:grid-cols-4 gap-3">
              {["content","conciseness","confidence","specialty_knowledge","program_knowledge","behavioral","body_language"].map((c) => (
                <div key={c} className="rounded-xl bg-white border border-rose-100 p-3">
                  <div className="text-xs text-slate-500 capitalize">{c.replaceAll("_"," ")}</div>
                  <div className="mt-1 text-xl font-display font-bold text-slate-900">{scores[c] ?? "—"}</div>
                </div>
              ))}
            </div>
            {scores.top_priority && (
              <div className="mt-4 text-sm text-slate-800"><b>Top priority:</b> {scores.top_priority}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

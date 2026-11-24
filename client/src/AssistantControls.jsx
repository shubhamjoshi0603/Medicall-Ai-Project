import { useEffect, useRef, useState } from "react";

export default function AssistantControls({ onInput, messages }) {
  const [language, setLanguage] = useState("en-IN");
  const [feedback, setFeedback] = useState("");
  const recognition = useRef(null);
  useEffect(() => () => { recognition.current?.abort(); window.speechSynthesis?.cancel(); }, []);
  const hindi = language === "hi-IN";
  const suggestions = hindi ? ["मेरी अगली अपॉइंटमेंट कब है?", "डॉक्टर से मिलने की तैयारी कैसे करूँ?"] :
    ["When is my next appointment?", "How should I prepare for my visit?"];
  const answer = messages.filter(m => m.role !== "user").at(-1)?.text;
  function listen() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return setFeedback("Voice dictation is unavailable in this browser. You can type your question.");
    recognition.current?.abort();
    const instance = new Speech(); recognition.current = instance; instance.lang = language;
    instance.onresult = event => { onInput(event.results[0][0].transcript); setFeedback(""); };
    instance.onerror = () => setFeedback("Dictation stopped. Check microphone access or type your question.");
    try { instance.start(); setFeedback("Listening…"); } catch { setFeedback("Microphone unavailable."); }
  }
  return <div className="assistant-tools"><select aria-label="Voice and suggestion language" value={language} onChange={e => setLanguage(e.target.value)}>
    <option value="en-IN">English</option><option value="hi-IN">हिन्दी</option></select>
    {suggestions.map(s => <button key={s} onClick={() => onInput(s)}>{s}</button>)}<button onClick={listen}>Dictate</button>
    {answer && window.speechSynthesis && <button onClick={() => { window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(answer); speech.lang = language; window.speechSynthesis.speak(speech); }}>Read reply</button>}
    {feedback && <p role="status">{feedback}</p>}</div>;
}

const VOICE_ORB_ICONS = {
  idle: 'Mic',
  listening: 'Listen',
  thinking: 'AI',
  speaking: 'Speak',
};

const VOICE_ORB_LABELS = {
  idle: 'Tap to start talking',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
};

export function formatVoiceTimer(totalSeconds = 0) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function getMicStatusMarkup(state = 'idle', options = {}) {
  switch (state) {
    case 'recording':
      return '<span class="rec-dot"></span> Recording... <span class="voice-timer">0:00</span>';
    case 'loading':
      return '<span class="voice-spinner"></span> Loading Whisper model...';
    case 'loading_progress': {
      const pct = Number.isFinite(options.progress) ? Math.max(0, Math.min(100, Math.round(options.progress))) : 0;
      return `<span class="voice-spinner"></span> Loading Whisper... ${pct}%`;
    }
    case 'transcribing':
      return '<span class="voice-spinner"></span> Transcribing...';
    case 'transcribed':
      return 'Transcribed! Edit and send, or record more.';
    case 'empty':
      return 'No speech detected. Try again.';
    case 'mic_denied':
      return 'Microphone access denied';
    case 'error':
      return `Transcription error: ${String(options.errorMessage || 'Unknown error')}`;
    default:
      return '';
  }
}

export function getVoiceOrbUi(state = 'idle') {
  const normalized = Object.prototype.hasOwnProperty.call(VOICE_ORB_ICONS, state) ? state : 'idle';
  return {
    state: normalized,
    icon: VOICE_ORB_ICONS[normalized],
    label: VOICE_ORB_LABELS[normalized],
  };
}

export function pickPreferredSpeechVoice(voices = []) {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const englishGoogle = voices.find((voice) => {
    const lang = String(voice?.lang || '').toLowerCase();
    const name = String(voice?.name || '');
    return lang.startsWith('en') && name.includes('Google');
  });
  if (englishGoogle) return englishGoogle;
  return voices.find((voice) => String(voice?.lang || '').toLowerCase().startsWith('en')) || null;
}

export function buildVoiceChatTranscript(userText = '', assistantText = '', phase = 'thinking') {
  const user = String(userText || '').trim();
  const assistant = String(assistantText || '').trim();

  if (!user && !assistant) return '';

  if (!assistant) {
    if (phase === 'thinking') return `You: "${user}"\n\nThinking...`;
    return `You: "${user}"`;
  }

  return `You: "${user}"\n\nAI: ${assistant}`;
}

export function isVoiceOrbIdleClassName(className = '') {
  return String(className || '').includes('idle');
}

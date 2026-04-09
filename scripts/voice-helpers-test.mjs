import {
  buildVoiceChatTranscript,
  formatVoiceTimer,
  getMicStatusMarkup,
  getVoiceOrbUi,
  isVoiceOrbIdleClassName,
  pickPreferredSpeechVoice,
} from '../src/lib/voice.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  assert(formatVoiceTimer(0) === '0:00', 'Timer format for 0 seconds is incorrect.');
  assert(formatVoiceTimer(65) === '1:05', 'Timer format for 65 seconds is incorrect.');
  assert(formatVoiceTimer(-10) === '0:00', 'Timer should clamp negative values.');

  assert(getMicStatusMarkup('recording').includes('Recording...'), 'Recording status markup missing.');
  assert(getMicStatusMarkup('loading_progress', { progress: 33 }).includes('33%'), 'Loading progress markup missing progress percent.');
  assert(getMicStatusMarkup('error', { errorMessage: 'boom' }).includes('boom'), 'Error markup missing error message.');

  const thinkingUi = getVoiceOrbUi('thinking');
  assert(thinkingUi.icon === 'AI', 'Voice orb icon mapping for thinking is incorrect.');
  assert(thinkingUi.label === 'Thinking...', 'Voice orb label mapping for thinking is incorrect.');

  assert(buildVoiceChatTranscript('Hello', '', 'thinking') === 'You: "Hello"\n\nThinking...', 'Thinking transcript format incorrect.');
  assert(buildVoiceChatTranscript('Hello', 'Hi there') === 'You: "Hello"\n\nAI: Hi there', 'AI transcript format incorrect.');

  assert(isVoiceOrbIdleClassName('voice-orb idle') === true, 'Idle class detection should be true.');
  assert(isVoiceOrbIdleClassName('voice-orb thinking') === false, 'Idle class detection should be false.');

  const voices = [
    { lang: 'en-US', name: 'Default English' },
    { lang: 'en-US', name: 'Google US English' },
    { lang: 'fr-FR', name: 'French Voice' },
  ];
  const preferred = pickPreferredSpeechVoice(voices);
  assert(preferred?.name === 'Google US English', 'Preferred voice should prioritize Google English voice.');

  console.log('Voice helpers test passed.');
}

run();

// ============================================================
// NeuralBox Studio — Model Registry
// Single source of truth for the gallery. Card metadata lives
// here (cheap); each studio module is dynamically imported only
// when its route is opened.
// ============================================================

export const CATEGORIES = [
    { id: 'vision', label: 'Vision', emoji: '👁️', blurb: 'See, find, and understand images' },
    { id: 'audio', label: 'Audio', emoji: '🎧', blurb: 'Hear and speak' },
    { id: 'language', label: 'Language', emoji: '✍️', blurb: 'Read, write, and reason over text' },
    { id: 'chat', label: 'Chat', emoji: '💬', blurb: 'Talk to a model — no server, ever' },
];

export const STUDIOS = [
    // ---- Vision ----
    {
        id: 'object-detection', title: 'Object Detection', category: 'vision',
        tagline: 'Find and box every object — real YOLO, right in your browser.',
        emoji: '🎯', accent: '#fb7185', badge: 'YOLO', device: 'any', size: '~26 MB', tier: 'light',
        load: () => import('./tasks/object-detection.js'),
    },
    {
        id: 'zero-shot-detection', title: 'Find Anything', category: 'vision',
        tagline: 'Detect any object you can name — no training. Powered by OWL-ViT.',
        emoji: '🔭', accent: '#e879f9', badge: 'OWL-ViT', device: 'any', size: '~150 MB', tier: 'heavy',
        load: () => import('./tasks/zero-shot-detection.js'),
    },
    {
        id: 'image-classification', title: 'Image Labeler', category: 'vision',
        tagline: 'What is this a picture of? 1000-class instant labeling.',
        emoji: '🏷️', accent: '#f472b6', device: 'any', size: '~25 MB', tier: 'light',
        load: () => import('./tasks/image-classification.js'),
    },
    {
        id: 'zero-shot-image', title: 'Zero-Shot Vision', category: 'vision',
        tagline: 'Score an image against ANY labels you type. Powered by CLIP.',
        emoji: '🔮', accent: '#c084fc', badge: 'CLIP', device: 'any', size: '~120 MB', tier: 'medium',
        load: () => import('./tasks/zero-shot-image.js'),
    },
    {
        id: 'segmentation', title: 'Segmentation', category: 'vision',
        tagline: 'Paint every pixel by what it is. Sharp SegFormer scene parsing.',
        emoji: '🧩', accent: '#a78bfa', device: 'any', size: '~56 MB', tier: 'medium',
        load: () => import('./tasks/segmentation.js'),
    },
    {
        id: 'depth', title: 'Depth Map', category: 'vision',
        tagline: 'Turn any photo into a 3D depth map. Depth Anything V2.',
        emoji: '🌀', accent: '#38bdf8', device: 'any', size: '~30 MB', tier: 'light',
        load: () => import('./tasks/depth.js'),
    },
    {
        id: 'background-removal', title: 'Background Remover', category: 'vision',
        tagline: 'Cut the subject out of any photo. Export a transparent PNG.',
        emoji: '✂️', accent: '#34d399', badge: 'Cutout', device: 'any', size: '~44 MB', tier: 'medium',
        load: () => import('./tasks/background-removal.js'),
    },
    {
        id: 'caption', title: 'Image Captioner', category: 'vision',
        tagline: 'Describe any image — a quick line or rich Florence-2 detail.',
        emoji: '📝', accent: '#fbbf24', device: 'any', size: '~90 MB+', tier: 'medium',
        load: () => import('./tasks/caption.js'),
    },

    // ---- Audio ----
    {
        id: 'speech-to-text', title: 'Speech to Text', category: 'audio',
        tagline: 'Transcribe voice or whole podcasts with Whisper — quality tiers, timestamps, SRT export.',
        emoji: '🎙️', accent: '#f59e0b', badge: 'Whisper', device: 'any', size: '~145 MB', tier: 'medium',
        load: () => import('./tasks/speech-to-text.js'),
    },
    {
        id: 'text-to-speech', title: 'Text to Speech', category: 'audio',
        tagline: 'Type anything and hear a natural voice read it. Kokoro, 11 voices, long text.',
        emoji: '🔊', accent: '#fb923c', badge: 'Kokoro', device: 'any', size: '~86 MB', tier: 'medium',
        load: () => import('./tasks/text-to-speech.js'),
    },
    {
        id: 'audio-classification', title: 'Sound Classifier', category: 'audio',
        tagline: 'Identify any sound — animals, music, environment. 527 classes.',
        emoji: '👂', accent: '#f97316', device: 'webgpu', size: '~120 MB', tier: 'heavy',
        load: () => import('./tasks/audio-classification.js'),
    },

    // ---- Language ----
    {
        id: 'sentiment', title: 'Sentiment', category: 'language',
        tagline: 'Read the mood of any text — positive or negative, instantly.',
        emoji: '💬', accent: '#60a5fa', device: 'any', size: '~67 MB', tier: 'light',
        load: () => import('./tasks/sentiment.js'),
    },
    {
        id: 'zero-shot-text', title: 'Zero-Shot Text', category: 'language',
        tagline: 'Classify text into ANY categories you invent. No training.',
        emoji: '🧷', accent: '#818cf8', device: 'any', size: '~95 MB', tier: 'medium',
        load: () => import('./tasks/zero-shot-text.js'),
    },
    {
        id: 'summarize', title: 'Summarizer', category: 'language',
        tagline: 'Crunch long text into a tight summary. Distilled BART.',
        emoji: '📚', accent: '#2dd4bf', device: 'any', size: '~145 MB', tier: 'medium',
        load: () => import('./tasks/summarize.js'),
    },
    {
        id: 'translate', title: 'Translator', category: 'language',
        tagline: 'Translate between languages on-device. Helsinki OPUS-MT.',
        emoji: '🌍', accent: '#22d3ee', device: 'any', size: '~75 MB', tier: 'medium',
        load: () => import('./tasks/translate.js'),
    },
    {
        id: 'semantic-search', title: 'Semantic Search', category: 'language',
        tagline: 'Search by meaning, not keywords. On-device embeddings.',
        emoji: '🔎', accent: '#4ade80', device: 'any', size: '~23 MB', tier: 'light',
        load: () => import('./tasks/semantic-search.js'),
    },
    {
        id: 'ner', title: 'Entity Finder', category: 'language',
        tagline: 'Pull out people, places, and organizations from text.',
        emoji: '🔖', accent: '#a3e635', device: 'any', size: '~108 MB', tier: 'medium',
        load: () => import('./tasks/ner.js'),
    },
    {
        id: 'fill-mask', title: 'Fill in the Blank', category: 'language',
        tagline: 'Let BERT guess the missing word. Mark it with [MASK].',
        emoji: '🧠', accent: '#fcd34d', device: 'any', size: '~110 MB', tier: 'medium',
        load: () => import('./tasks/fill-mask.js'),
    },
    {
        id: 'question-answering', title: 'Q&A', category: 'language',
        tagline: 'Paste text, ask a question, get the exact answer span. DistilBERT.',
        emoji: '❓', accent: '#67e8f9', device: 'any', size: '~65 MB', tier: 'light',
        load: () => import('./tasks/question-answering.js'),
    },
    {
        id: 'text-emotion', title: 'Emotion', category: 'language',
        tagline: 'Read the emotion behind text — joy, anger, fear, sadness and more.',
        emoji: '🎭', accent: '#f9a8d4', device: 'any', size: '~83 MB', tier: 'medium',
        load: () => import('./tasks/text-emotion.js'),
    },

    // ---- Chat ----
    {
        id: 'mini-chat', title: 'Mini Chat', category: 'chat',
        tagline: 'A tiny LLM that streams replies on ANY device. Qwen2.5.',
        emoji: '🤖', accent: '#38bdf8', badge: 'LLM', device: 'any', size: '~280 MB', tier: 'heavy',
        load: () => import('./tasks/mini-chat.js'),
    },
    {
        id: 'chat-premium', title: 'Pro Chat', category: 'chat',
        tagline: 'The full WebLLM assistant — RAG, voice, vision. Needs WebGPU.',
        emoji: '💎', accent: '#a78bfa', badge: 'WebGPU', device: 'webgpu', size: '0.5–4 GB', tier: 'heavy',
        load: () => import('./tasks/chat-premium.js'),
    },
];

// What each studio accepts as input / can hand off as output (for pipelines).
// in/out: 'text' | 'image' | 'audio' | 'none'
export const STUDIO_IO = {
    'object-detection': { in: 'image', out: 'none' },
    'zero-shot-detection': { in: 'image', out: 'none' },
    'image-classification': { in: 'image', out: 'none' },
    'zero-shot-image': { in: 'image', out: 'none' },
    'segmentation': { in: 'image', out: 'none' },
    'depth': { in: 'image', out: 'none' },
    'background-removal': { in: 'image', out: 'image' },
    'caption': { in: 'image', out: 'text' },
    'speech-to-text': { in: 'audio', out: 'text' },
    'text-to-speech': { in: 'text', out: 'none' },
    'audio-classification': { in: 'audio', out: 'none' },
    'sentiment': { in: 'text', out: 'none' },
    'text-emotion': { in: 'text', out: 'none' },
    'zero-shot-text': { in: 'text', out: 'none' },
    'question-answering': { in: 'text', out: 'text' },
    'summarize': { in: 'text', out: 'text' },
    'translate': { in: 'text', out: 'text' },
    'semantic-search': { in: 'text', out: 'none' },
    'ner': { in: 'text', out: 'none' },
    'fill-mask': { in: 'text', out: 'none' },
    'mini-chat': { in: 'text', out: 'text' },
    'chat-premium': { in: 'none', out: 'none' },
};

/** Studios that accept the given input kind via hand-off (excluding `exceptId`). */
export function handoffTargets(kind, exceptId) {
    return STUDIOS.filter((s) => s.id !== exceptId && STUDIO_IO[s.id]?.in === kind);
}

export function getStudio(id) {
    return STUDIOS.find((s) => s.id === id) || null;
}

export function studiosByCategory(catId) {
    return STUDIOS.filter((s) => s.category === catId);
}

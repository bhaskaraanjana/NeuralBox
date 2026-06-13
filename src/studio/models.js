// ============================================================
// NeuralBox Studio — central model catalog (single source of truth).
// Every model id / task / dtype / size lives here. Studios import the
// named specs and arrange them into their own tiers; tooling
// (scripts/model-doctor.mjs) and docs read the whole catalog.
// Update a model in ONE place.
// @typedef {import('./types.js').ModelSpec} ModelSpec
// ============================================================

const d = (webgpu, wasm) => ({ webgpu, wasm });

/** @type {Object<string, ModelSpec & {size?: string, license?: string}>} */
export const M = {
    // ---- Vision: detection ----
    detYolosTiny: { task: 'object-detection', model: 'Xenova/yolos-tiny', dtype: d('fp16', 'q8'), size: '~26 MB' },
    detYolosSmall: { task: 'object-detection', model: 'Xenova/yolos-small', dtype: d('fp16', 'q8'), size: '~62 MB' },
    detDetr: { task: 'object-detection', model: 'Xenova/detr-resnet-50', dtype: d('fp16', 'q8'), size: '~84 MB' },
    zsdOwlvit: { task: 'zero-shot-object-detection', model: 'Xenova/owlvit-base-patch32', dtype: d('q4f16', 'q8'), size: '~150 MB' },
    zsdOwlv2: { task: 'zero-shot-object-detection', model: 'Xenova/owlv2-base-patch16-ensemble', dtype: d('q4f16', 'q8'), size: '~155 MB' },

    // ---- Vision: classification ----
    clsResnet50: { task: 'image-classification', model: 'Xenova/resnet-50', dtype: d('fp16', 'q8'), size: '~25 MB' },
    clsVit: { task: 'image-classification', model: 'Xenova/vit-base-patch16-224', dtype: d('fp16', 'q8'), size: '~88 MB' },
    zsiClip32: { task: 'zero-shot-image-classification', model: 'Xenova/clip-vit-base-patch32', dtype: d('fp16', 'q8'), size: '~120 MB' },
    zsiClip16: { task: 'zero-shot-image-classification', model: 'Xenova/clip-vit-base-patch16', dtype: d('fp16', 'q8'), size: '~300 MB' },

    // ---- Vision: dense ----
    segB0: { task: 'image-segmentation', model: 'Xenova/segformer-b0-finetuned-ade-512-512', dtype: d('fp16', 'q8'), size: '~15 MB' },
    segB2: { task: 'image-segmentation', model: 'Xenova/segformer-b2-finetuned-ade-512-512', dtype: d('fp16', 'q8'), size: '~56 MB' },
    segB5: { task: 'image-segmentation', model: 'Xenova/segformer-b5-finetuned-ade-640-640', dtype: d('fp16', 'q8'), size: '~172 MB' },
    depthSmall: { task: 'depth-estimation', model: 'onnx-community/depth-anything-v2-small', dtype: d('fp16', 'q8'), size: '~30 MB' },
    depthBase: { task: 'depth-estimation', model: 'onnx-community/depth-anything-v2-base', dtype: d('fp16', 'q8'), size: '~102 MB' },
    bgRmbg: { model: 'briaai/RMBG-1.4', dtype: d('fp16', 'q8'), size: '~44 MB' }, // AutoModel (no pipeline task)
    capVitGpt2: { task: 'image-to-text', model: 'Xenova/vit-gpt2-image-captioning', dtype: d('fp16', 'q8'), size: '~90 MB' },
    capFlorence: { model: 'onnx-community/Florence-2-base', task: '<MORE_DETAILED_CAPTION>', size: '~340 MB' }, // Florence2 custom path

    // ---- Audio ----
    asrBaseEn: { task: 'automatic-speech-recognition', model: 'onnx-community/whisper-base.en', dtype: d('fp16', 'q8'), size: '~145 MB' },
    asrSmallEn: { task: 'automatic-speech-recognition', model: 'Xenova/whisper-small.en', dtype: d('fp16', 'q8'), size: '~480 MB' },
    asrDistilSmall: { task: 'automatic-speech-recognition', model: 'onnx-community/distil-small.en', dtype: d('fp16', 'q8'), size: '~330 MB' },
    asrBaseMulti: { task: 'automatic-speech-recognition', model: 'onnx-community/whisper-base', dtype: d('fp16', 'q8'), size: '~145 MB' },
    ttsKokoro: { model: 'onnx-community/Kokoro-82M-v1.0-ONNX', size: '~86 MB' }, // kokoro-js
    audAst: { task: 'audio-classification', model: 'Xenova/ast-finetuned-audioset-10-10-0.4593', dtype: d('fp32', 'q8'), size: '~120 MB' },

    // ---- Language ----
    txtSentiment: { task: 'text-classification', model: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', dtype: d('fp16', 'q8'), size: '~67 MB' },
    txtEmotion: { task: 'text-classification', model: 'Chi-Bi/emotion-text-classifier-onnx', dtype: d('q8', 'q8'), size: '~83 MB' },
    zstMobilebert: { task: 'zero-shot-classification', model: 'Xenova/mobilebert-uncased-mnli', dtype: d('fp16', 'q8'), size: '~95 MB' },
    zstDeberta: { task: 'zero-shot-classification', model: 'Xenova/nli-deberta-v3-small', dtype: d('fp16', 'q8'), size: '~172 MB' },
    qaDistilbert: { task: 'question-answering', model: 'Xenova/distilbert-base-cased-distilled-squad', dtype: d('fp16', 'q8'), size: '~67 MB' },
    qaRoberta: { task: 'question-answering', model: 'onnx-community/roberta-base-squad2-ONNX', dtype: d('fp16', 'q8'), size: '~125 MB' },
    sumCnn66: { task: 'summarization', model: 'Xenova/distilbart-cnn-6-6', dtype: d('fp16', 'q8'), size: '~145 MB' },
    sumCnn126: { task: 'summarization', model: 'Xenova/distilbart-cnn-12-6', dtype: d('fp16', 'q8'), size: '~360 MB' },
    sumXsum126: { task: 'summarization', model: 'Xenova/distilbart-xsum-12-6', dtype: d('fp16', 'q8'), size: '~360 MB' },
    embBge: { task: 'feature-extraction', model: 'Xenova/bge-small-en-v1.5', dtype: d('fp32', 'q8'), size: '~34 MB', queryPrefix: 'Represent this sentence for searching relevant passages: ' },
    embGte: { task: 'feature-extraction', model: 'Xenova/gte-small', dtype: d('fp32', 'q8'), size: '~34 MB' },
    embMini: { task: 'feature-extraction', model: 'Xenova/all-MiniLM-L6-v2', dtype: d('fp32', 'q8'), size: '~23 MB' },
    ner: { task: 'token-classification', model: 'Xenova/bert-base-NER', dtype: d('fp16', 'q8'), size: '~108 MB' },
    fillMask: { task: 'fill-mask', model: 'Xenova/bert-base-uncased', dtype: d('fp16', 'q8'), size: '~110 MB' },

    // Translation — Helsinki OPUS-MT (one model per direction).
    transEnFr: { task: 'translation', model: 'Xenova/opus-mt-en-fr', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transEnEs: { task: 'translation', model: 'Xenova/opus-mt-en-es', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transEnDe: { task: 'translation', model: 'Xenova/opus-mt-en-de', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transEnZh: { task: 'translation', model: 'Xenova/opus-mt-en-zh', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transEnRu: { task: 'translation', model: 'Xenova/opus-mt-en-ru', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transEnAr: { task: 'translation', model: 'Xenova/opus-mt-en-ar', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transFrEn: { task: 'translation', model: 'Xenova/opus-mt-fr-en', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transEsEn: { task: 'translation', model: 'Xenova/opus-mt-es-en', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transDeEn: { task: 'translation', model: 'Xenova/opus-mt-de-en', dtype: d('fp16', 'q8'), size: '~75 MB' },
    transRuEn: { task: 'translation', model: 'Xenova/opus-mt-ru-en', dtype: d('fp16', 'q8'), size: '~75 MB' },

    // ---- Chat (transformers.js text-generation, any device) ----
    chatLite: { task: 'text-generation', model: 'HuggingFaceTB/SmolLM2-360M-Instruct', dtype: d('q4f16', 'q4'), size: '~270 MB' },
    chatBalanced: { task: 'text-generation', model: 'onnx-community/Qwen2.5-0.5B-Instruct', dtype: d('q4f16', 'q4'), size: '~480 MB' },
    chatSmart: { task: 'text-generation', model: 'onnx-community/Llama-3.2-1B-Instruct', dtype: d('q4f16', 'q4'), size: '~750 MB' },
};

/** Look up the approx download size for a model id (for device guidance). */
export function sizeForModel(modelId) {
    const hit = Object.values(M).find((m) => m.model === modelId);
    return hit?.size || '';
}

/** Every model entry, for tooling (model-doctor) and docs. */
export function allModels() {
    return Object.entries(M).map(([key, m]) => ({ key, ...m }));
}

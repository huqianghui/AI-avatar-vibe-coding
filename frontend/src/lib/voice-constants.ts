import type { VoiceLiveInstanceCreate } from "@/types/voice-live";

/* ── Voice Name Options ──────────────────────────────────────────────── */

export const VOICE_NAME_OPTIONS = [
  { value: "en-US-AvaNeural", labelKey: "voiceAva", locale: "en-US" },
  { value: "en-US-Ava:DragonHDLatestNeural", labelKey: "voiceAvaHd", locale: "en-US" },
  { value: "en-US-AndrewNeural", labelKey: "voiceAndrew", locale: "en-US" },
  { value: "en-US-JennyNeural", labelKey: "voiceJenny", locale: "en-US" },
  {
    value: "zh-CN-XiaoxiaoMultilingualNeural",
    labelKey: "voiceXiaoxiaoMultilingual",
    locale: "zh-CN",
    multilingual: true,
  },
  { value: "zh-CN-XiaoxiaoNeural", labelKey: "voiceXiaoxiao", locale: "zh-CN" },
  { value: "zh-CN-YunxiNeural", labelKey: "voiceYunxi", locale: "zh-CN" },
  { value: "zh-CN-YunjianNeural", labelKey: "voiceYunjian", locale: "zh-CN" },
  { value: "es-ES-ElviraNeural", labelKey: "voiceElvira", locale: "es-ES" },
  { value: "es-ES-AlvaroNeural", labelKey: "voiceAlvaro", locale: "es-ES" },
  { value: "es-MX-DaliaNeural", labelKey: "voiceDalia", locale: "es-MX" },
  { value: "es-MX-JorgeNeural", labelKey: "voiceJorge", locale: "es-MX" },
  { value: "es-US-PalomaNeural", labelKey: "voicePaloma", locale: "es-US" },
  { value: "es-US-AlonsoNeural", labelKey: "voiceAlonso", locale: "es-US" },
] as const;

/**
 * Filters `VOICE_NAME_OPTIONS` to those matching the given recognition
 * language, plus any multilingual voice (which is always a valid pick
 * regardless of the selected language). Falls back to every option for
 * "auto" or an unrecognized locale (e.g. no options match that locale).
 */
export function voiceOptionsForLanguage(language: string) {
  const hasExactLocaleMatch = VOICE_NAME_OPTIONS.some((opt) => opt.locale === language);
  if (language === "auto" || !hasExactLocaleMatch) {
    return VOICE_NAME_OPTIONS;
  }
  return VOICE_NAME_OPTIONS.filter(
    (opt) => opt.locale === language || "multilingual" in opt,
  );
}

/* ── Turn Detection Types ────────────────────────────────────────────── */

export const TURN_DETECTION_TYPES = [
  { value: "server_vad", labelKey: "turnServerVad" },
  { value: "semantic_vad", labelKey: "turnSemanticVad" },
  { value: "azure_semantic_vad", labelKey: "turnAzureSemanticVad" },
  { value: "azure_semantic_vad_multilingual", labelKey: "turnAzureSemanticVadMultilingual" },
] as const;

/* ── Speech Recognition (Transcription) Models ───────────────────────── */

/**
 * Foundry Voice Live `session.input_audio_transcription.model` options --
 * distinct from the LLM "Model deployment" select (persona-hcp-foundry-
 * alignment Increment G).
 */
export const SPEECH_RECOGNITION_MODEL_OPTIONS = [
  { value: "azure-speech", labelKey: "speechRecognitionModelAzureSpeech" },
  { value: "whisper-1", labelKey: "speechRecognitionModelWhisper1" },
  { value: "gpt-4o-transcribe", labelKey: "speechRecognitionModelGpt4oTranscribe" },
  { value: "gpt-4o-mini-transcribe", labelKey: "speechRecognitionModelGpt4oMiniTranscribe" },
  {
    value: "gpt-4o-transcribe-diarize",
    labelKey: "speechRecognitionModelGpt4oTranscribeDiarize",
  },
  { value: "mai-transcribe-1", labelKey: "speechRecognitionModelMaiTranscribe1" },
] as const;

/* ── Recognition Languages ───────────────────────────────────────────── */

export const RECOGNITION_LANGUAGES = [
  { value: "auto", labelKey: "autoDetect" },
  { value: "zh-CN", labelKey: "langChinese" },
  { value: "en-US", labelKey: "langEnglish" },
  { value: "es-ES", labelKey: "langSpanishSpain" },
  { value: "es-MX", labelKey: "langSpanishMexico" },
  { value: "es-US", labelKey: "langSpanishUS" },
] as const;

/* ── Shared Voice Locales (HCP + Persona editors) ────────────────────── */

/** Locales with dedicated voice/UI copy support across the platform. */
export const SUPPORTED_VOICE_LOCALES = ["zh-CN", "en-US", "es-ES", "es-MX", "es-US"] as const;

/** Flag emoji per locale -- mirrors settings.tsx's Voice per Language card. */
export const LOCALE_FLAGS: Record<string, string> = {
  "zh-CN": "\u{1F1E8}\u{1F1F3}",
  "en-US": "\u{1F1FA}\u{1F1F8}",
  "es-ES": "\u{1F1EA}\u{1F1F8}",
  "es-MX": "\u{1F1F2}\u{1F1FD}",
  "es-US": "\u{1F1FA}\u{1F1F8}",
};

/** Maps locale code to its common.json `lang.*` sub-key. */
export const LOCALE_LABEL_KEY: Record<string, string> = {
  "zh-CN": "zhCN",
  "en-US": "enUS",
  "es-ES": "esES",
  "es-MX": "esMX",
  "es-US": "esUS",
};

/* ── Azure Avatar CDN ────────────────────────────────────────────────── */

/** CDN base URL for official Azure avatar preview images. */
export const CDN_BASE =
  "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/media";

/* ── Default VL Instance Form Factory ────────────────────────────────── */

/**
 * Factory function that returns a fresh default VoiceLiveInstanceCreate object.
 * Use this instead of a mutable constant to avoid shared-state bugs.
 */
export function createDefaultVlInstanceForm(): VoiceLiveInstanceCreate {
  return {
    name: "",
    description: "",
    voice_live_model: "gpt-4o",
    enabled: true,
    voice_name: "en-US-AvaNeural",
    voice_type: "azure-standard",
    voice_temperature: 0.9,
    voice_custom: false,
    avatar_character: "lori",
    avatar_style: "casual",
    avatar_customized: false,
    turn_detection_type: "server_vad",
    noise_suppression: false,
    echo_cancellation: false,
    eou_detection: false,
    recognition_language: "auto",
    model_instruction: "",
    response_temperature: 0.8,
    proactive_engagement: true,
    auto_detect_language: true,
    playback_speed: 1.0,
    custom_lexicon_enabled: false,
    custom_lexicon_url: "",
    avatar_enabled: true,
  };
}

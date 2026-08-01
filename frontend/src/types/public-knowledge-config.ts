export interface VoiceMapResponse {
  voice_map: Record<string, string>;
  defaults: Record<string, string>;
}

export interface VoiceMapUpdate {
  voice_map: Record<string, string>;
}

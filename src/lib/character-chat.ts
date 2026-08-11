import { getSupabaseClient } from "@/lib/supabase";

export interface ChatMemoryCandidateDto {
  memory_type: "player_fact" | "character_fact" | "relationship_fact" | "shared_event" | "promise" | "discovery";
  fact_key: string;
  fact_text: string;
  salience: number;
}

export interface ChatMessageDto {
  id: string;
  role: "player" | "character";
  content: string;
  generation_status: "pending" | "completed" | "failed" | null;
  error_class: "provider_error" | "validation_error" | "transport_error" | null;
  memory_candidates: ChatMemoryCandidateDto[];
  created_at: string;
}

export interface CharacterChatStateDto {
  thread: { id: string; player_run_id: string; run_branch_id: string; character_id: string };
  character: {
    id: string; name: string; role: string | null; description: string | null;
    storyRelationship: string | null;
  };
  content_language: "en" | "vi";
  messages: ChatMessageDto[];
}

async function requireAccessToken() {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return token;
}

async function chatRequest(body: Record<string, unknown>) {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
  const response = await fetch(`${base}/functions/v1/character-chat`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await requireAccessToken()}` },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error((result.error as string) ?? `character-chat failed with HTTP ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return result;
}

export async function openCharacterChat(playerRunId: string, characterId: string): Promise<CharacterChatStateDto> {
  return await chatRequest({ action: "open", player_run_id: playerRunId, character_id: characterId }) as unknown as CharacterChatStateDto;
}

export async function sendCharacterChatMessage(args: {
  threadId: string; messageId: string; content: string;
}) {
  return chatRequest({ action: "send", thread_id: args.threadId, message_id: args.messageId, content: args.content });
}

export async function promoteChatMemory(characterMessageId: string, candidateIndex: number) {
  const client = getSupabaseClient() as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("lw_promote_chat_memory", {
    p_character_message_id: characterMessageId,
    p_candidate_index: candidateIndex,
  });
  if (error) throw new Error(error.message);
  return data;
}

export function newChatMessageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

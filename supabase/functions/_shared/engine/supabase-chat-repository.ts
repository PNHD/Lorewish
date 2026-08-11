import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { assembleCharacterChatContext, CHAT_HISTORY_LIMIT, validateCharacterChatResult } from "./character-chat.ts";
import { ProviderOutputError, ProviderTransportError, type CharacterChatProvider, type ChatMessageContext } from "./types.ts";
import { SupabaseTurnRepository } from "./supabase-repository.ts";
import { BetaCapacityReachedError } from "./provider-budget.ts";

export class ChatGenerationError extends Error {
  constructor(readonly errorClass: "provider_error" | "validation_error" | "transport_error") {
    super(errorClass);
    this.name = "ChatGenerationError";
  }
}

export class ChatAllowanceExhaustedError extends Error {
  constructor(readonly resetAt: string) {
    super("CHAT_ALLOWANCE_EXHAUSTED");
    this.name = "ChatAllowanceExhaustedError";
  }
}

export class SupabaseCharacterChatRepository {
  private readonly userClient: SupabaseClient;
  private readonly serviceClient: SupabaseClient;
  private readonly turnRepository: SupabaseTurnRepository;

  constructor(
    supabaseUrl: string,
    anonKey: string,
    private readonly userJwt: string,
    serviceRoleKey: string,
  ) {
    this.userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });
    this.serviceClient = createClient(supabaseUrl, serviceRoleKey);
    this.turnRepository = new SupabaseTurnRepository(supabaseUrl, anonKey, userJwt, serviceRoleKey);
  }

  private async ownerUserId(): Promise<string> {
    const { data, error } = await this.userClient.auth.getUser(this.userJwt);
    if (error || !data.user) throw new Error("unauthenticated");
    return data.user.id;
  }

  async open(playerRunId: string, characterId: string) {
    const { data: thread, error } = await this.userClient.rpc("lw_get_or_create_chat_thread", {
      p_player_run_id: playerRunId,
      p_character_id: characterId,
    });
    if (error || !thread) throw new Error(error?.message ?? "chat_thread_failed");
    return this.loadThread(thread.id as string);
  }

  async loadThread(threadId: string) {
    const ownerUserId = await this.ownerUserId();
    const { data: thread, error } = await this.serviceClient
      .from("character_chat_threads")
      .select("*")
      .eq("id", threadId)
      .single();
    if (error || !thread) throw new Error("chat_thread_not_found");
    const { data: run } = await this.serviceClient
      .from("player_runs")
      .select("owner_user_id")
      .eq("id", thread.player_run_id)
      .single();
    if (!run || run.owner_user_id !== ownerUserId) throw new Error("forbidden");
    const { data: messages, error: messagesError } = await this.serviceClient
      .from("character_chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (messagesError) throw new Error("chat_history_failed");
    const inputs = await this.turnRepository.loadContextInputs(thread.player_run_id, thread.run_branch_id);
    const character = inputs.characters.find((item) => item.id === thread.character_id);
    if (!character) throw new Error("character_not_visible");
    return {
      thread: {
        id: thread.id,
        player_run_id: thread.player_run_id,
        run_branch_id: thread.run_branch_id,
        character_id: thread.character_id,
      },
      character,
      content_language: inputs.contentLanguage,
      messages: messages ?? [],
    };
  }

  async send(args: { threadId: string; messageId: string; content: string; provider: CharacterChatProvider }) {
    const ownerUserId = await this.ownerUserId();
    const { data: start, error: startError } = await this.serviceClient.rpc("lw_start_chat_generation", {
      p_owner_user_id: ownerUserId,
      p_thread_id: args.threadId,
      p_message_id: args.messageId,
      p_content: args.content,
    });
    if (startError || !start) throw new Error(startError?.message ?? "chat_start_failed");
    if (start.status === "CHAT_ALLOWANCE_EXHAUSTED") {
      throw new ChatAllowanceExhaustedError(start.reset_at as string);
    }
    if (start.status === "completed" || start.status === "in_flight") {
      return start;
    }
    const playerMessage = start.player_message;

    const threadState = await this.loadThread(args.threadId);
    const recentChat: ChatMessageContext[] = threadState.messages
      .filter((message: Record<string, unknown>) => message.id !== args.messageId && (message.role === "player" || message.role === "character"))
      .slice(-CHAT_HISTORY_LIMIT)
      .map((message: Record<string, unknown>) => ({ role: message.role as "player" | "character", content: message.content as string }));
    const inputs = await this.turnRepository.loadContextInputs(
      threadState.thread.player_run_id,
      threadState.thread.run_branch_id,
    );
    const context = assembleCharacterChatContext({
      inputs,
      characterId: threadState.thread.character_id,
      recentChat,
      playerMessage: args.content.trim(),
    });

    try {
      let call = await args.provider.generateChat(context);
      let validated = validateCharacterChatResult(call, context);
      if (!validated.ok) {
        const repairContext = {
          ...context,
          repairReason: "the reply was unsafe, malformed, or changed configured Vietnamese address terms",
        };
        call = await args.provider.generateChat(repairContext);
        validated = validateCharacterChatResult(call, repairContext);
      }
      if (!validated.ok) {
        await this.fail(ownerUserId, args.messageId, validated.errorClass, validated.metadata);
        throw new ChatGenerationError("validation_error");
      }
      const { data, error } = await this.serviceClient.rpc("lw_commit_chat_generation", {
        p_owner_user_id: ownerUserId,
        p_player_message_id: args.messageId,
        p_character_message_id: crypto.randomUUID(),
        p_reply: validated.result.reply,
        p_memory_candidates: validated.result.chat_memory_candidates,
        p_provider: validated.metadata.provider,
        p_model: validated.metadata.model,
        p_input_tokens: validated.metadata.inputTokens,
        p_output_tokens: validated.metadata.outputTokens,
        p_provider_cost_micros: validated.metadata.costMicros,
        p_latency_ms: validated.metadata.latencyMs,
      });
      if (error) throw new Error(error.message);
      return { player_message: playerMessage, character_message: data };
    } catch (error) {
      if (error instanceof ChatGenerationError) throw error;
      if (error instanceof BetaCapacityReachedError) {
        await this.fail(ownerUserId, args.messageId, "capacity_reached");
        throw error;
      }
      const metadata = error instanceof ProviderOutputError ? error.metadata : undefined;
      const errorClass = error instanceof ProviderOutputError
        ? "validation_error"
        : error instanceof ProviderTransportError
          ? "transport_error"
          : "provider_error";
      await this.fail(ownerUserId, args.messageId, errorClass, metadata);
      throw new ChatGenerationError(errorClass);
    }
  }

  private async fail(ownerUserId: string, messageId: string, errorClass: "provider_error" | "validation_error" | "transport_error" | "capacity_reached", metadata?: {
    provider: string; model: string; inputTokens: number; outputTokens: number; costMicros: number; latencyMs: number;
  }) {
    await this.serviceClient.rpc("lw_fail_chat_generation", {
      p_owner_user_id: ownerUserId,
      p_player_message_id: messageId,
      p_error_class: errorClass,
      p_provider: metadata?.provider ?? null,
      p_model: metadata?.model ?? null,
      p_input_tokens: metadata?.inputTokens ?? null,
      p_output_tokens: metadata?.outputTokens ?? null,
      p_provider_cost_micros: metadata?.costMicros ?? null,
      p_latency_ms: metadata?.latencyMs ?? null,
    });
  }
}

# Explicit Chat-to-canon promotion contract

1. Chat generation may return a small candidate with an allowed memory type, ASCII snake-case fact key, bounded text, and salience 1-5.
2. The candidate remains non-canonical inside the Character reply.
3. The player explicitly selects **Remember in story**.
4. `lw_promote_chat_memory(character_message_id, candidate_index)` validates run ownership, active exact branch, thread/Character binding, completed Character message, candidate bounds/schema, and existing exact supersession key.
5. The RPC inserts one Character-scoped `canon_facts` row with source Chat thread/message provenance.

Promotion never calls the model again, copies a raw transcript, creates a Scene, crosses a branch, invents a Character, changes address terms/identity, or supersedes an unrelated fact.

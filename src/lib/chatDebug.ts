/**
 * Developer-facing chat isolation debug mode.
 *
 * Enable with `?debug=chat` in the URL or `localStorage.setItem("agy_debug_chat","1")`.
 * It verifies, for every loaded thread, that:
 *   1. the thread key is derived from the exact participant pair (+ optional deal context)
 *   2. every message returned involves the signed-in user as sender or recipient
 * Any message that fails the check is dropped from the UI and reported, so a
 * cross-user leak can never be rendered.
 */

export interface ChatAuditMessage {
  id: string;
  thread_key: string;
  sender_id: string;
  recipient_id: string;
}

export interface ChatAuditResult {
  threadKey: string | null;
  expectedKey: string | null;
  keyMatches: boolean;
  total: number;
  kept: number;
  leaked: ChatAuditMessage[];
}

export function isChatDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("debug") === "chat") {
      localStorage.setItem("agy_debug_chat", "1");
    }
    return localStorage.getItem("agy_debug_chat") === "1";
  } catch {
    return false;
  }
}

/** Messages a signed-in user is allowed to see: only their own conversations. */
export function isParticipant(msg: ChatAuditMessage, userId: string): boolean {
  return msg.sender_id === userId || msg.recipient_id === userId;
}

export function auditThread(
  messages: ChatAuditMessage[],
  userId: string,
  threadKey: string | null,
  expectedKey: string | null,
): ChatAuditResult {
  const leaked = messages.filter(
    (m) => !isParticipant(m, userId) || (threadKey ? m.thread_key !== threadKey : false),
  );
  return {
    threadKey,
    expectedKey,
    keyMatches: threadKey === expectedKey,
    total: messages.length,
    kept: messages.length - leaked.length,
    leaked,
  };
}

export function reportAudit(scope: string, result: ChatAuditResult) {
  if (!isChatDebugEnabled()) return;
  const ok = result.keyMatches && result.leaked.length === 0;
  // eslint-disable-next-line no-console
  console[ok ? "info" : "error"](
    `[chat-debug:${scope}] key=${result.threadKey} expected=${result.expectedKey} ` +
      `match=${result.keyMatches} messages=${result.kept}/${result.total} leaked=${result.leaked.length}`,
    ok ? "" : result.leaked,
  );
}

/**
 * Structured actions the AI voice assistant can execute.
 *
 * The AI embeds an action block in its response using the delimiter
 * |||ACTION:{...}|||  — the store parses it, strips it from the spoken
 * text, and executes the matching operation against the CartStore.
 */

export type VoiceAction =
  | { type: 'add_to_cart'; itemName: string; quantity: number; modifiers?: Record<string, string[]>; instructions?: string }
  | { type: 'remove_from_cart'; itemName: string }
  | { type: 'update_quantity'; itemName: string; quantity: number }
  | { type: 'set_item_note'; itemName: string; note: string }
  | { type: 'clear_cart' }
  | { type: 'view_cart' }
  | { type: 'apply_promo'; code: string }
  | { type: 'set_delivery_notes'; notes: string }
  | { type: 'confirm_order' }
  | { type: 'set_address'; address: string }
  | { type: 'none' };

export interface ActionResult {
  success: boolean;
  message: string;
  /** The action that was attempted — useful for UI feedback. */
  action: VoiceAction;
}

/**
 * Levenshtein distance between two strings (case-insensitive).
 * Used for fuzzy item-name matching so the AI doesn't need to
 * produce a byte-exact menu name every time.
 */
export function levenshtein(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  const m = al.length;
  const n = bl.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        al[i - 1] === bl[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Find the best-matching menu item name within a tolerance.
 * Returns the MenuItem name if a close-enough match exists, else null.
 *
 * Strategy (in priority order):
 *  1. Exact match (case-insensitive)
 *  2. Substring / "includes" match
 *  3. Levenshtein distance ≤ 30 % of the target name length
 */
export function fuzzyMatchItemName(
  query: string,
  menuNames: string[],
): string | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  // 1) Exact match
  const exact = menuNames.find(n => n.toLowerCase() === q);
  if (exact) return exact;

  // 2) Substring match — menu name contains query or vice-versa
  const includes = menuNames.find(
    n => n.toLowerCase().includes(q) || q.includes(n.toLowerCase()),
  );
  if (includes) return includes;

  // 3) Levenshtein within 30 % tolerance
  let bestName: string | null = null;
  let bestDist = Infinity;
  for (const name of menuNames) {
    const dist = levenshtein(q, name);
    const threshold = Math.ceil(name.length * 0.3);
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      bestName = name;
    }
  }
  return bestName;
}

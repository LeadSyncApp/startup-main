/**
 * TelegramSurfaceAdapter
 *
 * Surfaces active ConversationalRules that have `surfaceConfig.enabled = true`
 * as Telegram bot commands (via setMyCommands) and as inline-keyboard buttons
 * (callback_data = rule id) on outbound messages.
 *
 * Surfacing is orthogonal to a rule's triggerType: a rule can be both
 * keyword/RAG-matched AND tapped via a button/command.
 */

import { prisma } from "../../lib/prisma";
import { decryptSecret } from "../../utils/encryption";
import { MAX_SURFACED_RULES } from "./conversationalRule.constants";

const TELEGRAM_API = "https://api.telegram.org/bot";

const BASE_COMMANDS = [
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Get support" },
];

// Per-company debounce timer so a burst of rule edits triggers one setMyCommands call.
const syncTimers = new Map<string, NodeJS.Timeout>();

export interface SurfacedRule {
  id: string;
  command: string;
  buttonLabel: string;
  menuPosition: number;
  parentRuleId?: string | null;
}

function isSurfaced(rule: any): rule is { id: string; surfaceConfig: any } {
  if (rule.isEnabled === false || !rule.surfaceConfig || typeof rule.surfaceConfig !== "object") {
    return false;
  }
  const config = rule.surfaceConfig;
  const showAsButton = config.showAsButton !== undefined ? !!config.showAsButton : !!config.enabled;
  const showAsCommand = config.showAsCommand !== undefined ? !!config.showAsCommand : !!config.enabled;

  return (
    (showAsButton || showAsCommand) &&
    typeof config.command === "string" &&
    typeof config.buttonLabel === "string"
  );
}

export class TelegramSurfaceAdapter {
  /**
   * Fetch active surfaced rules for a company, ordered by menuPosition.
   * If parentRuleId is undefined, returns all rules (for command sync).
   * If parentRuleId is specified, filters rules belonging to that parent level.
   */
  async getActiveSurfacedRules(
    companyId: string,
    parentRuleId?: string | null,
    surfaceType: "BUTTON" | "COMMAND" | "ANY" = "ANY"
  ): Promise<SurfacedRule[]> {
    const rules = await prisma.conversationalRule.findMany({
      where: {
        companyId,
        isEnabled: true,
      },
      select: { id: true, surfaceConfig: true, isEnabled: true },
    });

    return rules
      .filter(isSurfaced)
      .filter((r) => {
        const config = r.surfaceConfig as any;
        const showAsButton = config.showAsButton !== undefined ? !!config.showAsButton : !!config.enabled;
        const showAsCommand = config.showAsCommand !== undefined ? !!config.showAsCommand : !!config.enabled;

        if (surfaceType === "BUTTON" && !showAsButton) return false;
        if (surfaceType === "COMMAND" && !showAsCommand) return false;
        if (surfaceType === "ANY" && !showAsButton && !showAsCommand) return false;

        if (parentRuleId === undefined) return true;
        const pId = config.parentRuleId || null;
        const targetId = parentRuleId || null;
        return pId === targetId;
      })
      .map((r) => ({
        id: r.id,
        command: (r.surfaceConfig as any).command as string,
        buttonLabel: (r.surfaceConfig as any).buttonLabel as string,
        menuPosition: Number((r.surfaceConfig as any).menuPosition ?? 0),
        parentRuleId: (r.surfaceConfig as any).parentRuleId || null,
      }))
      .sort((a, b) => a.menuPosition - b.menuPosition);
  }

  /**
   * Build a Telegram inline_keyboard payload from active surfaced rules.
   * Layout: 2 buttons per row, plus a Back button if inside a category submenu.
   */
  buildInlineKeyboard(
    rules: SurfacedRule[],
    parentRuleId?: string | null,
    grandparentId?: string | null
  ): { inline_keyboard: { text: string; callback_data: string }[][] } | null {
    const capped = [...rules]
      .sort((a, b) => a.menuPosition - b.menuPosition)
      .slice(0, MAX_SURFACED_RULES);

    if (capped.length === 0 && !parentRuleId) return null;

    const buttons = capped.map((r) => ({ text: r.buttonLabel, callback_data: r.id }));
    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }

    if (parentRuleId) {
      const backCallback = grandparentId ? grandparentId : "back_root";
      rows.push([{ text: "⬅️ Back", callback_data: backCallback }]);
    }

    return { inline_keyboard: rows };
  }

  /**
   * Build navigation buttons for a Leaf response message.
   */
  buildLeafKeyboard(parentRuleId: string | null): { inline_keyboard: { text: string; callback_data: string }[][] } {
    const rows: { text: string; callback_data: string }[][] = [];
    const backCallback = parentRuleId ? parentRuleId : "back_root";

    if (parentRuleId) {
      rows.push([
        { text: "⬅️ Back", callback_data: backCallback },
        { text: "🏠 Main Menu", callback_data: "back_root" },
      ]);
    } else {
      rows.push([{ text: "🏠 Main Menu", callback_data: "back_root" }]);
    }
    return { inline_keyboard: rows };
  }

  /**
   * Push the current command menu to Telegram for a company.
   * Merges BASE_COMMANDS with surfaced rule commands (dedup by command string).
   */
  async syncCommands(companyId: string): Promise<void> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { telegramBotToken: true, telegramConnected: true },
    });
    if (!company?.telegramConnected || !company.telegramBotToken) return;

    const surfaced = await this.getActiveSurfacedRules(companyId, undefined, "COMMAND");

    const commands = [...BASE_COMMANDS];
    for (const r of surfaced) {
      const cleanCmd = r.command.startsWith("/") ? r.command.slice(1) : r.command;
      if (!commands.some((c) => c.command === cleanCmd)) {
        commands.push({ command: cleanCmd, description: r.buttonLabel.slice(0, 256) });
      }
    }

    const token = decryptSecret(company.telegramBotToken);
    await axiosPost(`${TELEGRAM_API}${token}/setMyCommands`, { commands });
  }

  /**
   * Debounced sync — coalesces multiple rapid edits into one API call.
   */
  scheduleSync(companyId: string, delayMs = 1000): void {
    const existing = syncTimers.get(companyId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      syncTimers.delete(companyId);
      this.syncCommands(companyId).catch((err) =>
        console.error(`[TelegramSurface] sync failed for ${companyId}:`, err.message)
      );
    }, delayMs);
    syncTimers.set(companyId, timer);
  }

  /**
   * Acknowledge a tapped inline button so Telegram clears its loading spinner.
   */
  async answerCallbackQuery(companyId: string, callbackQueryId: string): Promise<void> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { telegramBotToken: true },
    });
    if (!company?.telegramBotToken) return;
    const token = decryptSecret(company.telegramBotToken);
    await axiosPost(`${TELEGRAM_API}${token}/answerCallbackQuery`, { callback_query_id: callbackQueryId });
  }
}

async function axiosPost(url: string, body: any): Promise<void> {
  const axios = (await import("axios")).default;
  const res = await axios.post(url, body);
  if (!(res.data as any).ok) {
    throw new Error(`Telegram API error: ${JSON.stringify((res.data as any).description)}`);
  }
}

export const telegramSurfaceAdapter = new TelegramSurfaceAdapter();

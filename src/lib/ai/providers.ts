import {
  AiProviderType,
  AiProviderConfig,
  AiPromptPayload,
  AiGenerationResult,
} from "./types";

export interface IAiProviderAdapter {
  providerType: AiProviderType;
  generateText(payload: AiPromptPayload, config?: Partial<AiProviderConfig>): Promise<AiGenerationResult>;
  generateStructuredJson<T>(
    payload: AiPromptPayload,
    schemaDescription?: string,
    config?: Partial<AiProviderConfig>
  ): Promise<{ data: T; result: AiGenerationResult }>;
}

export class LocalRulesAiProvider implements IAiProviderAdapter {
  public providerType: AiProviderType = "local_rules";

  public async generateText(payload: AiPromptPayload): Promise<AiGenerationResult> {
    return {
      text: `[Rule Engine Decision]: Processed prompt. Context records: ${Object.keys(payload.contextData || {}).length}`,
      confidence: 0.95,
      tokensUsed: { prompt: 100, completion: 40, total: 140 },
      model: "tanvir-agro-rules-v20",
      provider: "local_rules",
    };
  }

  public async generateStructuredJson<T>(payload: AiPromptPayload): Promise<{ data: T; result: AiGenerationResult }> {
    const fallbackData = (payload.contextData?.fallback || {}) as T;
    return {
      data: fallbackData,
      result: await this.generateText(payload),
    };
  }
}

export class OpenAiProviderAdapter implements IAiProviderAdapter {
  public providerType: AiProviderType = "openai";

  constructor(private apiKey?: string, private defaultModel: string = "gpt-4o-mini") {}

  public async generateText(
    payload: AiPromptPayload,
    config?: Partial<AiProviderConfig>
  ): Promise<AiGenerationResult> {
    const key = config?.apiKey || this.apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      return new LocalRulesAiProvider().generateText(payload);
    }

    const model = config?.modelName || this.defaultModel;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: payload.systemPrompt },
            {
              role: "user",
              content: `${payload.userPrompt}\n\n[Data Context]: ${JSON.stringify(payload.contextData || {})}`,
            },
          ],
          temperature: payload.temperature ?? config?.temperature ?? 0.2,
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const choice = json.choices?.[0];
      return {
        text: choice?.message?.content || "",
        confidence: 0.92,
        tokensUsed: {
          prompt: json.usage?.prompt_tokens || 0,
          completion: json.usage?.completion_tokens || 0,
          total: json.usage?.total_tokens || 0,
        },
        model,
        provider: "openai",
      };
    } catch (e) {
      console.warn("[OpenAI Provider] Fallback to LocalRules due to error:", e);
      return new LocalRulesAiProvider().generateText(payload);
    }
  }

  public async generateStructuredJson<T>(
    payload: AiPromptPayload,
    schemaDescription?: string,
    config?: Partial<AiProviderConfig>
  ): Promise<{ data: T; result: AiGenerationResult }> {
    const enrichedPrompt = {
      ...payload,
      systemPrompt: `${payload.systemPrompt}\nIMPORTANT: Reply ONLY with valid raw JSON adhering to schema: ${schemaDescription || "JSON"}. Do not surround with markdown backticks.`,
    };
    const genResult = await this.generateText(enrichedPrompt, config);
    try {
      const cleanJson = genResult.text.replace(/^```json/i, "").replace(/```$/i, "").trim();
      const data = JSON.parse(cleanJson) as T;
      return { data, result: genResult };
    } catch {
      return { data: (payload.contextData?.fallback || {}) as T, result: genResult };
    }
  }

}

export class AnthropicProviderAdapter implements IAiProviderAdapter {
  public providerType: AiProviderType = "anthropic";

  constructor(private apiKey?: string, private defaultModel: string = "claude-3-5-haiku-20241022") {}

  public async generateText(
    payload: AiPromptPayload,
    config?: Partial<AiProviderConfig>
  ): Promise<AiGenerationResult> {
    const key = config?.apiKey || this.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return new LocalRulesAiProvider().generateText(payload);
    }

    const model = config?.modelName || this.defaultModel;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: config?.maxTokens || 1024,
          system: payload.systemPrompt,
          messages: [
            {
              role: "user",
              content: `${payload.userPrompt}\n\n[Data Context]: ${JSON.stringify(payload.contextData || {})}`,
            },
          ],
          temperature: payload.temperature ?? config?.temperature ?? 0.2,
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const content = json.content?.[0]?.text || "";
      return {
        text: content,
        confidence: 0.94,
        tokensUsed: {
          prompt: json.usage?.input_tokens || 0,
          completion: json.usage?.output_tokens || 0,
          total: (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0),
        },
        model,
        provider: "anthropic",
      };
    } catch (e) {
      console.warn("[Anthropic Provider] Fallback to LocalRules due to error:", e);
      return new LocalRulesAiProvider().generateText(payload);
    }
  }

  public async generateStructuredJson<T>(
    payload: AiPromptPayload,
    schemaDescription?: string,
    config?: Partial<AiProviderConfig>
  ): Promise<{ data: T; result: AiGenerationResult }> {
    const enrichedPrompt = {
      ...payload,
      systemPrompt: `${payload.systemPrompt}\nIMPORTANT: Reply ONLY with valid raw JSON adhering to schema: ${schemaDescription || "JSON"}. Do not surround with markdown backticks.`,
    };
    const genResult = await this.generateText(enrichedPrompt, config);
    try {
      const cleanJson = genResult.text.replace(/^```json/i, "").replace(/```$/i, "").trim();
      const data = JSON.parse(cleanJson) as T;
      return { data, result: genResult };
    } catch {
      return { data: (payload.contextData?.fallback || {}) as T, result: genResult };
    }
  }
}

export class AiProviderFactory {
  private static adapters: Map<AiProviderType, IAiProviderAdapter> = new Map();

  public static getAdapter(type?: AiProviderType): IAiProviderAdapter {
    const provider = type || (process.env.DEFAULT_AI_PROVIDER as AiProviderType) || "local_rules";

    if (!this.adapters.has(provider)) {
      switch (provider) {
        case "openai":
          this.adapters.set(provider, new OpenAiProviderAdapter());
          break;
        case "anthropic":
          this.adapters.set(provider, new AnthropicProviderAdapter());
          break;
        default:
          this.adapters.set("local_rules", new LocalRulesAiProvider());
          break;
      }
    }

    return this.adapters.get(provider) || new LocalRulesAiProvider();
  }
}


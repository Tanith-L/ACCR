// Type for the built-in AI session the Supabase Edge Runtime provides as a global
// (https://supabase.com/docs/guides/functions/ai-models). Only what Rheumy uses:
// gte-small text embeddings. Declared here because `deno check` doesn't pick up the
// runtime's own declaration file from jsr.
declare namespace Supabase {
  namespace ai {
    interface ModelOptions {
      /** Pool embeddings by taking their mean (gte-small only). */
      mean_pool?: boolean;
      /** Normalize the embedding (gte-small only). */
      normalize?: boolean;
    }
    class Session {
      constructor(model: "gte-small");
      run(input: string, options?: ModelOptions): Promise<unknown>;
    }
  }
}

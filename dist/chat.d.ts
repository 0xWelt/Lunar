export declare class Chat {
    language: string;
    model: string;
    temperature: number;
    max_tokens: number;
    private openai;
    constructor();
    reviewPatch: (patch: string) => Promise<string | null>;
}

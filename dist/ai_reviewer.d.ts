export declare class Chat {
    private openai;
    private review_prompt;
    constructor();
    reviewPatch: (patch: string) => Promise<string | null>;
}
export declare class AIReviewer {
    private octokit;
    private repo;
    private pull_request;
    constructor();
    main(): Promise<void>;
}
export declare function run(): Promise<void>;

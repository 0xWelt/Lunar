export declare class Chat {
    private language;
    private openai;
    private model;
    constructor(model: string);
    reviewPatch: (patch: string) => Promise<string | null | undefined>;
}
export declare class AIReviewer {
    private model;
    private octokit;
    private repo;
    private pull_request;
    constructor();
    main(): Promise<void>;
}
export declare function run(): Promise<void>;

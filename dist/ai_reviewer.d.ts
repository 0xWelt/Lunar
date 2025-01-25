export declare class AIReviewer {
    private repo;
    private pull_request;
    private trigger;
    private octokit;
    private chat;
    constructor();
    main(): Promise<void>;
}
export declare function run(): Promise<void>;

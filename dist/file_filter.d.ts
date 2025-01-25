interface File {
    filename: string;
    status: string;
    contents_url: string;
}
export declare const filterFile: (file: File) => boolean;
export {};

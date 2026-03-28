export interface ContainerConfig {
    projectId: string;
    image: string;
    name: string;
    port?: number;
}
export interface Container {
    id: string;
    name: string;
    status: 'running' | 'stopped' | 'error';
    image: string;
    projectId: string;
}
export declare const DOCKER_IMAGES: {
    id: string;
    name: string;
    description: string;
}[];
export declare function createContainer(config: ContainerConfig): Promise<Container>;
export declare function startContainer(projectId: string): Promise<Container>;
export declare function stopContainer(projectId: string): Promise<void>;
export declare function removeContainer(projectId: string): Promise<void>;
export declare function executeInContainer(projectId: string, command: string, workdir?: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
export declare function copyFilesToContainer(projectId: string, files: {
    name: string;
    content: string;
}[]): Promise<void>;
export declare function getContainerStatus(projectId: string): Promise<Container | null>;
export declare function getProjectContainer(projectId: string): Container | undefined;
//# sourceMappingURL=dockerService.d.ts.map
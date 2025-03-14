interface recorderConfig {
    sampleBits?: number,        // 采样位数
    sampleRate?: number,        // 采样率
    numChannels?: number,       // 声道数
    compiling?: boolean,        // 是否边录边播
    silenceDurationNotify?: number, // 沉默秒数通知
    volumeThreshold?: number // 音量阈值，低于此值不录音
}

interface dataview {
    byteLength: number,
    buffer: {
        byteLength: number,
    },
    getUint8: any,
}

declare class Recorder {
    private isrecording: boolean;
    private isplaying: boolean;
    private ispause: boolean;
    private context: any;
    protected config: recorderConfig;
    private size: number;
    private lBuffer: Array<Float32Array>;
    private rBuffer: Array<Float32Array>;
    private PCM: any;
    private tempPCM: Array<DataView>;
    private audioInput: any;
    private inputSampleRate: number;
    private inputSampleBits: number;
    private outputSampleRate: number;
    private oututSampleBits: number;
    private analyser: any;
    private source: any;
    private recorder: any;
    private stream: any;
    private littleEdian: boolean;
    private prevDomainData: any;
    private playStamp: number;
    private playTime: number;
    private offset: number;
    private needRecord: boolean;

    public fileSize: number;
    public duration: number;

    public onprocess: (duration: number) => void;
    public onprogress: (payload: {
        duration: number,
        fileSize: number,
        vol: number,
        speaking: boolean,
    }) => void;

    public onplay: () => void;
    public onpauseplay: () => void;
    public onresumeplay: () => void;
    public onstopplay: () => void;
    public onplayend: () => void;
    public onsilence: () => void;

    constructor(options?: recorderConfig);

    public setOption: (options?: recorderConfig) => void
    protected setNewOption(options?: recorderConfig): void;

    initRecorder(): void;
    start(): Promise<{}>;
    pause(): void;
    resume(): void;
    stop(): void;
    play(): void;
    getPlayTime(): number;
    pausePlay(): void;
    resumePlay(): void;
    stopPlay(): void;
    destroy(): Promise<{}>;

    startRecord(): Promise<{}>;
    pauseRecord(): void;
    resumeRecord(): void;
    stopRecord(): void;
    destroyRecord(): Promise<{}>;

    getWholeData(): any;
    getNextData(): any;
    getRecordAnalyseData(): any;
    getPlayAnalyseData(): any;
    getPCMBlob(): any;
    downloadPCM(name: string): void;
    getWAVBlob(): any;
    downloadWAV(name: string): void;
    static playAudio(blob): void;
    static compress(data, inputSampleRate: number, outputSampleRate: number);
    static encodePCM(bytes, sampleBits: number, littleEdian: boolean);
    static encodeWAV(bytes: dataview, inputSampleRate: number, outputSampleRate: number, numChannels: number, oututSampleBits: number, littleEdian: boolean): any;
    static throwError(message: string): void;
    static getPermission(): Promise<{}>;
}

type UserName = string

export default Recorder

export default abstract class ValueSerializerDelegate {
  close(): void {}

  abstract throwDataCloneError(message: string): void;

  abstract writeHostObject(object: object): boolean | null;

  abstract getSharedArrayBufferId(
    sharedArrayBuffer: SharedArrayBuffer
  ): number | null;

  abstract getWasmModuleTransferId(module: WebAssembly.Module): number | null;

  abstract adoptSharedValueConveyer(conveyer: any[]): boolean;

  abstract reallocateBufferMemory(
    oldBuffer: Uint8Array,
    size: number,
    actualSize: (v: number) => any
  ): Uint8Array;

  abstract freeBufferMemory(buffer: Uint8Array): void;
}

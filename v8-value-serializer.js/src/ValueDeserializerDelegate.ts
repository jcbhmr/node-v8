export default abstract class ValueDeserializerDelegate {
  close(): void {}

  abstract readHostObject(): object | null;

  abstract getWasmModuleFromId(transferId: number): WebAssembly.Module | null;

  abstract getSharedArrayBufferFromId(
    cloneId: number
  ): SharedArrayBuffer | null;

  abstract getSharedValueConveyer(): any[];
}

// https://github.com/v8/v8/blob/main/src/objects/value-serializer.cc
// https://github.com/v8/v8/blob/main/include/v8-value-serializer.h

import { CurrentValueSerializerFormatVersion } from "./value-serializer-version.js";

export const kLatestVersion = 15;
console.assert(
  kLatestVersion === CurrentValueSerializerFormatVersion(),
  "Exported format version must match latest version."
);

export function BytesNeededForVariant(value: number): number {
  console.assert(
    Number.isSafeInteger(value) && value >= 0,
    "Only unsigned integer types can be written as varints."
  );
  let result = 0;
  do {
    result++;
    value >>= 7;
  } while (value);
  return result;
}

export enum SerializationTag {
  kVersion = "\xFF",
  kPadding = "\0",
  kVerifyObjectCount = "?",
  kTheHole = "-",
  kUndefined = "_",
  kNull = "0",
  kTrue = "T",
  kFalse = "F",
  kInt32 = "I",
  kUint32 = "U",
  kDouble = "N",
  kBigInt = "Z",
  kUtf8String = "S",
  kOneByteString = '"',
  kTwoByteString = "c",
  kObjectReference = "^",
  kBeginJSObject = "o",
  kEndJSObject = "{",
  kBeginSparseJSArray = "a",
  kEndSparseJSArray = "@",
  kBeginDenseJSArray = "A",
  kEndDenseJSArray = "$",
  kDate = "D",
  kTrueObject = "y",
  kFalseObject = "x",
  kNumberObject = "n",
  kBigIntObject = "z",
  kStringObject = "s",
  kRegExp = "R",
  kBeginJSMap = ";",
  kEndJSMap = ":",
  kBeginJSSet = "'",
  kEndJSSet = ",",
  kArrayBuffer = "B",
  kResizableArrayBuffer = "~",
  kArrayBufferTransfer = "t",
  kArrayBufferView = "V",
  kSharedArrayBuffer = "u",
  kSharedObject = "p",
  kWasmModuleTransfer = "w",
  kHostObject = "\\",
  kWasmMemoryTransfer = "m",
  kError = "r",
  kLegacyReservedMessagePort = "M",
  kLegacyReservedBlob = "b",
  kLegacyReservedBlobIndex = "i",
  kLegacyReservedFile = "f",
  kLegacyReservedFileIndex = "e",
  kLegacyReservedDOMFileSystem = "d",
  kLegacyReservedFileList = "l",
  kLegacyReservedFileListIndex = "L",
  kLegacyReservedImageData = "#",
  kLegacyReservedImageBitmap = "g",
  kLegacyReservedImageBitmapTransfer = "G",
  kLegacyReservedOffscreenCanvas = "H",
  kLegacyReservedCryptoKey = "K",
  kLegacyReservedRTCCertificate = "k",
}

enum ArrayBufferViewTag {
  kInt8Array = "b",
  kUint8Array = "B",
  kUint8ClampedArray = "C",
  kInt16Array = "w",
  kUint16Array = "W",
  kInt32Array = "d",
  kUint32Array = "D",
  kFloat32Array = "f",
  kFloat64Array = "F",
  kBigInt64Array = "q",
  kBigUint64Array = "Q",
  kDataView = "?",
}

enum ErrorTag {
  kEvalErrorPrototype = "E",
  kRangeErrorPrototype = "R",
  kReferenceErrorPrototype = "F",
  kSyntaxErrorPrototype = "S",
  kTypeErrorPrototype = "T",
  kUriErrorPrototype = "U",
  kMessage = "m",
  kCause = "c",
  kStack = "s",
  kEnd = ".",
}

export class ValueSerializer {
  treat_array_buffer_views_as_host_objects_ = false;
  buffer_ = new Uint8Array();
  buffer_size_ = 0;
  buffer_capacity_ = 0;
  constructor() {}

  close(): void {}

  WriteHeader(): void {
    this.WriteTag(SerializationTag.kVersion);
    this.WriteVariant(kLatestVersion);
  }

  SetTreatArrayBufferViewsAsHostObjects(mode: boolean): void {
    this.treat_array_buffer_views_as_host_objects_ = mode;
  }

  WriteTag(tag: SerializationTag): void {
    const raw_tag = tag.charCodeAt(0);
    this.WriteRawBytes(Uint8Array.of(raw_tag));
  }

  WriteVariant(value: number): void {
    console.assert(
      Number.isSafeInteger(value) && value >= 0,
      "Only unsigned integer types can be written as varints."
    );
    const stack_buffer = new Uint8Array((64 * 8) / 7 + 1);
    let next_byte = 0;
    do {
      stack_buffer[next_byte] = (value & 0x7f) | 0x80;
      next_byte++;
      value >>= 7;
    } while (value);
    stack_buffer[next_byte - 1] &= 0x7f;
    this.WriteRawBytes(stack_buffer);
  }

  WriteZigZag(value: number): void {
    console.assert(
      Number.isSafeInteger(value),
      "Only signed integer types can be written as zigzag."
    );
    this.WriteVariant(((value >>> 0) << 1) ^ (value >> (8 * 32 - 1)));
  }

  WriteDouble(value: number): void {
    this.WriteRawBytes(Float64Array.of(value));
  }

  WriteOneByteString(value: string): void {
    this.WriteRawBytes(Uint8Array.from(value, (c) => c.charCodeAt(0)));
  }

  WriteTwoByteString(value: string): void {
    this.WriteRawBytes(Uint16Array.from(value, (c) => c.charCodeAt(0)));
  }

  WriteBigIntContents(value: bigint): void {
    const bitfield = BigInt_getBitFieldForSerialization(value);
    const byteLength = BigInt_digitsByteLengthForSerialization(bitfield);
    this.WriteVarint(bitfield);
    let dest: Uint8Array | null;
    if ((dest = this.ReserveRawBytes(byteLength))) {
      BigInt_serializeDigits(dest);
    }
  }

  WriteRawBytes(value: ArrayBufferView): void {
    let dest: Uint8Array | null;
    if ((dest = this.ReserveRawBytes(value.byteLength)) && length > 0) {
      // @ts-ignore
      dest.set(value);
    }
  }

  ReserveRawBytes(bytes: number): Uint8Array | null {
    const old_size = this.buffer_size_;
    const new_size = old_size + bytes;
    if (new_size > this.buffer_capacity_) {
      let ok: boolean;
      if (!(ok = this.ExpandBuffer(new_size))) {
        return null;
      }
    }
    this.buffer_size_ = new_size;
    return this.buffer_.subarray(old_size, new_size);
  }
}

export {};

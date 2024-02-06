import { MessageTemplate, RegExpPrototypeGetFlagsBitfield, BigIntPrototypeGetBitfieldForSerialization, BigIntDigitsByteLengthForBitfield, BigIntPrototypeSerializeDigits, realloc, isSmi, ObjectPrototypeInstanceType, InstanceTypeChecker, InstanceType, StringFlatten, StringPrototypeGetFlatContent, isSpecialReceiverInstanceType, isCallable, ArrayPrototypeHasHoleyElements, isJSTypedArray } from "./h.js"

export const LATEST_VERSION = 15;

export function bytesNeededForVariantUint32(value: number) {
  let result = 0;
  do {
    result++;
    value >>= 7;
  } while (value);
  return result;
}

export enum SerializationTag {
  Version = 0xff,
  Padding = "\0".charCodeAt(0),
  VerifyObjectCount = "?".charCodeAt(0),
  TheHole = "-".charCodeAt(0),
  Undefined = "_".charCodeAt(0),
  Null = "0".charCodeAt(0),
  True = "T".charCodeAt(0),
  False = "F".charCodeAt(0),
  Int32 = "I".charCodeAt(0),
  Uint32 = "U".charCodeAt(0),
  Double = "N".charCodeAt(0),
  BigInt = "Z".charCodeAt(0),
  Utf8String = "S".charCodeAt(0),
  OneByteString = '"'.charCodeAt(0),
  TwoByteString = "c".charCodeAt(0),
  ObjectReference = "^".charCodeAt(0),
  BeginJSObject = "o".charCodeAt(0),
  EndJSObject = "{".charCodeAt(0),
  BeginSparseJSArray = "a".charCodeAt(0),
  EndSparseJSArray = "@".charCodeAt(0),
  BeginDenseJSArray = "A".charCodeAt(0),
  EndDenseJSArray = "$".charCodeAt(0),
  Date = "D".charCodeAt(0),
  TrueObject = "y".charCodeAt(0),
  FalseObject = "x".charCodeAt(0),
  NumberObject = "n".charCodeAt(0),
  BigIntObject = "z".charCodeAt(0),
  StringObject = "s".charCodeAt(0),
  RegExp = "R".charCodeAt(0),
  BeginJSMap = ";".charCodeAt(0),
  EndJSMap = ":".charCodeAt(0),
  BeginJSSet = "'".charCodeAt(0),
  EndJSSet = ",".charCodeAt(0),
  ArrayBuffer = "B".charCodeAt(0),
  ResizableArrayBuffer = "~".charCodeAt(0),
  ArrayBufferTransfer = "t".charCodeAt(0),
  ArrayBufferView = "V".charCodeAt(0),
  SharedArrayBuffer = "u".charCodeAt(0),
  SharedObject = "p".charCodeAt(0),
  WasmModuleTransfer = "w".charCodeAt(0),
  HostObject = "\\".charCodeAt(0),
  WasmMemoryTransfer = "m".charCodeAt(0),
  Error = "r".charCodeAt(0),
  LegacyReservedMessagePort = "M".charCodeAt(0),
  LegacyReservedBlob = "b".charCodeAt(0),
  LegacyReservedBlobIndex = "i".charCodeAt(0),
  LegacyReservedFile = "f".charCodeAt(0),
  LegacyReservedFileIndex = "e".charCodeAt(0),
  LegacyReservedDOMFileSystem = "d".charCodeAt(0),
  LegacyReservedFileList = "l".charCodeAt(0),
  LegacyReservedFileListIndex = "L".charCodeAt(0),
  LegacyReservedImageData = "#".charCodeAt(0),
  LegacyReservedImageBitmap = "g".charCodeAt(0),
  LegacyReservedImageBitmapTransfer = "G".charCodeAt(0),
  LegacyReservedOffscreenCanvas = "H".charCodeAt(0),
  LegacyReservedCryptoKey = "K".charCodeAt(0),
  LegacyReservedRTCCertificate = "k".charCodeAt(0),
}

export enum ArrayBufferViewTag {
  Int8Array = "b".charCodeAt(0),
  Uint8Array = "B".charCodeAt(0),
  Uint8ClampedArray = "C".charCodeAt(0),
  Int16Array = "w".charCodeAt(0),
  Uint16Array = "W".charCodeAt(0),
  Int32Array = "d".charCodeAt(0),
  Uint32Array = "D".charCodeAt(0),
  Float32Array = "f".charCodeAt(0),
  Float64Array = "F".charCodeAt(0),
  BigInt64Array = "q".charCodeAt(0),
  BigUint64Array = "Q".charCodeAt(0),
  DataView = "?".charCodeAt(0),
}

export enum ErrorTag {
  EvalErrorPrototype = "E".charCodeAt(0),
  RangeErrorPrototype = "R".charCodeAt(0),
  ReferenceErrorPrototype = "F".charCodeAt(0),
  SyntaxErrorPrototype = "S".charCodeAt(0),
  TypeErrorPrototype = "T".charCodeAt(0),
  UriErrorPrototype = "U".charCodeAt(0),
  Message = "m".charCodeAt(0),
  Cause = "c".charCodeAt(0),
  Stack = "s".charCodeAt(0),
  End = ".".charCodeAt(0),
}

export class ValueSerializer {
  #treatArrayBufferViewsAsHostObjects = false
  #buffer: ArrayBuffer | null = null
  #bufferCapacity = 0
  #bufferSize = 0
  #outOfMemory = false
  #delegate: any | null = null
  #arrayBufferTransferMap = new Map<ArrayBuffer, number>
  #idMap = new Map<any, number>
  #nextId = 0
  #hasCustomHostObjects = false
  constructor(delegate: any) {
    if (delegate != null) this.#delegate = delegate
    if (this.#delegate) {
      this.#hasCustomHostObjects = this.#delegate.hasCustomHostObjects()
    }
  }

  [Symbol.dispose]() {
    if (this.#buffer) {
      if (this.#delegate) {
        this.#delegate.freeBufferMemory(this.#buffer)
      } else {
        this.#buffer = null
      }
    }
  }

  writeHeader() {
    this.writeTag(SerializationTag.Version);
    this.writeVariantUint32(LATEST_VERSION);
  }

  set treatArrayBufferViewsAsHostObjects(v: boolean) {
    this.#treatArrayBufferViewsAsHostObjects = v;
  }

  writeTag(tag: SerializationTag) {
    const rawTag = tag as number;
    this.writeRawBytes(Uint8Array.of(tag));
  }

  writeVariantUint8(value: number) {
    const stackBuffer = new Uint8Array(1 * 8 / 7 + 1);
    let nextByteStackBufferIndex = 0;
    do {
      stackBuffer[nextByteStackBufferIndex] = (value & 0x7f) | 0x80;
      nextByteStackBufferIndex++;
      value >>= 7;
    } while (value);
    stackBuffer[nextByteStackBufferIndex - 1] &= 0x7f;
    this.writeRawBytes(stackBuffer.subarray(0, nextByteStackBufferIndex));
  }
  writeVariantUint32(value: number) {
    const stackBuffer = new Uint8Array(4 * 8 / 7 + 1);
    let nextByteStackBufferIndex = 0;
    do {
      stackBuffer[nextByteStackBufferIndex] = (value & 0x7f) | 0x80;
      nextByteStackBufferIndex++;
      value >>= 7;
    } while (value);
    stackBuffer[nextByteStackBufferIndex - 1] &= 0x7f;
    this.writeRawBytes(stackBuffer.subarray(0, nextByteStackBufferIndex));
  }
  writeVariantBigUint64(value: bigint) {
    const stackBuffer = new Uint8Array(8 * 8 / 7 + 1)
    let nextByteStackBufferIndex = 0;
    do {
      stackBuffer[nextByteStackBufferIndex] = Number((value & 0x7fn) | 0x80n);
      nextByteStackBufferIndex++;
      value >>= 7n;
    } while (value);
    stackBuffer[nextByteStackBufferIndex - 1] &= 0x7f;
    this.writeRawBytes(stackBuffer.subarray(0, nextByteStackBufferIndex));
  }

  writeZigZagInt32(value: number) {
    this.writeVariantUint32(((value | 0) << 1) ^ (value >> (8 * 4 - 1)));
  }

  writeDouble(value: number) {
    this.writeRawBytes(new Uint8Array(Float64Array.of(value)));
  }

  writeOneByteString(chars: Uint8Array) {
    this.writeVariantUint32(chars.length);
    this.writeRawBytes(chars);
  }

  writeTwoByteString(chars: Uint16Array) {
    this.writeVariantUint32(chars.length * 2);
    this.writeRawBytes(
      new Uint8Array(chars.buffer, chars.byteOffset, chars.byteLength),
    );
  }

  writeBigIntContents(bigint: bigint) {
    const bitfield = BigIntPrototypeGetBitfieldForSerialization(bigint);
    const bytelength = BigIntDigitsByteLengthForBitfield(bitfield);
    this.writeVariantUint32(bitfield);
    const dest = this.reserveRawBytes(bytelength);
    if (dest) {
      BigIntPrototypeSerializeDigits(bigint, dest);
    }
  }

  writeRawBytes(source: Uint8Array) {
    const dest = this.reserveRawBytes(source.length);
    if (dest) {
      dest.set(source);
    }
  }

  reserveRawBytes(bytes: number) {
    const oldSize = this.#bufferSize;
    const newSize = oldSize + bytes;
    if (newSize > this.#bufferCapacity) {
      if (!this.expandBuffer(newSize)) {
        return null;
      }
    }
    this.#bufferSize = newSize;
    return new Uint8Array(this.#buffer, oldSize, bytes);
  }

  expandBuffer(requiredCapacity: number) {
    const requestedCapacity =
      Math.max(requiredCapacity, this.#bufferCapacity * 2) + 64;
    let providedCapacity = 0;
    let newBuffer = null;
    if (this.#delegate) {
      [newBuffer, providedCapacity] = this.#delegate.reallocateBufferMemory(
        this.#buffer,
        requestedCapacity,
        providedCapacity,
      );
    } else {
      newBuffer = realloc(this.#buffer, requestedCapacity);
      providedCapacity = requestedCapacity;
    }
    if (newBuffer) {
      this.#buffer = newBuffer;
      this.#bufferCapacity = providedCapacity;
      return true;
    } else {
      this.#outOfMemory = true;
      return null;
    }
  }

  writeByte(value: number) {
    const dest = this.reserveRawBytes(1);
    if (dest) {
      dest[0] = value;
    }
  }

  writeUint32(value: number) {
    this.writeVariantUint32(value);
  }

  writeBigUint64(value: bigint) {
    this.writeVariantBigUint64(value);
  }

  release() {
    const result = new Uint8Array(this.#buffer!, 0, this.#bufferSize);
    this.#buffer = null;
    this.#bufferSize = 0;
    this.#bufferCapacity = 0;
    return result;
  }

  transferArrayBuffer(transferId: number, arrayBuffer: ArrayBuffer) {
    this.#arrayBufferTransferMap.set(arrayBuffer, transferId);
  }

  writeObject(object: any) {
    this.throwIfOutOfMemory();

    if (isSmi(object)) {
      this.writeSmi(object);
      this.throwIfOutOfMemory();
      return;
    }

    const instanceType = ObjectPrototypeInstanceType(object);
    switch (instanceType) {
      case InstanceType.ODDBALL_TYPE:
        this.writeOddball(object);
        this.throwIfOutOfMemory();
        return;
      case InstanceType.HEAP_NUMBER_TYPE:
        this.writeHeapNumber(object);
        this.throwIfOutOfMemory();
        return;
      case InstanceType.BIGINT_TYPE:
        this.writeBigInt(object);
        this.throwIfOutOfMemory();
        return;
      case InstanceType.JS_TYPED_ARRAY_TYPE:
      case InstanceType.JS_DATA_VIEW_TYPE:
      case InstanceType.JS_RAB_GSAB_DATA_VIEW_TYPE: {
        const view = object as ArrayBufferView;
        if (
          !this.#idMap.get(view) &&
          !this.#treatArrayBufferViewsAsHostObjects
        ) {
          const buffer = view.buffer;
          if (!this.writeJSReceiver(buffer)) {
            return null;
          }
        }
        return this.writeJSReceiver(view);
      }
      default:
        if (InstanceTypeChecker.isString(instanceType)) {
          this.writeString(object);
          this.throwIfOutOfMemory();
          return;
        } else if (InstanceTypeChecker.isString(instanceType)) {
          return this.writeJSReceiver(object);
        } else {
          this.throwDataCloneError(MessageTemplate.DataCloneError, object);
        }
    }
  }

  writeOddball(oddball: undefined | false | true | null) {
    let tag = SerializationTag.Undefined;
    if (oddball === undefined) {
      tag = SerializationTag.Undefined;
    } else if (oddball === false) {
      tag = SerializationTag.False;
    } else if (oddball === true) {
      tag = SerializationTag.True;
    } else if (oddball === null) {
      tag = SerializationTag.Null;
    }
    this.writeTag(tag);
  }

  writeSmi(smi: number) {
    this.writeTag(SerializationTag.Int32);
    this.writeZigZagInt32(smi);
  }

  writeHeapNumber(number: number) {
    this.writeTag(SerializationTag.Double);
    this.writeDouble(number);
  }

  writeBigInt(bigint: bigint) {
    this.writeTag(SerializationTag.BigInt);
    this.writeBigIntContents(bigint);
  }

  writeString(string: string) {
    string = StringFlatten(string);
    const flat = StringPrototypeGetFlatContent(string);
    if (flat.isOneByte()) {
      const chars = flat.toOneByteVector();
      this.writeTag(SerializationTag.OneByteString);
      this.writeOneByteString(chars);
    } else if (flat.isTwoByte()) {
      const chars = flat.toUC16Vector();
      const byteLength = chars.length * 2;
      if ((this.#bufferSize + 1 + bytesNeededForVariantUint32(byteLength)) & 1) {
        this.writeTag(SerializationTag.Padding);
      }
      this.writeTag(SerializationTag.TwoByteString);
      this.writeTwoByteString(chars);
    }
  }

  writeJSReceiver(receiver: any) {
    const findResult = this.#idMap.get(receiver);
    if (findResult) {
      this.writeTag(SerializationTag.ObjectReference);
      this.writeVariantUint32(findResult - 1);
      this.throwIfOutOfMemory();
      return;
    }

    const id = this.#nextId++;
    this.#idMap.set(receiver, id + 1);

    const instanceType = ObjectPrototypeInstanceType(receiver);
    if (
      isCallable(receiver) ||
      (isSpecialReceiverInstanceType(instanceType) &&
        instanceType !== InstanceType.JS_SPECIAL_API_OBJECT_TYPE)
    ) {
      this.throwDataCloneError(MessageTemplate.DataCloneError, receiver);
    }

    switch (instanceType) {
      case InstanceType.JS_ARRAY_TYPE:
        return this.writeJSArray(receiver);
      case InstanceType.JS_ARRAY_ITERATOR_PROTOTYPE_TYPE:
      case InstanceType.JS_ITERATOR_PROTOTYPE_TYPE:
      case InstanceType.JS_MAP_ITERATOR_PROTOTYPE_TYPE:
      case InstanceType.JS_OBJECT_PROTOTYPE_TYPE:
      case InstanceType.JS_OBJECT_TYPE:
      case InstanceType.JS_PROMISE_PROTOTYPE_TYPE:
      case InstanceType.JS_REG_EXP_PROTOTYPE_TYPE:
      case InstanceType.JS_SET_ITERATOR_PROTOTYPE_TYPE:
      case InstanceType.JS_SET_PROTOTYPE_TYPE:
      case InstanceType.JS_STRING_ITERATOR_PROTOTYPE_TYPE:
      case InstanceType.JS_TYPED_ARRAY_PROTOTYPE_TYPE:
      case InstanceType.JS_API_OBJECT_TYPE: {
        const jsObject = receiver as object;
        const isHostObject = this.isHostObject(jsObject);
        if (isHostObject == null) {
          return isHostObject;
        }
        if (isHostObject) {
          return this.writeHostObject(jsObject);
        } else {
          return this.writeJSObject(jsObject);
        }
      }
      case InstanceType.JS_SPECIAL_API_OBJECT_TYPE:
        return this.writeHostObject(receiver);
      case InstanceType.JS_DATE_TYPE:
        this.writeJSDate(receiver);
        this.throwIfOutOfMemory();
        return;
      case InstanceType.JS_PRIMITIVE_WRAPPER_TYPE:
        return this.writeJSPrimitiveWrapper(receiver);
      case InstanceType.JS_REG_EXP_TYPE:
        this.writeJSRegExp(receiver);
        this.throwIfOutOfMemory();
        return;
      case InstanceType.JS_MAP_TYPE:
        return this.writeJSMap(receiver);
      case InstanceType.JS_SET_TYPE:
        return this.writeJSSet(receiver);
      case InstanceType.JS_ARRAY_BUFFER_TYPE:
        return this.writeArrayBufferType(receiver);
      case InstanceType.JS_TYPED_ARRAY_TYPE:
      case InstanceType.JS_DATA_VIEW_TYPE:
      case InstanceType.JS_RAB_GSAB_DATA_VIEW_TYPE:
        return this.writeJSArrayBufferView(receiver);
      case InstanceType.JS_ERROR_TYPE:
        return this.writeJSError(receiver);
      case InstanceType.JS_SHARED_ARRAY_TYPE:
        return this.writeJSSharedArray(receiver);
      case InstanceType.JS_SHARED_STRUCT_TYPE:
        return this.writeJSSharedStruct(receiver);
      case InstanceType.JS_ATOMICS_MUTEX_TYPE:
      case InstanceType.JS_ATOMICS_CONDITION_TYPE:
        return this.writeSharedObject(receiver);
      case InstanceType.WASM_MODULE_OBJECT_TYPE:
        return this.writeWASMModule(receiver);
      case InstanceType.WASM_MEMORY_OBJECT_TYPE:
        return this.writeWASMMemory(receiver);
      default:
        break;
    }

    this.throwDataCloneError(MessageTemplate.DataCloneError, receiver);
  }

  writeJSObject(object: object) {
    return this.writeJSObjectSlow(object);
  }

  writeJSObjectSlow(object: object) {
    this.writeTag(SerializationTag.BeginJSObject);
    let propertiesWritten = 0;
    const keys = Object.getOwnPropertyNames(object);
    if (
      !keys ||
      (propertiesWritten = this.writeJSObjectPropertiesSlow(object, keys)) ==
      null
    ) {
      return null;
    }
    this.writeTag(SerializationTag.EndJSObject);
    this.writeVariantUint32(propertiesWritten);
    this.throwIfOutOfMemory();
  }

  writeJSArray(array: any[]) {
    const length = array.length;

    const shouldSerializeDensely = !ArrayPrototypeHasHoleyElements(array);

    if (shouldSerializeDensely) {
      this.writeTag(SerializationTag.BeginDenseJSArray);
      this.writeVariantUint32(length);
      let i = 0;
    } else {
      this.writeTag(SerializationTag.BeginSparseJSArray);
      this.writeVariantUint32(length);
      const keys = Object.getOwnPropertyNames(array);
      let propertiesWritten = 0;
      if (
        !keys ||
        (propertiesWritten = this.writeJSObjectPropertiesSlow(array, keys)) ==
        null
      ) {
        return null;
      }
      this.writeTag(SerializationTag.EndSparseJSArray);
      this.writeVariantUint32(propertiesWritten);
      this.writeVariantUint32(length);
    }
    this.throwIfOutOfMemory();
  }

  writeJSDate(date: Date) {
    this.writeTag(SerializationTag.Date);
    this.writeDouble(date.valueOf());
  }

  writeJSPrimitiveWrapper(value: String | Boolean | Number | Symbol | BigInt) {
    const innerValue = value.valueOf();
    if (innerValue === true) {
      this.writeTag(SerializationTag.TrueObject);
    } else if (innerValue === false) {
      this.writeTag(SerializationTag.FalseObject);
    } else if (typeof innerValue === "number") {
      this.writeTag(SerializationTag.NumberObject);
      this.writeDouble(innerValue);
    } else if (typeof innerValue === "bigint") {
      this.writeTag(SerializationTag.BigIntObject);
      this.writeBigIntContents(innerValue);
    } else if (typeof innerValue === "string") {
      this.writeTag(SerializationTag.StringObject);
      this.writeString(innerValue);
    } else {
      this.throwDataCloneError(MessageTemplate.DataCloneError, value);
    }
    this.throwIfOutOfMemory();
  }

  writeJSRegExp(regexp: RegExp) {
    this.writeTag(SerializationTag.RegExp);
    this.writeString(regexp.source);
    this.writeVariantUint32(RegExpPrototypeGetFlagsBitfield(regexp));
  }

  writeJSMap(jsMap: Map<any, any>) {
    const table = new Map(jsMap);
    const length = table.size * 2;
    const entries = new Array(length);
    {
      let resultIndex = 0;
      for (const [key, value] of entries) {
        entries[resultIndex++] = key;
        entries[resultIndex++] = value;
      }
    }

    this.writeTag(SerializationTag.BeginJSMap);
    for (let i = 0; i < length; i++) {
      if (!this.writeObject(entries[i])) {
        return null;
      }
    }
    this.writeTag(SerializationTag.EndJSMap);
    this.writeVariantUint32(length);
    this.throwIfOutOfMemory();
  }

  writeJSSet(jsSet: Set<any>) {
    const table = new Set(jsSet);
    const length = table.size;
    const entries = [...table];

    this.writeTag(SerializationTag.BeginJSSet);
    for (let i = 0; i < length; i++) {
      if (!this.writeObject(entries[i])) {
        return null;
      }
    }
    this.writeTag(SerializationTag.EndJSSet);
    this.writeVariantUint32(length);
    this.throwIfOutOfMemory();
  }

  writeJSArrayBuffer(arrayBuffer: ArrayBuffer) {
    if ((arrayBuffer) instanceof SharedArrayBuffer) {
      if (!this.#delegate) {
        return this.throwDataCloneError(
          MessageTemplate.DataCloneError,
          arrayBuffer,
        );
      }

      let index: number | null;
      try {
        index = this.#delegate.getSharedArrayBufferId(arrayBuffer);
      } catch (error) {
        return null;
      }

      this.writeTag(SerializationTag.SharedArrayBuffer);
      this.writeVariantUint32(index);
      this.throwIfOutOfMemory();
      return;
    }

    const transferEntry = this.#arrayBufferTransferMap.get(arrayBuffer);
    if (transferEntry) {
      this.writeTag(SerializationTag.ArrayBufferTransfer);
      this.writeVariantUint32(transferEntry);
      this.throwIfOutOfMemory();
      return;
    }
    if (arrayBuffer.detached) {
      this.throwDataCloneError(
        MessageTemplate.DataCloneErrorDetachedArrayBuffer,
      );
    }
    const byteLength = arrayBuffer.byteLength;
    if (byteLength > 2 ** 32 - 1) {
      return this.throwDataCloneError(
        MessageTemplate.DataCloneError,
        arrayBuffer,
      );
    }
    if (arrayBuffer.resizable) {
      const maxByteLength = arrayBuffer.maxByteLength;
      if (maxByteLength > 2 ** 32 - 1) {
        this.throwDataCloneError(MessageTemplate.DataCloneError, arrayBuffer);
      }

      this.writeTag(SerializationTag.ResizableArrayBuffer);
      this.writeVariantUint32(byteLength);
      this.writeVariantUint32(maxByteLength);
      this.writeRawBytes(new Uint8Array(arrayBuffer));
      this.throwIfOutOfMemory();
      return;
    }
    this.writeTag(SerializationTag.ArrayBuffer);
    this.writeVariantUint32(byteLength);
    this.writeRawBytes(new Uint8Array(arrayBuffer));
    this.throwIfOutOfMemory();
  }

  writeJSArrayBufferView(view: ArrayBufferView) {
    if (this.#treatArrayBufferViewsAsHostObjects) {
      return this.writeHostObject(view);
    }
    this.writeTag(SerializationTag.ArrayBufferView);
    let tag = ArrayBufferViewTag.Int8Array;
    if (isJSTypedArray(view)) {
      switch (view.constructor) {
        case Uint8Array:
          tag = ArrayBufferViewTag.Uint8Array;
          break;
        case Uint8ClampedArray:
          tag = ArrayBufferViewTag.Uint8ClampedArray;
          break;
        case Int8Array:
          tag = ArrayBufferViewTag.Int8Array;
          break;
        case Uint16Array:
          tag = ArrayBufferViewTag.Uint16Array;
          break;
        case Int16Array:
          tag = ArrayBufferViewTag.Int16Array;
          break;
        case Uint32Array:
          tag = ArrayBufferViewTag.Uint32Array;
          break;
        case Int32Array:
          tag = ArrayBufferViewTag.Int32Array;
          break;
        case BigUint64Array:
          tag = ArrayBufferViewTag.BigUint64Array;
          break;
        case BigInt64Array:
          tag = ArrayBufferViewTag.BigInt64Array;
          break;
        case Float32Array:
          tag = ArrayBufferViewTag.Float32Array;
          break;
        case Float64Array:
          tag = ArrayBufferViewTag.Float64Array;
          break;
      }
    } else {
      if (view.buffer instanceof SharedArrayBuffer) {
        this.throwDataCloneError(MessageTemplate.DataCloneError, view);
      }

      tag = ArrayBufferViewTag.DataView;
    }
    this.writeVariantUint8(tag);
    this.writeVariantUint32(view.byteOffset);
    this.writeVariantUint32(view.byteLength);
    const flags = 0;
    this.writeVariantUint32(flags);
    this.throwIfOutOfMemory();
  }

  writeJSError(error: Error | DOMException) {
    const stack = error.stack;
    const message = error.message;
    const cause = error.cause;

    this.writeTag(SerializationTag.Error);

    const name = error.name;
    if (name == null) {
      return null;
    }

    if (name === "EvalError") {
      this.writeVariantUint8(ErrorTag.EvalErrorPrototype);
    } else if (name === "RangeError") {
      this.writeVariantUint8(ErrorTag.RangeErrorPrototype);
    } else if (name === "ReferenceError") {
      this.writeVariantUint8(ErrorTag.ReferenceErrorPrototype);
    } else if (name === "SyntaxError") {
      this.writeVariantUint8(ErrorTag.SyntaxErrorPrototype);
    } else if (name === "TypeError") {
      this.writeVariantUint8(ErrorTag.TypeErrorPrototype);
    } else if (name === "URIError") {
      this.writeVariantUint8(ErrorTag.UriErrorPrototype);
    } else {
      // Nothing. Error prototype is the default.
    }

    if (message != null) {
      this.writeVariantUint8(ErrorTag.Message);
      this.writeString(message);
    }

    if (stack != null) {
      this.writeVariantUint8(ErrorTag.Stack);
      this.writeString(stack);
    }

    if (cause != null) {
      this.writeVariantUint8(ErrorTag.Cause);
      if (!this.writeObject(cause)) {
        return null;
      }
    }

    this.writeVariantUint8(ErrorTag.End);
    this.throwIfOutOfMemory();
  }

  writeJSSharedStruct(sharedStruct: object) {
    return this.writeSharedObject(sharedStruct);
  }

  writeJSSharedArray(sharedArray: any[]) {
    return this.writeSharedObject(sharedArray);
  }

  writeWASMModule(object: WebAssembly.Module) {
    if (this.#delegate == null) {
      this.throwDataCloneError(MessageTemplate.DataCloneError, object);
    }

    let transferId: number;
    try {
      transferId = this.#delegate.getWASMModuleTransferId(object);
    } catch (error) {
      return null;
    }
    const id = transferId;
    if (id != null) {
      this.writeTag(SerializationTag.WasmModuleTransfer);
      this.writeVariantUint32(id);
      return true;
    }
    this.throwIfOutOfMemory();
  }

  writeWASMMemory(object: WebAssembly.Memory) {
    if (object.buffer instanceof SharedArrayBuffer) {
      return this.throwDataCloneError(MessageTemplate.DataCloneError, object);
    }

    this.writeTag(SerializationTag.WasmMemoryTransfer);
    this.writeZigZagInt32(object.buffer.byteLength / (64 * 1024));
    this.writeByte(0);
    return this.writeJSReceiver(object.buffer);
  }

  writeSharedObject(object: object) {
    if (!this.#delegate || typeof SharedArrayBuffer === "undefined") {
      return this.throwDataCloneError(MessageTemplate.DataCloneError, object)
    }

    throw new DOMException("Not implemented", "NotSupportedError")
  }

  writeHostObject(object: object) {
    this.writeTag(SerializationTag.HostObject)
    if (!this.#delegate) {
      throw new Error(MessageTemplate.DataCloneError.replace("%s", object as any))
      return null
    }
    let result: boolean | null
    try {
      result = this.#delegate.writeHostObject(object)
    } catch (error) {
      return null
    }
    return this.throwIfOutOfMemory()
  }

  writeJSObjectPropertiesSlow(object: object, keys: string[]) {
    let propertiesWritten = 0
    const length = keys.length
    for (let i = 0; i < length; i++) {
      const key = keys[i]

      const value = (object as any)[key]
      
      if (!(this.writeObject(key) ?? false) || !(this.writeObject(value) ?? false)) {
        return null
      }

      propertiesWritten++
    }
    return propertiesWritten
  }

  isHostObject(jsObject: object) {
    if (!this.#hasCustomHostObjects) {
      return false
    }

    let result: boolean | null
    try {
      result = this.#delegate.isHostObject(jsObject)
    } catch (error) {
      return null
    }

    if (this.#outOfMemory) return this.throwIfOutOfMemory()
    return result
  }

  throwIfOutOfMemory() {
    if (this.#outOfMemory) {
      return this.throwDataCloneError(MessageTemplate.DataCloneErrorOutOfMemory);
    }
    return true;
  }

  throwDataCloneError(index: MessageTemplate, arg0?: any): boolean | null {
    const message = index.replace("%s", arg0);
    if (this.#delegate) {
      this.#delegate.throwDataCloneError(message);
    } else {
      throw new Error(message);
    }
    return null;
  }
}
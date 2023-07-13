import ValueSerializerDelegate from "./ValueSerializerDelegate.js";
import {
  BigInt_digitsByteLengthForSerialization,
  BigInt_getBitFieldForSerialization,
  BigInt_serializeDigits,
  SerializationTag,
  latestVersion,
} from "./internal/index.js";

/**
 * Value serialization compatible with the HTML structured clone algorithm. The
 * format is backward-compatible (i.e. safe to store to disk).
 *
 * Writes V8 objects in a binary format that allows the objects to be cloned
 * according to the HTML structured clone algorithm.
 *
 * Format is based on Blink's previous serialization logic.
 *
 * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L65
 * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L50
 * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L264
 */
export default class ValueSerializer {
  readonly #delegate: ValueSerializerDelegate | null;
  #buffer: Uint8Array | null = null;
  #bufferSize = 0;
  #bufferCapacity = 0;
  #treatArrayBufferViewsAsHostObjects = false;
  #outOfMemory = false;
  #nextId = 0;
  #sharedObjectConveyer: any[] | null = null;
  #arrayBufferTransferMap = new Map<number, ArrayBuffer>();
  #idMap = new Map<any, number>();
  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L139
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L52
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L264
   */
  constructor();
  constructor(delegate: ValueSerializerDelegate);
  constructor(delegate?: ValueSerializerDelegate) {
    this.#delegate = delegate ?? null;
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L141
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L53
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L273
   */
  close(): void {
    if (this.#buffer) {
      if (this.#delegate) {
        this.#delegate.freeBufferMemory(this.#buffer);
      } else {
        this.#buffer = null;
      }
    }
  }

  /**
   * Writes out a header, which includes the format version.
   *
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L146
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L60
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L283
   */
  writeHeader(): void {
    this.writeTag(SerializationTag.version);
    this.writeVariant_uint32(latestVersion);
  }

  /**
   * Indicate whether to treat ArrayBufferView objects as host objects, i.e.
   * pass them to Delegate::WriteHostObject. This should not be called when no
   * Delegate was passed.
   *
   * The default is not to treat ArrayBufferViews as host objects.
   *
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L177
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L98
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L288
   */
  setTreatArrayBufferViewsAsHostObjects(mode: boolean): void {
    this.#treatArrayBufferViewsAsHostObjects = mode;
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L105
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L292
   */
  private writeTag(tag: SerializationTag): void {
    const rawTag = tag.charCodeAt(0);
    this.writeRawBytes(Uint8Array.of(rawTag));
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L107
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L298
   */
  private writeVariant_uint32(value: number): void {
    // Writes an unsigned integer as a base-128 varint.
    // The number is written, 7 bits at a time, from the least significant to the
    // most significant 7 bits. Each byte, except the last, has the MSB set.
    // See also https://developers.google.com/protocol-buffers/docs/encoding
    console.assert(
      Uint32Array.of(value)[0] === value,
      "Only unsigned integer types can be written as varints."
    );
    const stackBuffer = new Uint8Array((4 * 8) / 7 + 1);
    let nextByte = 0;
    do {
      stackBuffer[nextByte] = (value & 0x7f) | 0x80;
      nextByte++;
      value >>= 7;
    } while (value);
    stackBuffer[nextByte - 1] &= 0x7f;
    this.writeRawBytes(stackBuffer.subarray(0, nextByte));
  }
  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L107
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L298
   */
  private writeVariant_uint64(value: bigint): void {
    // Writes an unsigned integer as a base-128 varint.
    // The number is written, 7 bits at a time, from the least significant to the
    // most significant 7 bits. Each byte, except the last, has the MSB set.
    // See also https://developers.google.com/protocol-buffers/docs/encoding
    console.assert(
      BigUint64Array.of(value)[0] === value,
      "Only unsigned integer types can be written as varints."
    );
    const stackBuffer = new Uint8Array((8 * 8) / 7 + 1);
    let nextByte = 0;
    do {
      stackBuffer[nextByte] = Number((value & 0x7fn) | 0x80n);
      nextByte++;
      value >>= 7n;
    } while (value);
    stackBuffer[nextByte - 1] &= 0x7f;
    this.writeRawBytes(stackBuffer.subarray(0, nextByte));
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L109
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L317
   */
  private writeZigZag_int32(value: number): void {
    // Writes a signed integer as a varint using ZigZag encoding (i.e. 0 is
    // encoded as 0, -1 as 1, 1 as 2, -2 as 3, and so on).
    // See also https://developers.google.com/protocol-buffers/docs/encoding
    // Note that this implementation relies on the right shift being arithmetic.
    console.assert(
      Int32Array.of(value)[0] === value,
      "Only signed integer types can be written as zigzag."
    );
    this.writeVariant_uint32(
      (Uint32Array.from(Int32Array.of(value))[0] << 1) ^ (value >> 31)
    );
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L109
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L317
   */
  private writeZigZag_int64(value: bigint): void {
    // Writes a signed integer as a varint using ZigZag encoding (i.e. 0 is
    // encoded as 0, -1 as 1, 1 as 2, -2 as 3, and so on).
    // See also https://developers.google.com/protocol-buffers/docs/encoding
    // Note that this implementation relies on the right shift being arithmetic.
    console.assert(
      BigInt64Array.of(value)[0] === value,
      "Only signed integer types can be written as zigzag."
    );
    this.writeVariant_uint64(
      (BigUint64Array.from(BigInt64Array.of(value))[0] << 1n) ^ (value >> 31n)
    );
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L186
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L88
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L332-L335
   */
  writeDouble(value: number): void {
    // Warning: this uses host endianness.
    this.writeRawBytes(Float64Array.of(value));
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L110
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L337
   */
  private writeOneByteString(value: string): void {
    this.writeVariant_uint32(value.length);
    this.writeRawBytes(Uint8Array.from(value, (c) => c.charCodeAt(0)));
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L111
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L342
   */
  private writeTwoByteString(value: string): void {
    this.writeVariant_uint32(value.length * 2);
    this.writeRawBytes(Uint16Array.from(value, (c) => c.charCodeAt(0)));
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L112
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L348
   */
  private writeBigIntContents(bigint: bigint) {
    const bitField = BigInt_getBitFieldForSerialization(bigint);
    const byteLength = BigInt_digitsByteLengthForSerialization(bigint);
    this.writeVariant_uint32(bitField);
    let dest: Uint8Array | null;
    if ((dest = this.reserveRawBytes(byteLength))) {
      BigInt_serializeDigits(bigint, dest);
    }
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L187
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L87
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L358
   */
  writeRawBytes(source: BufferSource): void {
    let dest: Uint8Array | null;
    if (
      (dest = this.reserveRawBytes(source.byteLength)) &&
      source.byteLength
    ) {
      if (ArrayBuffer.isView(source)) {
        dest.set(
          new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
        );
      } else {
        dest.set(new Uint8Array(source));
      }
    }
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L113
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L365
   */
  private reserveRawBytes(bytes: number): Uint8Array | null {
    const oldSize = this.#bufferSize;
    const newSize = oldSize + bytes;
    if (newSize > this.#bufferCapacity) {
      let ok: boolean | null;
      if (!(ok = this.expandBuffer(newSize))) {
        return null;
      }
    }
    this.#bufferSize = newSize;
    return this.#buffer!.subarray(oldSize);
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L102
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L378
   */
  private expandBuffer(requiredCapacity: number): boolean | null {
    console.assert(requiredCapacity > this.#bufferCapacity);
    const requestedCapacity =
      Math.max(requiredCapacity, this.#bufferCapacity * 2) + 64;
    let providedCapacity = 0;
    let newBuffer: Uint8Array | null = null;
    if (this.#delegate) {
      newBuffer = this.#delegate.reallocateBufferMemory(
        this.#buffer!,
        requestedCapacity,
        (v) => (providedCapacity = v)
      );
    } else {
      newBuffer = new Uint8Array(requestedCapacity);
      newBuffer.set(this.#buffer!);
      providedCapacity = requestedCapacity;
    }
    if (newBuffer) {
      console.assert(providedCapacity >= requiredCapacity);
      this.#buffer = newBuffer;
      this.#bufferCapacity = providedCapacity;
      return true;
    } else {
      this.#outOfMemory = true;
      return null;
    }
  }

  /**
   * @internal
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L89
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L402
   */
  writeByte(value: number): void {
    let dest: Uint8Array | null;
    if ((dest = this.reserveRawBytes(1))) {
      dest[0] = value;
    }
  }

  /**
   * Write raw data in various common formats to the buffer. Note that integer
   * types are written in base-128 varint format, not with a binary copy. For
   * use during an override of Delegate::WriteHostObject.
   *
   * Publicly exposed wire format writing methods. These are intended for use
   * within the delegate's WriteHostObject method.
   *
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L184
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L85
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L409
   */
  writeUint32(value: number): void {
    this.writeVariant_uint32(value);
  }

  /**
   * Write raw data in various common formats to the buffer. Note that integer
   * types are written in base-128 varint format, not with a binary copy. For
   * use during an override of Delegate::WriteHostObject.
   *
   * Publicly exposed wire format writing methods. These are intended for use
   * within the delegate's WriteHostObject method.
   *
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L185
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L86
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L413
   */
  writeUint64(value: bigint): void {
    this.writeVariant_uint64(value);
  }

  /**
   * Returns the stored data (allocated using the delegate's
   * ReallocateBufferMemory) and its size. This serializer should not be used
   * once the buffer is released. The contents are undefined if a previous write
   * has failed. Ownership of the buffer is transferred to the caller.
   *
   * Returns the buffer, allocated via the delegate, and its size. Caller
   * assumes ownership of the buffer.
   *
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L160
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L71
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L417
   */
  release(): Uint8Array {
    const result = this.#buffer!;
    this.#buffer = null;
    this.#bufferSize = 0;
    this.#bufferCapacity = 0;
    return result;
  }

  /**
   * Marks an ArrayBuffer as havings its contents transferred out of band. Pass
   * the corresponding JSArrayBuffer in the deserializing context to
   * ValueDeserializer::TransferArrayBuffer.
   *
   * @see https://github.com/v8/v8/blob/11.3.244.8/include/v8-value-serializer.h#L167
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L78
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L425
   */
  transferArrayBuffer(transferId: number, arrayBuffer: ArrayBuffer): void {
    console.assert(!this.#arrayBufferTransferMap.get(transferId));
    console.assert(
      !(
        Object.prototype.toString.call(arrayBuffer).slice(8, -1) ===
        "SharedArrayBuffer"
      )
    );
    this.#arrayBufferTransferMap.set(transferId, arrayBuffer);
  }

  /**
   * Serializes a V8 object into the buffer.
   *
   * @internal
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L65
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L432
   */
  writeObject(object: any): boolean | null {
    // There is no sense in trying to proceed if we've previously run out of
    // memory. Bail immediately, as this likely implies that some write has
    // previously failed and so the buffer is corrupt.
    if (this.#outOfMemory) {
      return this.throwIfOutOfMemory();
    }

    if (Object_isSMI(object)) {
      this.writeSMI(object);
      return this.throwIfOutOfMemory();
    }

    console.assert(true);
    const instanceType = Object_instanceType(object);
    switch (instanceType) {
      case "ODDBALL_TYPE":
        this.writeOddball(object);
        return this.throwIfOutOfMemory();
      case "HEAP_NUMBER_TYPE":
        this.writeHeapNumber(object);
        return this.throwIfOutOfMemory();
      case "BIGINT_TYPE":
        this.writeBigInt(object);
        return this.throwIfOutOfMemory();
      case "JS_TYPED_ARRAY_TYPE":
      case "JS_DATA_VIEW_TYPE":
      case "JS_RAB_GSAB_DATA_VIEW_TYPE": {
        // Despite being JSReceivers, these have their wrapped buffer serialized
        // first. That makes this logic a little quirky, because it needs to
        // happen before we assign object IDs.
        // TODO(jbroman): It may be possible to avoid materializing a typed
        // array's buffer here.
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
        if (InstanceTypeChecker_isString(instanceType)) {
          this.writeString(object.valueOf());
          return this.throwIfOutOfMemory();
        } else if (InstanceTypeChecker_isJSReceiver(instanceType)) {
          return this.writeJSReceiver(object);
        } else {
          return this.throwDataCloneError(
            MessageTemplate_dataCloneError,
            object
          );
        }
    }
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L116
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L486
   */
  private writeOddball(oddball: object): void {
    let tag = SerializationTag.undefined;
    switch (Oddball_kind(oddball)) {
      case "undefined":
        tag = SerializationTag.undefined;
        break;
      case "false":
        tag = SerializationTag.false;
        break;
      case "true":
        tag = SerializationTag.true;
        break;
      case "null":
        tag = SerializationTag.null;
        break;
      default:
        throw new DOMException("unreachable", "InvalidStateError");
    }
    this.writeTag(tag);
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L117
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L507
   */
  private writeSMI(smi: number): void {
    console.assert(-(2 ** 31) <= smi && smi < 2 ** 31);
    this.writeTag(SerializationTag.int32);
    this.writeZigZag_int32(smi);
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L118
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L513
   */
  private writeHeapNumber(number: number): void {
    this.writeTag(SerializationTag.double);
    this.writeDouble(number);
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L119
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L518
   */
  private writeBigInt(bigint: bigint): void {
    this.writeTag(SerializationTag.bigInt);
    this.writeBigIntContents(bigint);
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L119
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L523
   */
  private writeString(string: string): void {
    if (new Blob([string]).size === string.length) {
      this.writeTag(SerializationTag.oneByteString);
      this.writeOneByteString(string);
    } else {
      this.writeTag(SerializationTag.twoByteString);
      this.writeTwoByteString(string);
    }
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L121
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L545
   */
  private writeJSReceiver(receiver: any): boolean | null {
    // If the object has already been serialized, just write its ID.
    const findResult = this.#idMap.get(receiver);
    if (findResult !== undefined) {
      this.writeTag(SerializationTag.objectReference);
      this.writeZigZag_int32(findResult - 1);
      return this.throwIfOutOfMemory();
    }

    // Otherwise, allocate an ID for it.
    const id = this.#nextId++;
    this.#idMap.set(receiver, id + 1);

    // Eliminate callable and exotic objects, which should not be serialized.
    const instanceType = instanceType(receiver);
    if (
      typeof instanceType === "function" ||
      (isSpecialRecieverInstanceType(instanceType) &&
        instanceType !== "JS_SPECIAL_API_OBJECT_TYPE")
    ) {
      return this.throwDataCloneError(MessageTemplate_dataCloneError, receiver);
    }

    // If we are at the end of the stack, abort. This function may recurse.
    if (false) {
      return null;
    }

    switch (instanceType) {
      case "JS_ARRAY_TYPE":
        return this.writeJSArray(receiver as any[]);
      case "JS_ARRAY_ITERATOR_PROTOTYPE_TYPE":
      case "JS_ITERATOR_PROTOTYPE_TYPE":
      case "JS_MAP_ITERATOR_PROTOTYPE_TYPE":
      case "JS_OBJECT_PROTOTYPE_TYPE":
      case "JS_OBJECT_TYPE":
      case "JS_PROMISE_PROTOTYPE_TYPE":
      case "JS_REGEXP_PROTOTYPE_TYPE":
      case "JS_SET_ITERATOR_PROTOTYPE_TYPE":
      case "JS_SET_PROTOTYPE_TYPE":
      case "JS_STRING_ITERATOR_PROTOTYPE_TYPE":
      case "JS_TYPED_ARRAY_PROTOTYPE_TYPE":
      case "JS_API_OBJECT_TYPE": {
        const jsObject = receiver;
        if (JSObject_getEmbedderFieldCount(jsObject)) {
          return this.writeHostObject(jsObject);
        } else {
          return this.writeJSObject(jsObject);
        }
      }
      case "JS_SPECIAL_API_OBJECT_TYPE":
        return this.writeHostObject(receiver);
      case "JS_DATE_TYPE":
        this.writeJSDate(receiver);
        return this.throwIfOutOfMemory();
      case "JS_PRIMITIVE_WRAPPER_TYPE":
        return this.writeJSPrimitiveWrapper(receiver);
      case "JS_REG_EXP_TYPE":
        this.writeJSRegExp(receiver);
        return this.throwIfOutOfMemory();
      case "JS_MAP_TYPE":
        return this.writeJSMap(receiver);
      case "JS_SET_TYPE":
        return this.writeJSSet(receiver);
      case "JS_ARRAY_BUFFER_TYPE":
        return this.writeJSArrayBuffer(receiver);
      case "JS_TYPED_ARRAY_TYPE":
      case "JS_DATA_VIEW_TYPE":
      case "JS_RAB_GSAB_DATA_VIEW_TYPE":
        return this.writeJSArrayBufferView(receiver);
      case "JS_ERROR_TYPE":
        return this.writeJSError(receiver);
      case "JS_SHARED_ARRAY_TYPE":
        return this.writeJSSharedArray(receiver);
      case "JS_SHARED_STRUCT_TYPE":
        return this.writeJSSharedStruct(receiver);
      case "JS_ATOMICS_MUTEX_TYPE":
      case "JS_ATOMICS_CONDITION_TYPE":
        return this.writeSharedObject(receiver);
      case "WASM_MODULE_OBJECT_TYPE":
        return this.writeWASMModule(receiver);
      case "WASM_MEMORY_OBJECT_TYPE":
        return this.writeWASMMemory(receiver);
      default:
        break;
    }

    return this.throwDataCloneError(MessageTemplate_dataCloneError, receiver);
  }

  /**
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.h#L123
   * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/value-serializer.cc#L634
   */
  private writeJSObject(object: object): boolean | null {
    console.assert(!false)
    const canSerializeFast = true && Reflect.ownKeys(object).length === 0;
    if (!canSerializeFast) {
      return this.writeJSObjectSlow(object);
    }

    const map = Object.entries(Object.getOwnPropertyDescriptors((object)))
    this.writeTag(SerializationTag.beginJSObject)

    // Write out fast properties as long as they are only data properties and the
    // map doesn't change.
    let propertiesWritten = 0;
    let mapChanged = false;
    for (const [key, details] of map) {
      if (!(typeof key === "string")) {
        continue;
      }
      if ((false)) {
        continue
      }

      let value: any
      if (!mapChanged) {
        mapChanged = false
      }
      if (!mapChanged) {
        console.assert("value" in details)
        
      }
    }
  }
}

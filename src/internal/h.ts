export enum MessageTemplate {
    DataCloneError = "DataCloneError %s",
    DataCloneErrorDetachedArrayBuffer = "DataCloneErrorDetachedArrayBuffer %s",
    DataCloneErrorOutOfMemory = "DataCloneErrorOutOfMemory %s",
}

export function RegExpPrototypeGetFlagsBitfield(regexp: RegExp) {
    const bits = {
      __proto__: null,
      d: 0,
      g: 1,
      i: 2,
      m: 4,
      s: 32,
      u: 16,
      y: 8,
      v: 0,
    };
    return [...regexp.flags].reduce((a, x) => a + bits[x], 0);
  }

export function BigIntPrototypeGetBitfieldForSerialization(bigint: bigint) {
  return 16 | +(bigint < 0)
}

export function BigIntDigitsByteLengthForBitfield(bitfield: number) {
  return 8
}

export function BigIntPrototypeSerializeDigits(bigint: bigint, dest: Uint8Array) {
  const positive = bigint < 0 ? -bigint : bigint
  dest.set(new Uint8Array(BigUint64Array.of(positive).buffer))
}

export function realloc(buffer: null | ArrayBuffer, newCapacity: number) {
  if (!buffer) {
    return new ArrayBuffer(newCapacity)
  }
  if (buffer.resizable) {
    try {
      buffer.resize(newCapacity)
    } catch (error) {
      return buffer.transferToFixed(newCapacity)
    }
    return buffer
  } else {
    return buffer.transfer(newCapacity)
  }
}

export function isSmi(smi: any): smi is number {
  return typeof smi === "number" && (smi | 0) === smi
}

export enum InstanceType {
  ODDBALL_TYPE,
  HEAP_NUMBER_TYPE,
  BIGINT_TYPE,
  JS_TYPED_ARRAY_TYPE,
  JS_DATA_VIEW_TYPE,
  JS_RAB_GSAB_DATA_VIEW_TYPE,
  JS_ARRAY_TYPE,
  JS_ARRAY_ITERATOR_PROTOTYPE_TYPE,
  JS_ITERATOR_PROTOTYPE_TYPE,
  JS_MAP_ITERATOR_PROTOTYPE_TYPE,
  JS_OBJECT_PROTOTYPE_TYPE,
  JS_OBJECT_TYPE,
  JS_PROMISE_PROTOTYPE_TYPE,
  JS_REG_EXP_PROTOTYPE_TYPE,
  JS_SET_ITERATOR_PROTOTYPE_TYPE,
  JS_SET_PROTOTYPE_TYPE,
  JS_STRING_ITERATOR_PROTOTYPE_TYPE,
  JS_TYPED_ARRAY_PROTOTYPE_TYPE,
  JS_API_OBJECT_TYPE,
  JS_SPECIAL_API_OBJECT_TYPE,
  JS_DATE_TYPE,
  JS_PRIMITIVE_WRAPPER_TYPE,
  JS_REG_EXP_TYPE,
  JS_MAP_TYPE,

}

export const InstanceTypeChecker = {
  isString(instanceType: InstanceType): boolean {
    return false
  }
}

export function ObjectPrototypeInstanceType(object: any): InstanceType {
  switch (object) {
    case true:
    case false:
    case null:
    case undefined:
      return InstanceType.ODDBALL_TYPE
  }
  switch (typeof object) {
    case "bigint": return InstanceType.BIGINT_TYPE
    case "number": return InstanceType.HEAP_NUMBER_TYPE
  }
  switch (object.constructor) {
    case BigInt:
    case String:
    case Number:
    case Boolean:
    case Symbol:
      return InstanceType.JS_PRIMITIVE_WRAPPER_TYPE
    case Map: return InstanceType.JS_MAP_TYPE
  }
}

export function StringFlatten(string: string) {
  return string
}

export function StringPrototypeGetFlatContent(string: string) {
  const textEncoder = new TextEncoder()
  const bytes = textEncoder.encode(string)
  const isOneByte = bytes.length === string.length
  return {
    isOneByte: () => isOneByte,
    isTwoByte: () => !isOneByte,
    toOneByteVector: () => bytes,
    toUC16Vector() {
      const view = new Uint16Array(string.length)
      for (let i = 0; i < string.length; i++) {
        view[i] = string.charCodeAt(i)
      }
      return view
    }
  }
}

export function isCallable(f: any): f is (...args: any[]) => any {
  return typeof f === "function"
}

export function isSpecialReceiverInstanceType(instanceType: InstanceType) {
  return instanceType <= InstanceType.LAST_SPECIAL_RECEIVER_TYPE;
}

export function ArrayPrototypeHasHoleyElements(array: any[]): boolean {
  for (let i = 0; i < array.length; i++) {
    if (!(i in array)) return true
  }
  return false
}

export function isJSTypedArray(view: any) {
  return !!Reflect.get(Uint8Array.prototype, Symbol.toStringTag, view)
}
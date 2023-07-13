import { currentValueSerializerFormatVersion } from "../index.js";

/**
 * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/bigint.h#L315
 * @see https://github.com/v8/v8/blob/11.3.244.8/src/objects/bigint.cc#L1379
 */
// The serialization format MUST NOT CHANGE without updating the format
// version in value-serializer.cc!
function BigInt_getBitFieldForSerialization(self: bigint): number {
  // In order to make the serialization format the same on 32/64 bit builds,
  // we convert the length-in-digits to length-in-bytes for serialization.
  // Being able to do this depends on having enough LengthBits:
  return 0;
}

function BigInt_digitsByteLengthForSerialization(bigint: bigint): number {
  return 0;
}

// The serialization format MUST NOT CHANGE without updating the format
// version in value-serializer.cc!
function BigInt_serializeDigits(self: bigint, storage: Uint8Array): void {}

// Version 9: (imported from Blink)
// Version 10: one-byte (Latin-1) strings
// Version 11: properly separate undefined from the hole in arrays
// Version 12: regexp and string objects share normal string encoding
// Version 13: host objects have an explicit tag (rather than handling all
//             unknown tags)
// Version 14: flags for JSArrayBufferViews
// Version 15: support for shared objects with an explicit tag
//
// WARNING: Increasing this value is a change which cannot safely be rolled
// back without breaking compatibility with data stored on disk. It is
// strongly recommended that you do not make such changes near a release
// milestone branch point.
//
// Recent changes are routinely reverted in preparation for branch, and this
// has been the cause of at least one bug in the past.
const latestVersion = 15;
console.assert(
  latestVersion == currentValueSerializerFormatVersion(),
  "Exported format version must match latest version."
);

enum SerializationTag {
  // version:uint32_t (if at beginning of data, sets version > 0)
  version = "\xFF",
  // ignore
  padding = "\0",
  // refTableSize:uint32_t (previously used for sanity checks; safe to ignore)
  verifyObjectCount = "?",
  // Oddballs (no data).
  theHole = "-",
  undefined = "_",
  null = "0",
  true = "T",
  false = "F",
  // Number represented as 32-bit integer, ZigZag-encoded
  // (like sint32 in protobuf)
  int32 = "I",
  // Number represented as 32-bit unsigned integer, varint-encoded
  // (like uint32 in protobuf)
  uint32 = "U",
  // Number represented as a 64-bit double.
  // Host byte order is used (N.B. this makes the format non-portable).
  double = "N",
  // BigInt. Bitfield:uint32_t, then raw digits storage.
  bigInt = "Z",
  // byteLength:uint32_t, then raw data
  utf8String = "S",
  oneByteString = '"',
  twoByteString = "c",
  // Reference to a serialized object. objectID:uint32_t
  objectReference = "^",
  // Beginning of a JS object.
  beginJSObject = "o",
  // End of a JS object. numProperties:uint32_t
  endJSObject = "{",
  // Beginning of a sparse JS array. length:uint32_t
  // Elements and properties are written as key/value pairs, like objects.
  beginSparseJSArray = "a",
  // End of a sparse JS array. numProperties:uint32_t length:uint32_t
  endSparseJSArray = "@",
  // Beginning of a dense JS array. length:uint32_t
  // |length| elements, followed by properties as key/value pairs
  beginDenseJSArray = "A",
  // End of a dense JS array. numProperties:uint32_t length:uint32_t
  endDenseJSArray = "$",
  // Date. millisSinceEpoch:double
  date = "D",
  // Boolean object. No data.
  trueObject = "y",
  falseObject = "x",
  // Number object. value:double
  numberObject = "n",
  // BigInt object. Bitfield:uint32_t, then raw digits storage.
  bigIntObject = "z",
  // String object, UTF-8 encoding. byteLength:uint32_t, then raw data.
  stringObject = "s",
  // Regular expression, UTF-8 encoding. byteLength:uint32_t, raw data,
  // flags:uint32_t.
  regExp = "R",
  // Beginning of a JS map.
  beginJSMap = ";",
  // End of a JS map. length:uint32_t.
  endJSMap = ":",
  // Beginning of a JS set.
  beginJSSet = "'",
  // End of a JS set. length:uint32_t.
  endJSSet = ",",
  // Array buffer. byteLength:uint32_t, then raw data.
  arrayBuffer = "B",
  // Resizable ArrayBuffer.
  resizableArrayBuffer = "~",
  // Array buffer (transferred). transferID:uint32_t
  arrayBufferTransfer = "t",
  // View into an array buffer.
  // subtag:ArrayBufferViewTag, byteOffset:uint32_t, byteLength:uint32_t
  // For typed arrays, byteOffset and byteLength must be divisible by the size
  // of the element.
  // Note: arrayBufferView is special, and should have an ArrayBuffer (or an
  // ObjectReference to one) serialized just before it. This is a quirk arising
  // from the previous stack-based implementation.
  arrayBufferView = "V",
  // Shared array buffer. transferID:uint32_t
  sharedArrayBuffer = "u",
  // A HeapObject shared across Isolates. sharedValueID:uint32_t
  sharedObject = "p",
  // A wasm module object transfer. next value is its index.
  wasmModuleTransfer = "w",
  // The delegate is responsible for processing all following data.
  // This "escapes" to whatever wire format the delegate chooses.
  hostObject = "\\",
  // A transferred WebAssembly.Memory object. maximumPages:int32_t, then by
  // SharedArrayBuffer tag and its data.
  wasmMemoryTransfer = "m",
  // A list of (subtag: ErrorTag, [subtag dependent data]). See ErrorTag for
  // details.
  error = "r",

  // The following tags are reserved because they were in use in Chromium before
  // the hostObject tag was introduced in format version 13, at
  //   v8           refs/heads/master@{#43466}
  //   chromium/src refs/heads/master@{#453568}
  //
  // They must not be reused without a version check to prevent old values from
  // starting to deserialize incorrectly. For simplicity, it's recommended to
  // avoid them altogether.
  //
  // This is the set of tags that existed in SerializationTag.h at that time and
  // still exist at the time of this writing (i.e., excluding those that were
  // removed on the Chromium side because there should be no real user data
  // containing them).
  //
  // It might be possible to also free up other tags which were never persisted
  // (e.g. because they were used only for transfer) in the future.
  legacyReservedMessagePort = "M",
  legacyReservedBlob = "b",
  legacyReservedBlobIndex = "i",
  legacyReservedFile = "f",
  legacyReservedFileIndex = "e",
  legacyReservedDOMFileSystem = "d",
  legacyReservedFileList = "l",
  legacyReservedFileListIndex = "L",
  legacyReservedImageData = "#",
  legacyReservedImageBitmap = "g",
  legacyReservedImageBitmapTransfer = "G",
  legacyReservedOffscreenCanvas = "H",
  legacyReservedCryptoKey = "K",
  legacyReservedRTCCertificate = "k",
}

enum ArrayBufferViewTag {
  int8Array = "b",
  uint8Array = "B",
  uint8ClampedArray = "C",
  int16Array = "w",
  uint16Array = "W",
  int32Array = "d",
  uint32Array = "D",
  float32Array = "f",
  float64Array = "F",
  bigInt64Array = "q",
  bigUint64Array = "Q",
  dataView = "?",
}

export {
  latestVersion,
  SerializationTag,
  ArrayBufferViewTag,
  BigInt_getBitFieldForSerialization,
  BigInt_digitsByteLengthForSerialization,
  BigInt_serializeDigits,
};

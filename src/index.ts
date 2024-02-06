import { Buffer } from "#node:buffer"
import { Serializer, Deserializer } from "./internal/serdes.js"

Serializer.prototype._getDataCloneError = Error;

Deserializer.prototype.readRawBytes = function readRawBytes(length: number) {
  const offset = this._readRawBytes(length);
  return new Buffer(this.buffer.buffer,
                        this.buffer.byteOffset + offset,
                        length);
};

function arrayBufferViewTypeToIndex(abView) {
  const type = Object.prototype.toString.call(abView);
  if (type === '[object Int8Array]') return 0;
  if (type === '[object Uint8Array]') return 1;
  if (type === '[object Uint8ClampedArray]') return 2;
  if (type === '[object Int16Array]') return 3;
  if (type === '[object Uint16Array]') return 4;
  if (type === '[object Int32Array]') return 5;
  if (type === '[object Uint32Array]') return 6;
  if (type === '[object Float32Array]') return 7;
  if (type === '[object Float64Array]') return 8;
  if (type === '[object DataView]') return 9;
  // Index 10 is FastBuffer.
  if (type === '[object BigInt64Array]') return 11;
  if (type === '[object BigUint64Array]') return 12;
  return -1;
}

function arrayBufferViewIndexToType(index) {
  if (index === 0) return Int8Array;
  if (index === 1) return Uint8Array;
  if (index === 2) return Uint8ClampedArray;
  if (index === 3) return Int16Array;
  if (index === 4) return Uint16Array;
  if (index === 5) return Int32Array;
  if (index === 6) return Uint32Array;
  if (index === 7) return Float32Array;
  if (index === 8) return Float64Array;
  if (index === 9) return DataView;
  if (index === 10) throw new ReferenceError("FastBuffer not defined");
  if (index === 11) return BigInt64Array;
  if (index === 12) return BigUint64Array;
  return undefined;
}

export class DefaultSerializer extends Serializer {
  constructor() {
    super();

    this._setTreatArrayBufferViewsAsHostObjects(true);
  }

  _writeHostObject(abView) {
    let i = 10;  // FastBuffer
    if (abView.constructor !== Buffer) {
      i = arrayBufferViewTypeToIndex(abView);
      if (i === -1) {
        throw new this._getDataCloneError(
          `Unserializable host object: ${abView}`);
      }
    }
    this.writeUint32(i);
    this.writeUint32(abView.byteLength);
    this.writeRawBytes(new Uint8Array(abView.buffer,
                                      abView.byteOffset,
                                      abView.byteLength));
  }
}

export class DefaultDeserializer extends Deserializer {
  _readHostObject() {
    const typeIndex = this.readUint32();
    const Ctor = arrayBufferViewIndexToType(typeIndex);
    const byteLength = this.readUint32();
    const byteOffset = this._readRawBytes(byteLength);
    const BYTES_PER_ELEMENT = Ctor.BYTES_PER_ELEMENT || 1;

    const offset = this.buffer.byteOffset + byteOffset;
    if (offset % BYTES_PER_ELEMENT === 0) {
      return new Ctor(this.buffer.buffer,
                      offset,
                      byteLength / BYTES_PER_ELEMENT);
    }
    // Copy to an aligned buffer first.
    const buffer_copy = Buffer.allocUnsafe(byteLength);
    copy(this.buffer, buffer_copy, 0, byteOffset, byteOffset + byteLength);
    return new Ctor(buffer_copy.buffer,
                    buffer_copy.byteOffset,
                    byteLength / BYTES_PER_ELEMENT);
  }
}


export function serialize(value) {
  const serializer = new DefaultSerializer();
  serializer.writeHeader();
  serializer.writeValue(value);
  return serializer.releaseBuffer();
}

export function deserialize(buffer) {
  const deserializer = new DefaultDeserializer(buffer);
  deserializer.readHeader();
  return deserializer.readValue();
}

export { Serializer, Deserializer }
import test from "node:test";
import assert from "node:assert";
import v8 from "node:v8";
import { ValueSerializer } from "../src/index";

function mySerialize(value: any): Uint8Array {
  const serializer = new ValueSerializer();
  serializer.writeHeader();
  serializer.writeValue(value);
  return serializer.release();
}

test("string", () => {
  const value = "foo";
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("number", () => {
  const value = 42;
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("bigint", () => {
  const value = 500n;
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("boolean", () => {
  const value = true;
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("undefined", () => {
  const value = undefined;
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("null", () => {
  const value = null;
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("array", () => {
  const value = [1, 2, 3];
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("object", () => {
  const value = { foo: "bar" };
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("nested object", () => {
  const value = { foo: { bar: "baz" } };
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("nested array", () => {
  const value = [[1, 2, 3]];
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("Map", () => {
  const value = new Map([["foo", "bar"]]);
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("Set", () => {
  const value = new Set(["foo", "bar"]);
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("Date", () => {
  const value = new Date();
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("RegExp", () => {
  const value = /foo/;
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("Error", () => {
  const value = new Error("foo");
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("Uint8Array", () => {
  const value = Uint8Array.of(1, 2, 3);
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("DataView", () => {
  const value = new DataView(new ArrayBuffer(3));
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("ArrayBuffer", () => {
  const value = Uint8Array.of(1, 2, 3).buffer;
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

test("SharedArrayBuffer", () => {
  const value = new SharedArrayBuffer(3);
  const expected = v8.serialize(value);
  const actual = mySerialize(value);
  assert.deepStrictEqual(actual, expected);
});

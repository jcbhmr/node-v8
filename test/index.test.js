import test from "node:test"
import assert from "node:assert"
import * as v82 from "../dist/index.js"
import * as v8 from "node:v8"

test("serialize() works for strings", () => {
    const expected = v8.serialize("Hello world!")
    const actual = v82.serialize("Hello world!")
    assert.equal(actual, expected)
})
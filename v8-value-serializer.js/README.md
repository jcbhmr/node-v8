![🚧 Under construction 👷‍♂️](https://i.imgur.com/LEP2R3N.png)

# V8 serializer for JavaScript

📲 V8 C++ `ValueSerializer` and `ValueDeserializer` ported to JavaScript

<div align="center">

![](https://picsum.photos/600/400)

</div>

📄 Returns binary data \
✅ Compatible with [`v8.serialize()`] \
💻 Works in your browser \
🌺 Implements both halves of [the structured clone algorithm]

🤩 You might want to check out [jcbhmr/node-serialization-api] to get a
`node:v8`-compatible `v8.serialize()` ponyfill!

## Installation

```sh
npm install @jcbhmr/v8-value-serializer
```

```js
import {} from "https://esm.sh/@jcbhmr/v8-value-serializer";
```

## Usage

```js
import {
  ValueSerializer,
  ValueDeserializer,
} from "@jcbhmr/v8-value-serializer";

const serializer = new ValueSerializer();
serializer.writeHeader();
serializer.writeValue("Hello, world!");
const buffer = serializer.releaseBuffer();
console.log(buffer);
//=> Uint8Array(N) [ ... ]
```

<!-- prettier-ignore-start -->
[the structured clone algorithm]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
[`v8.serialize()`]: https://nodejs.org/api/v8.html#serialization-api
[jcbhmr/node-serialization-api]: https://jcbhmr.github.io/node-serialization-api/
<!-- prettier-ignore-end -->

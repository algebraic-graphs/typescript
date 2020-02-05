# Algebraic graphs implementation in TypeScript

[![npm](https://img.shields.io/npm/v/alga-ts.svg)](https://www.npmjs.com/package/alga-ts)
[![Build Status](https://travis-ci.org/algebraic-graphs/typescript.svg)](https://travis-ci.org/algebraic-graphs/typescript)


`alga-ts` is a library for algebraic construction and manipulation of graphs in TypeScript. This is a TypeScript port of [alga](https://github.com/snowleopard/alga) and [alga-scala](https://github.com/algebraic-graphs/scala).

> See [this Haskell Symposium paper](https://github.com/snowleopard/alga-paper) and the corresponding [talk](https://www.youtube.com/watch?v=EdQGLewU-8k) for the motivation behind the library, the underlying theory and implementation details. There is also a [Haskell eXchange talk](https://skillsmatter.com/skillscasts/10635-algebraic-graphs), and a [tutorial](https://nobrakal.github.io/alga-tutorial) by Alexandre Moine.

**N.B.** Please note that this project is WIP, so use it at your own discretion.

## Installation

The main library, `alga-ts`, is available at the NPM. As it uses [fp-ts](https://github.com/gcanti/fp-ts) for higher-kinded types, be sure to install it as well:

```sh
npm install --save alga-ts fp-ts
```

## Usage

To begin using `alga-ts`, you first need to obtain an instance of it's API for the given [Eq](https://dev.to/gcanti/getting-started-with-fp-ts-setoid-39f3) of your target data type. Consider the example:

```ts
import { getStructEq, eqNumber, eqString } from 'fp-ts/lib/Eq';
import { getInstanceFor } from 'alga-ts';

interface User {
  name: string;
  age: number;
}

const eqUser = getStructEq({
  name: eqString,
  age: eqNumber,
});

const G = getInstanceFor(eqUser);
```

Now `G` is a module containing all methods & constructors required to work with graphs of `User`:

```ts
const user1: User = { name: 'Alice', age: 32 };
const user2: User = { name: 'Bob', age: 41 };
const user3: User = { name: 'Charlie', age: 28 };

const graph1 = G.connect(
  G.edge(user1, user2),
  G.edge(user2, user3),
);

console.log(G.hasEdge(user1, user3, graph1)); // => true
```

### Pipeable graphs

Algbraic graphs happen to have type class instances for `Monad` (and, consequently, for `Functor` and `Applicative`) and `Alternative`. API instance, obtained via `getInstanceFor`, exposes methods from these type classes in a data-last form, so they could be used with `pipe` from `fp-ts`:

```ts
import { pipe } from 'fp-ts/lib/pipeable';
import { getInstanceFor } from 'alga-ts';

const GS = getInstanceFor(eqString);

...

const graph2 = pipe(
  graph1,
  G.map(u => u.name),
);

console.log(GS.hasEdge('Alice', 'Charlie', graph2)); // => true
```

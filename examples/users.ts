import { getStructEq, eqNumber, eqString } from 'fp-ts/lib/Eq';
import { pipe } from 'fp-ts/lib/pipeable';
import { getInstanceFor } from '../src/alga';

interface User {
  name: string;
  age: number;
}

const eqUser = getStructEq({
  name: eqString,
  age: eqNumber,
});

const G = getInstanceFor(eqUser);
const GS = getInstanceFor(eqString);

const user1: User = { name: 'Alice', age: 32 };
const user2: User = { name: 'Bob', age: 41 };
const user3: User = { name: 'Charlie', age: 28 };

const graph1 = G.connect(
  G.edge(user1, user2),
  G.edge(user2, user3),
);

console.log(G.hasEdge(user1, user3, graph1)); // => true

const graph2 = pipe(
  graph1,
  G.map(u => u.name),
);
console.log(GS.hasEdge('Alice', 'Charlie', graph2)); // => true
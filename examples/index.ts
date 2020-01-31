import { eqNumber } from 'fp-ts/lib/Eq';
import { pipe } from 'fp-ts/lib/pipeable';

import { getInstanceFor } from '../src/alga';

const G = getInstanceFor(eqNumber);

const graph1 = G.overlay(G.overlay(G.edge(0, 10), G.edge(20, 30)), G.edge(10, 20));
const graph2 = pipe(graph1, G.map((n) => n + 2));
const graph3 = pipe(graph2, G.chain((n) => G.edge(n / 2, n / 2)));

console.dir(graph3, { depth: null });
console.log(G.hasEdge(6, 11, graph3));

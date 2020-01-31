import { eqNumber } from 'fp-ts/lib/Eq';

import { edge, graph, hasEdge, overlay } from '../src/alga';

const graph1 = overlay(overlay(edge(0, 10), edge(20, 30)), edge(10, 20));
const graph2 = graph.map(graph1, (n) => n + 2);
const graph3 = graph.chain(graph2, (n) => edge(n / 2, n / 2));

console.dir(graph3, { depth: null });
console.log(hasEdge(eqNumber)(6, 11, graph3));

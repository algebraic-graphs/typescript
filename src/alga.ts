import { Alternative1 } from 'fp-ts/lib/Alternative';
import { booleanAlgebraBoolean } from 'fp-ts/lib/BooleanAlgebra';
import { Eq, getTupleEq, fromEquals } from 'fp-ts/lib/Eq';
import { fieldNumber } from 'fp-ts/lib/Field';
import { constant, constTrue, flip, flow, identity, Predicate } from 'fp-ts/lib/function';
import { Monad1 } from 'fp-ts/lib/Monad';
import * as S from 'fp-ts/lib/Set';
import { pipe, pipeable } from 'fp-ts/lib/pipeable';

type Fn1<A, B> = (a: A) => B;
type Fn2<A, B, C> = (a: A, b: B) => C;

const { meet: and, join: or } = booleanAlgebraBoolean;
const { add } = fieldNumber;

export interface Empty {
  readonly tag: 'Empty';
}

export interface Vertex<A> {
  readonly tag: 'Vertex';
  readonly value: A;
}

export interface Overlay<A> {
  readonly tag: 'Overlay';
  readonly left: Graph<A>;
  readonly right: Graph<A>;
}

export interface Connect<A> {
  readonly tag: 'Connect';
  readonly from: Graph<A>;
  readonly to: Graph<A>;
}

export type Graph<A> =
  | Empty
  | Vertex<A>
  | Overlay<A>
  | Connect<A>;

export const URI = 'Graph';
export type URI = typeof URI;

declare module 'fp-ts/lib/HKT' {
  interface URItoKind<A> {
    Graph: Graph<A>;
  }
}

// Constructors

const empty = <A>(): Graph<A> => ({ tag: 'Empty' });
const vertex = <A>(value: A): Graph<A> => ({ tag: 'Vertex', value });
const vertices = <A>(values: A[]): Graph<A> => overlays(values.map(vertex));
const overlay = <A>(left: Graph<A>, right: Graph<A>): Graph<A> => ({ tag: 'Overlay', left, right });
const overlays = <A>(gs: Array<Graph<A>>): Graph<A> => gs.reduce(overlay, empty());
const connect = <A>(from: Graph<A>, to: Graph<A>): Graph<A> => ({ tag: 'Connect', from, to });
const connects = <A>(gs: Array<Graph<A>>): Graph<A> => gs.reduce(connect, empty());
const edge = <A>(x: A, y: A): Graph<A> => connect(vertex(x), vertex(y));
const edges = <A>(es: Array<[A, A]>): Graph<A> => overlays(es.map(([x, y]) => edge(x, y)));

const foldg = <A, B>(
  onEdge: B,
  onVertex: Fn1<A, B>,
  onOverlay: Fn2<B, B, B>,
  onConnect: Fn2<B, B, B>,
): (g: Graph<A>) => B => {
  const go = (g: Graph<A>): B => {
    switch (g.tag) {
      case 'Empty': return onEdge;
      case 'Vertex': return onVertex(g.value);
      case 'Overlay': return onOverlay(go(g.left), go(g.right));
      case 'Connect': return onConnect(go(g.from), go(g.to));
    }
  };

  return go;
};

export const getInstanceFor = <A>(eqA: Eq<A>) => {
  const eqAA = getTupleEq(eqA, eqA);
  const eqSetA = S.getEq(eqA);
  const eqSetAA = S.getEq(eqAA);
  const eqGraphA = fromEquals<Graph<A>>(
    (x, y): boolean => {
      if (x.tag === 'Empty') {
        return y.tag === 'Empty';
      } else {
        return eqSetA.equals(vertexSet(x), vertexSet(y)) && eqSetAA.equals(edgeSet(x), edgeSet(y));
      }
    },
  );
  const setUnion = S.union(eqAA);
  const setUnionA = S.union(eqA);
  const setChain = S.chain(eqAA);
  const setMap = S.map(eqAA);

  const vertexSet: (g: Graph<A>) => Set<A> =
    foldg(S.empty, a => new Set<A>().add(a), setUnionA, setUnionA);

  const edgeSet = (g: Graph<A>): Set<[A, A]> => {
    switch (g.tag) {
      case 'Empty':
      case 'Vertex': return S.empty;
      case 'Overlay': return setUnion(edgeSet(g.left), edgeSet(g.right));
      case 'Connect': return setUnion(
        setUnion(edgeSet(g.from), edgeSet(g.to)),
        pipe(
          vertexSet(g.from),
          setChain(x => pipe(
            vertexSet(g.to),
            setMap(y => [x, y])),
          ),
        ),
      );
    }
  };

  const hasVertex = (v: A): (g: Graph<A>) => boolean =>
    foldg<A, boolean>(false, (a) => eqA.equals(v, a), or, or);

  const hasEdge = (edgeFrom: A, edgeTo: A, g: Graph<A>): boolean => {
    const onVertex = (x: A) => (n: number): number => {
      switch (n) {
        case 0: return eqA.equals(edgeFrom, x) ? 1 : 0;
        default: return eqA.equals(edgeTo, x) ? 2 : 1;
      }
    };
    const onOverlay = (left: Fn1<number, number>, right: Fn1<number, number>) => (n: number): number => {
      switch (left(n)) {
        case 0: return right(n);
        case 1: return right(n) === 2 ? 2 : 1;
        default: return 2;
      }
    };
    const onConnect = (from: Fn1<number, number>, to: Fn1<number, number>) => (n: number): number => {
      const res = from(n);
      switch (res) {
        case 2: return 2;
        default: return to(res);
      }
    };

    const f = foldg<A, Fn1<number, number>>(identity, onVertex, onOverlay, onConnect)(g);

    return f(0) === 2;
  };

  const induce = <A>(p: Predicate<A>) => (g: Graph<A>): Graph<A> => graph.chain(g, a => p(a) ? vertex(a) : empty());

  const removeVertex = (v: A): (g: Graph<A>) => Graph<A> => induce(a => !eqA.equals(v, a));

  const splitVertex = (v: A, vs: A[]) => (g: Graph<A>): Graph<A> =>
    graph.chain(g, a => eqA.equals(v, a) ? vertices(vs) : vertex(a));

  const isEmpty = (g: Graph<A>): boolean => foldg<A, boolean>(true, constTrue, and, and)(g);

  const size = (g: Graph<A>): number => foldg<A, number>(1, constant(1), add, add)(g);

  const transpose = (g: Graph<A>): Graph<A> =>
    foldg<A, Graph<A>>(empty(), vertex, overlay, flip(connect))(g);

  const _simple = (op: Fn2<Graph<A>, Graph<A>, Graph<A>>) => (x: Graph<A>, y: Graph<A>): Graph<A> => {
    const z = op(x, y);
    switch (true) {
      case eqGraphA.equals(x, z): return x;
      case eqGraphA.equals(y, z): return y;
      default: return z;
    }
  };

  const simplify = (g: Graph<A>): Graph<A> =>
    foldg<A, Graph<A>>(empty(), vertex, _simple(overlay), _simple(connect))(g);

  return {
    ...pipeable(graph),
    empty,
    vertex,
    vertices,
    overlay,
    overlays,
    connect,
    connects,
    edge,
    edges,
    foldg,
    vertexSet,
    edgeSet,
    hasVertex,
    hasEdge,
    removeVertex,
    splitVertex,
    isEmpty,
    size,
    induce,
    transpose,
    simplify,
  } as const;
};

export const graph: Monad1<'Graph'> & Alternative1<'Graph'> = {
  URI,
  map: <A, B>(g: Graph<A>, ab: Fn1<A, B>): Graph<B> => foldg<A, Graph<B>>(
    empty(),
    flow(ab, vertex),
    overlay,
    connect,
  )(g),
  of: vertex,
  ap: <A, B>(gab: Graph<Fn1<A, B>>, ga: Graph<A>): Graph<B> => foldg<Fn1<A, B>, Graph<B>>(
    empty(),
    (ab) => foldg<A, Graph<B>>(empty(), flow(ab, vertex), overlay, connect)(ga),
    overlay,
    connect,
  )(gab),
  chain: <A, B>(ga: Graph<A>, f: Fn1<A, Graph<B>>): Graph<B> => foldg<A, Graph<B>>(
    empty(),
    (a) => foldg<B, Graph<B>>(empty<B>(), vertex, overlay, connect)(f(a)),
    overlay,
    connect,
  )(ga),
  zero: empty,
  alt: (fx, fy) => overlay(fx, fy()),
};

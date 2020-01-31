import { Alternative1 } from 'fp-ts/lib/Alternative';
import { booleanAlgebraBoolean } from 'fp-ts/lib/BooleanAlgebra';
import { Eq } from 'fp-ts/lib/Eq';
import { fieldNumber } from 'fp-ts/lib/Field';
import { constant, constTrue, flip, flow, identity } from 'fp-ts/lib/function';
import { Monad1 } from 'fp-ts/lib/Monad';

type Fn1<A, B> = (a: A) => B;
type Fn2<A, B, C> = (a: A, b: B) => C;

const and = booleanAlgebraBoolean.meet;
const or = booleanAlgebraBoolean.join;
const add = fieldNumber.add;

export interface Vertex<A> {
  tag: 'Vertex';
  value: A;
}

export interface Empty {
  tag: 'Empty';
}

export interface Overlay<A> {
  tag: 'Overlay';
  left: Graph<A>;
  right: Graph<A>;
}

export interface Connect<A> {
  tag: 'Connect';
  from: Graph<A>;
  to: Graph<A>;
}

export type Graph<A> =
  | Empty
  | Vertex<A>
  | Overlay<A>
  | Connect<A>;

declare module 'fp-ts/lib/HKT' {
  interface URItoKind<A> {
    Graph: Graph<A>;
  }
}

export const empty = <A>(): Graph<A> => ({ tag: 'Empty' });
export const vertex = <A>(value: A): Graph<A> => ({ tag: 'Vertex', value });
export const overlay = <A>(left: Graph<A>, right: Graph<A>): Graph<A> => ({ tag: 'Overlay', left, right });
export const connect = <A>(from: Graph<A>, to: Graph<A>): Graph<A> => ({ tag: 'Connect', from, to });
export const edge = <A>(x: A, y: A): Graph<A> => connect(vertex(x), vertex(y));

export const foldg = <A, B>(e: B, v: Fn1<A, B>, o: Fn2<B, B, B>, c: Fn2<B, B, B>): (g: Graph<A>) => B => {
  const go = (g: Graph<A>): B => {
    switch (g.tag) {
      case 'Empty': return e;
      case 'Vertex': return v(g.value);
      case 'Overlay': return o(go(g.left), go(g.right));
      case 'Connect': return c(go(g.from), go(g.to));
    }
  };

  return go;
};

export const isEmpty = <A>(g: Graph<A>): boolean =>
  foldg<A, boolean>(true, constTrue, and, and)(g);

export const size = <A>(g: Graph<A>): number =>
  foldg<A, number>(1, constant(1), add, add)(g);

export const hasVertex = <A>(EQ: Eq<A>) => (v: A): (g: Graph<A>) => boolean =>
  foldg<A, boolean>(false, (a) => EQ.equals(v, a), or, or);

export const transpose = <A>(g: Graph<A>): Graph<A> =>
  foldg<A, Graph<A>>(empty(), vertex, overlay, flip(connect))(g);

const simple = <A>(EQ: Eq<A>) => (op: Fn2<A, A, A>) => (x: A, y: A): A => {
  const z = op(x, y);
  switch (true) {
    case EQ.equals(x, z): return x;
    case EQ.equals(y, z): return y;
    default: return z;
  }
};
export const simplify = <A>(EQ: Eq<Graph<A>>) => (g: Graph<A>): Graph<A> =>
  foldg<A, Graph<A>>(empty(), vertex, simple(EQ)(overlay), simple(EQ)(connect))(g);

export const hasEdge = <A>(EQ: Eq<A>) => (edgeFrom: A, edgeTo: A, g: Graph<A>): boolean => {
  const onVertex = (x: A) => (n: number): number => {
    switch (n) {
      case 0: return EQ.equals(edgeFrom, x) ? 1 : 0;
      default: return EQ.equals(edgeTo, x) ? 2 : 1;
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

export const graph: Monad1<'Graph'> & Alternative1<'Graph'> = {
  URI: 'Graph',
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

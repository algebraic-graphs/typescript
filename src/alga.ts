import { Alternative1 } from 'fp-ts/lib/Alternative';
import { booleanAlgebraBoolean } from 'fp-ts/lib/BooleanAlgebra';
import { Eq, fromEquals, getTupleEq } from 'fp-ts/lib/Eq';
import { fieldNumber } from 'fp-ts/lib/Field';
import { constant, constFalse, constTrue, flip, flow, identity, Lazy, Predicate } from 'fp-ts/lib/function';
import * as M from 'fp-ts/lib/Map';
import { Monad1 } from 'fp-ts/lib/Monad';
import * as Mon from 'fp-ts/lib/Monoid';
import { Ord } from 'fp-ts/lib/Ord';
import { pipe, pipeable } from 'fp-ts/lib/pipeable';
import * as S from 'fp-ts/lib/Set';

type Fn1<A, B> = (a: A) => B;
type Fn2<A, B, C> = (a: A, b: B) => C;

const { meet: and, join: or } = booleanAlgebraBoolean;
const { add } = fieldNumber;

/**
 * Empty graph
 */
export interface Empty {
  readonly tag: 'Empty';
}

/**
 * Single isolated vertex
 */
export interface Vertex<A> {
  readonly tag: 'Vertex';
  readonly value: A;
}

/**
 * Overlay of two subgraphs
 */
export interface Overlay<A> {
  readonly tag: 'Overlay';
  readonly left: Graph<A>;
  readonly right: Graph<A>;
}

/**
 * Connection fotwo subgraphs
 */
export interface Connect<A> {
  readonly tag: 'Connect';
  readonly from: Graph<A>;
  readonly to: Graph<A>;
}

/**
 * Algrabraic graph
 */
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

export type AdjacencyMap<A> = Map<A, Set<A>>;

// Constructors

/**
 * Construct an empty graph.
 */
const empty = <A>(): Graph<A> => ({ tag: 'Empty' });

/**
 * Construct a graph consisting of a single isolated vertex.
 * @param value Vertex value
 */
const vertex = <A>(value: A): Graph<A> => ({ tag: 'Vertex', value });

/**
 * Construct a graph consisting of a set of isolated vertices.
 * @param values List of vertex values
 */
const vertices = <A>(values: A[]): Graph<A> => overlays(values.map(vertex));

/**
 * Construct a graph by overlaying two graphs.
 * `overlay` is commutative, associative and idemponent operation with `empty` as identity.
 * @param left First subgraph
 * @param right Second subgraph
 */
const overlay = <A>(left: Graph<A>, right: Graph<A>): Graph<A> => ({ tag: 'Overlay', left, right });

/**
 * Construct a graph by overlaying a list of subgraphs.
 * @param gs List of graphs to overlay
 */
const overlays = <A>(gs: Array<Graph<A>>): Graph<A> => gs.reduce(overlay, empty());

/**
 * Construct a graph by connecting each vertex of `from` subgraph to each vertex of `to` subgraph
 * while keeping the original vertices and edges of `from` and `to` subgraphs.
 * @param from A source graph of the connection
 * @param to A target graph of the connection
 */
const connect = <A>(from: Graph<A>, to: Graph<A>): Graph<A> => ({ tag: 'Connect', from, to });

/**
 * Construct a graph by connecting a list of subgraphs.
 * @param gs A list of subgraphs
 */
const connects = <A>(gs: Array<Graph<A>>): Graph<A> => gs.reduce(connect, empty());

/**
 * Construct a graph consisting of a single edge from `x` to `y`.
 * @param x Value of a source vertex
 * @param y Value of a target vertex
 */
const edge = <A>(x: A, y: A): Graph<A> => connect(vertex(x), vertex(y));

/**
 * Construct a graph by connecting each pair of vertices build from the tuple data.
 * @param es List of tuples with values for the source & target vertices
 */
const edges = <A>(es: Array<[A, A]>): Graph<A> => overlays(es.map(([x, y]) => edge(x, y)));

/**
 * Constructo a clique from a given vertex values.
 * @param values List of vertex values
 */
const clique = <A>(values: A[]): Graph<A> => connects(values.map(vertex));

/**
 * Recursively collapse a graph by applying the provided functions to the leaves and internal nodes of the expression.
 * @param onEmpty Lazy value of the resulting type
 * @param onVertex Transformer function of a vertex data from `A` to `B`
 * @param onOverlay Merging function of overlay which combines two `B` values
 * @param onConnect Merging function of connection which combines two `B` values
 */
const fold = <A, B>(
  onEmpty: Lazy<B>,
  onVertex: Fn1<A, B>,
  onOverlay: Fn2<B, B, B>,
  onConnect: Fn2<B, B, B>,
): (g: Graph<A>) => B => {
  const go = (g: Graph<A>): B => {
    switch (g.tag) {
      case 'Empty': return onEmpty();
      case 'Vertex': return onVertex(g.value);
      case 'Overlay': return onOverlay(go(g.left), go(g.right));
      case 'Connect': return onConnect(go(g.from), go(g.to));
    }
  };

  return go;
};

/**
 * Instantiates `alga-ts` API from given constraints.
 * @param eqA Equality typeclass instance for the `A` type
 */
export const getInstanceFor = <A>(eqA: Eq<A>) => {
  const eqAA = getTupleEq(eqA, eqA);
  const eqSetA = S.getEq(eqA);
  const eqSetAA = S.getEq(eqAA);
  const eqGraphA = fromEquals<Graph<A>>((x, y) => {
    if (x.tag === 'Empty') {
      return y.tag === 'Empty';
    } else {
      return eqSetA.equals(vertexSet(x), vertexSet(y)) && eqSetAA.equals(edgeSet(x), edgeSet(y));
    }
  });
  const setUnion = S.union(eqAA);
  const setUnionA = S.union(eqA);
  const setChain = S.chain(eqAA);
  const setMap = S.map(eqAA);
  const const1 = constant(1);
  const constId = constant(identity);
  const constSet = constant(S.empty);
  const monoidSet = S.getUnionMonoid(eqA);
  const monoidMap = M.getMonoid(eqA, monoidSet);

  /**
   * Get a set of vertices of a given graph.
   * @param g Graph
   */
  const vertexSet: (g: Graph<A>) => Set<A> = fold(constSet, S.singleton, setUnionA, setUnionA);

  /**
   * Get a set of edges of a given graph. Each edge is represented by a tuple `[from, to]`.
   * @param g Graph
   */
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

  /**
   * Check whether a given graph contains a vertex with the specified value.
   * @param v Value of the vertex to search for
   */
  const hasVertex = (v: A): (g: Graph<A>) => boolean => fold<A, boolean>(constFalse, (a) => eqA.equals(v, a), or, or);

  const _onOverlay = (left: Fn1<number, number>, right: Fn1<number, number>) => (n: number): number => {
    switch (left(n)) {
      case 0: return right(n);
      case 1: return right(n) === 2 ? 2 : 1;
      default: return 2;
    }
  };
  const _onConnect = (from: Fn1<number, number>, to: Fn1<number, number>) => (n: number): number => {
    const res = from(n);
    switch (res) {
      case 2: return 2;
      default: return to(res);
    }
  };
  /**
   * Check whether given graph contains an edge with specified starting and finishing points.
   * @param edgeFrom Value of the start of an edge
   * @param edgeTo Value of the end of an edge
   * @param g Graph
   */
  const hasEdge = (edgeFrom: A, edgeTo: A, g: Graph<A>): boolean => {
    const onVertex = (x: A) => (n: number): number => {
      switch (n) {
        case 0: return eqA.equals(edgeFrom, x) ? 1 : 0;
        default: return eqA.equals(edgeTo, x) ? 2 : 1;
      }
    };

    const f = fold<A, Fn1<number, number>>(constId, onVertex, _onOverlay, _onConnect)(g);

    return f(0) === 2;
  };

  /**
   * Induce a subgraph from a given graph by applying a predicate for each vertex.
   * @param p Filtering predicate for vertices
   */
  const induce = (p: Predicate<A>) => (g: Graph<A>): Graph<A> => graph.chain(g, a => p(a) ? vertex(a) : empty());

  /**
   * Remove all vertices with a given value.
   * @param v Vertex value to remove
   */
  const removeVertex = (v: A): (g: Graph<A>) => Graph<A> => induce(a => !eqA.equals(v, a));

  /**
   * Replace all occurrences of a vertices with the given value by a list of vertices while maintaining connectivity.
   * @param v Vertex value to search for
   * @param vs New values for the split vertices
   */
  const splitVertex = (v: A, vs: A[]) => (g: Graph<A>): Graph<A> =>
    graph.chain(g, a => eqA.equals(v, a) ? vertices(vs) : vertex(a));

  /**
   * Check whether given graph is empty
   * @param g Graph
   */
  const isEmpty = (g: Graph<A>): boolean => fold<A, boolean>(constTrue, constFalse, and, and)(g);

  /**
   * Compute a number of leaves in a graph expression, includeing `Empty` ones.
   * @param g Graph
   */
  const size = (g: Graph<A>): number => fold<A, number>(const1, const1, add, add)(g);

  /**
   * Transpose a given graph by flipping the direction of connections.
   * @param g Graph
   */
  const transpose = (g: Graph<A>): Graph<A> => fold<A, Graph<A>>(empty, vertex, overlay, flip(connect))(g);

  const _simple = (op: Fn2<Graph<A>, Graph<A>, Graph<A>>) => (x: Graph<A>, y: Graph<A>): Graph<A> => {
    const z = op(x, y);
    switch (true) {
      case eqGraphA.equals(x, z): return x;
      case eqGraphA.equals(y, z): return y;
      default: return z;
    }
  };

  /**
   * Simplify a graph expression. Semantically, this is the identity function,
   * but it simplifies a given expression according to the laws of the algebra.
   * The function does not compute the simplest possible expression,
   * but uses heuristics to obtain useful simplifications in reasonable time.
   * @param g Graph
   */
  const simplify = (g: Graph<A>): Graph<A> =>
    fold<A, Graph<A>>(empty, vertex, _simple(overlay), _simple(connect))(g);

  /**
   * Convert a graph to an adjacency map.
   * @param g Graph
   */
  const toAdjacencyMap: (g: Graph<A>) => AdjacencyMap<A> = fold<A, AdjacencyMap<A>>(
    constant(M.empty),
    x => M.singleton(x, S.empty),
    monoidMap.concat,
    (x, y) => {
      const productEdges = new Map<A, Set<A>>();

      for (const key of x.keys()) {
        productEdges.set(key, new Set(y.keys()));
      }

      return Mon.fold(monoidMap)([x, y, productEdges]);
    },
  );

  const toAdjacencyList = (ordA: Ord<A>) => (g: Graph<A>): Array<[A, A[]]> =>
    M.toArray(ordA)(M.map(S.toArray(ordA))(toAdjacencyMap(g)));

  const isSubgraph = (parent: Graph<A>) => (subgraph: Graph<A>): boolean => {
    const eqSubsetA: Eq<Set<A>> = { equals: S.subset(eqA) };

    return M.isSubmap(eqA, eqSubsetA)(toAdjacencyMap(subgraph), toAdjacencyMap(parent));
  };

  return {
    ...pipeable(graph),
    eqGraph: eqGraphA,
    empty,
    vertex,
    vertices,
    overlay,
    overlays,
    connect,
    connects,
    edge,
    edges,
    clique,
    fold,
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
    toAdjacencyMap,
    toAdjacencyList,
    isSubgraph,
  } as const;
};

export const graph: Monad1<URI> & Alternative1<URI> = {
  URI,
  map: <A, B>(g: Graph<A>, ab: Fn1<A, B>): Graph<B> => fold<A, Graph<B>>(
    empty,
    flow(ab, vertex),
    overlay,
    connect,
  )(g),
  of: vertex,
  ap: <A, B>(gab: Graph<Fn1<A, B>>, ga: Graph<A>): Graph<B> => fold<Fn1<A, B>, Graph<B>>(
    empty,
    (ab) => fold<A, Graph<B>>(empty, flow(ab, vertex), overlay, connect)(ga),
    overlay,
    connect,
  )(gab),
  chain: <A, B>(ga: Graph<A>, f: Fn1<A, Graph<B>>): Graph<B> => fold<A, Graph<B>>(
    empty,
    (a) => fold<B, Graph<B>>(empty, vertex, overlay, connect)(f(a)),
    overlay,
    connect,
  )(ga),
  zero: empty,
  alt: (fx, fy) => overlay(fx, fy()),
};

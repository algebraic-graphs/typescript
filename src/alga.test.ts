import * as fc from 'fast-check';
import { fromEquals, strictEqual } from 'fp-ts/lib/Eq';

import { getInstanceFor } from './alga';

// YB: We have to skip NaN, as NaN !== NaN, and set equality fails. I just love JS (┛ಠ_ಠ)┛彡┻━┻
const something = fc.anything().filter(a => a != null && (typeof a !== 'number' || !Number.isNaN(a)));

describe('Algebraic graphs suite', () => {
  const eqAnything = fromEquals(strictEqual);
  const G = getInstanceFor(eqAnything);

  describe('Laws', () => {
    it('Overlay is commutative', () => fc.assert(fc.property(something, something, (a, b) => {
      const va = G.vertex(a);
      const vb = G.vertex(b);

      const a_plus_b = G.overlay(va, vb);
      const b_plus_a = G.overlay(vb, va);

      expect(G.eqGraph.equals(a_plus_b, b_plus_a)).toBeTruthy();
    })));

    it('Overlay is associative', () => fc.assert(fc.property(something, something, something, (a, b, c) => {
      const va = G.vertex(a);
      const vb = G.vertex(b);
      const vc = G.vertex(c);

      const a_plus_bc = G.overlay(va, G.overlay(vb, vc));
      const ab_plus_c = G.overlay(G.overlay(va, vb), vc);

      expect(G.eqGraph.equals(a_plus_bc, ab_plus_c)).toBeTruthy();
    })));

    describe('(G, →, ε) form a monoid', () => {
      it('Left identity', () => fc.assert(fc.property(something, (a) => {
        const va = G.vertex(a);
        const vae = G.connect(G.empty(), va);

        expect(G.eqGraph.equals(va, vae)).toBeTruthy();
      })));

      it('Right identity', () => fc.assert(fc.property(something, (a) => {
        const va = G.vertex(a);
        const vae = G.connect(va, G.empty());

        expect(G.eqGraph.equals(va, vae)).toBeTruthy();
      })));

      it('Associativity', () => fc.assert(fc.property(something, something, something, (a, b, c) => {
        const va = G.vertex(a);
        const vb = G.vertex(b);
        const vc = G.vertex(c);

        const a_plus_bc = G.connect(va, G.connect(vb, vc));
        const ab_plus_c = G.connect(G.connect(va, vb), vc);

        expect(G.eqGraph.equals(a_plus_bc, ab_plus_c)).toBeTruthy();
      })));
    });

    it('Connect distributes over Overlay', () => fc.assert(fc.property(something, something, something, (a, b, c) => {
      const va = G.vertex(a);
      const vb = G.vertex(b);
      const vc = G.vertex(c);

      const a_times_b_plus_c = G.connect(va, G.overlay(vb, vc));
      const a_times_b_plus_a_times_c = G.overlay(G.connect(va, vb), G.connect(va, vc));
      const a_plus_b_times_c = G.connect(G.overlay(va, vb), vc);
      const a_times_c_plus_b_times_c = G.overlay(G.connect(va, vc), G.connect(vb, vc));

      expect(G.eqGraph.equals(a_times_b_plus_c, a_times_b_plus_a_times_c)).toBeTruthy();
      expect(G.eqGraph.equals(a_plus_b_times_c, a_times_c_plus_b_times_c)).toBeTruthy();
    })));

    it('Decomposition', () => fc.assert(fc.property(something, something, something, (a, b, c) => {
      const va = G.vertex(a);
      const vb = G.vertex(b);
      const vc = G.vertex(c);

      const a_times_b_times_c = G.connect(va, G.connect(vb, vc));
      const a_times_b_plus_a_times_c_plus_b_times_c =
        G.overlay(G.overlay(G.connect(va, vb), G.connect(va, vc)), G.connect(vb, vc));

      expect(G.eqGraph.equals(a_times_b_times_c, a_times_b_plus_a_times_c_plus_b_times_c)).toBeTruthy();
    })));
  });

  describe('Conversion', () => {
    it('toAdjacencyMap', () => fc.assert(fc.property(something, something, something, something, (a, b, c, d) => {
      const g = G.connect(G.edge(a, b), G.edge(c, d));
      const am = G.toAdjacencyMap(g);

      expect(am.has(a)).toBeTruthy();
      expect(am.has(b)).toBeTruthy();
      expect(am.has(c)).toBeTruthy();
      expect(am.has(d)).toBeTruthy();

      const aSet = am.get(a);
      expect(aSet).toBeDefined();
      expect(aSet?.has(b)).toBeTruthy();
      expect(aSet?.has(c)).toBeTruthy();
      expect(aSet?.has(d)).toBeTruthy();

      const bSet = am.get(b);
      expect(bSet).toBeDefined();
      expect(bSet?.has(c)).toBeTruthy();
      expect(bSet?.has(d)).toBeTruthy();

      const cSet = am.get(c);
      expect(cSet).toBeDefined();
      expect(cSet?.has(d)).toBeTruthy();

      const dSet = am.get(d);
      expect(dSet).toBeDefined();
      expect(dSet?.size).toEqual(0);
    })));
  });
});
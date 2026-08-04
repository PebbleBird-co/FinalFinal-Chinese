// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { UnionFind } from '../clustering/union-find';

describe('union find', () => {
  it('merges connected values without merging unrelated groups', () => {
    const unionFind = new UnionFind(['a', 'b', 'c', 'd']);
    unionFind.union('a', 'b');
    unionFind.union('b', 'c');

    expect(unionFind.groups().map((group) => group.join(','))).toEqual(['a,b,c', 'd']);
  });
});

export class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();

  constructor(values: string[]) {
    for (const value of values) {
      this.parent.set(value, value);
      this.rank.set(value, 0);
    }
  }

  find(value: string): string {
    const parent = this.parent.get(value);
    if (parent === undefined) throw new Error(`Unknown Union-Find value: ${value}`);
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;

    const leftRank = this.rank.get(leftRoot) ?? 0;
    const rightRank = this.rank.get(rightRoot) ?? 0;
    if (leftRank < rightRank) {
      this.parent.set(leftRoot, rightRoot);
      return;
    }
    this.parent.set(rightRoot, leftRoot);
    if (leftRank === rightRank) this.rank.set(leftRoot, leftRank + 1);
  }

  groups(): string[][] {
    const grouped = new Map<string, string[]>();
    for (const value of this.parent.keys()) {
      const root = this.find(value);
      const group = grouped.get(root) ?? [];
      group.push(value);
      grouped.set(root, group);
    }
    return [...grouped.values()].map((group) => group.sort());
  }
}

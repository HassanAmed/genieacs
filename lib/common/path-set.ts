/**
#####################################    File Description    #######################################

This file implements set data structure for path type. So it has function that a set should have add
delete etc.

####################################################################################################
 */

import Path from "./path";
/**
 * @description Class to implement set(structure) for custom created path type
 */
export default class PathSet {
  private lengthIndex: Set<Path>[];
  private fragmentIndex: Map<string, Set<Path>>[];
  private stringIndex: Map<string, Path>;

  public constructor() {
    this.lengthIndex = [];
    this.fragmentIndex = [];
    this.stringIndex = new Map();
  }
/**
 * @description Get length
 */
  public get depth(): number {
    return this.lengthIndex.length;
  }
/**
 * @description add path element to set
 * @param path Path
 */
  public add(path: Path): Path {
    if (path.alias) throw new Error("PathSet does not support aliased paths");
    const p = this.get(path);

    if (p) return p;

    this.stringIndex.set(path.toString(), path);

    while (this.lengthIndex.length <= path.length) {
      this.lengthIndex.push(new Set());
      // fragmentIndex is one less than lengthIndex
      if (this.lengthIndex.length > 1) this.fragmentIndex.push(new Map());
    }

    const lengthIndex = this.lengthIndex[path.length];
    lengthIndex.add(path);

    for (let i = 0; i < path.length; ++i) {
      const fragment = path.segments[i] as string;
      const fragmentIndex = this.fragmentIndex[i];

      let fragmentIndexSet = fragmentIndex.get(fragment);
      if (!fragmentIndexSet) {
        fragmentIndexSet = new Set<Path>();
        fragmentIndex.set(fragment, fragmentIndexSet);
      }

      fragmentIndexSet.add(path);
    }

    return path;
  }

  public get(path: Path): Path {
    return this.stringIndex.get(path.toString()) || null;
  }
/**
 * @description find a path element in path-set
 */
  public find(
    path: Path,
    superset: boolean = false,
    subset: boolean = false,
    depth: number = path.length
  ): Path[] {
    if (path.alias) throw new Error("PathSet does not support aliased paths");

    const len = path.length;

    if (!superset && depth === len && (!subset || !path.wildcard)) {
      const p = this.get(path);
      return p ? [p] : [];
    }

    const lengthIndex = this.lengthIndex.slice(len, depth + 1);
    if (!lengthIndex.length) return [];

    let res;
    for (let i = len - 1; i >= 0; --i) {
      let fragmentIndexSet2;
      const fragmentIndex = this.fragmentIndex[i];

      if ((path.wildcard >> i) & 1) {
        if (subset) continue;
      } else if (superset) {
        fragmentIndexSet2 = fragmentIndex.get("*");
      }

      const fragment = path.segments[i] as string;
      const fragmentIndexSet1 = fragmentIndex.get(fragment);

      if (!fragmentIndexSet1) {
        if (!fragmentIndexSet2) return [];
        if (!res) res = [...fragmentIndexSet2];
        else res = res.filter(r => fragmentIndexSet2.has(r));
      } else if (!fragmentIndexSet2) {
        if (!res) res = [...fragmentIndexSet1];
        else res = res.filter(r => fragmentIndexSet1.has(r));
      } else {
        if (!res) {
          res = [...fragmentIndexSet1, ...fragmentIndexSet2];
        } else {
          res = res.filter(
            r => fragmentIndexSet1.has(r) || fragmentIndexSet2.has(r)
          );
        }
      }
      if (!res.length) return res;
    }

    if (!res) res = [].concat(...lengthIndex.map(a => [...a]));
    else res = res.filter(r => lengthIndex.some(a => a.has(r)));

    return res;
  }
}

import type {MultiverseIF, UniversalSchema, UniverseIF, UniverseName} from "./types.multiverse";


export class Multiverse implements MultiverseIF {

  baseSchema: UniversalSchema = {
    systems: new Map()
  };
  #universes: Map<string, any> = new Map();

  has(name: string) {
    return this.#universes.has(name);
  }
  get(name: UniverseName): UniverseIF | undefined {
    return this.#universes.get(name);
  }

  add(name: UniverseName, universe: UniverseIF, replace = false) {
    if ((!replace) && this.#universes.has(name)) {
      throw new Error(`Universe ${name} already exists`);
    }
    this.#universes.set(name, universe);
  }
}

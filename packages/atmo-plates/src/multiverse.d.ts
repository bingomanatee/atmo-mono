declare module '@wonderlandlabs/multiverse' {
  export const FIELD_TYPES: {
    readonly string: 'string';
    readonly number: 'number';
    readonly boolean: 'bool';
    readonly date: 'Date';
    readonly object: 'Object';
    readonly array: 'Array';
    readonly function: 'Function';
    readonly custom: 'custom';
    readonly any: '*';
  };

  export class SchemaUniversal<RecordType = Record<string, any>> {
    constructor(name: string, fields: Record<string, any>);
    name: string;
    fields: Record<string, any>;
  }

  export class SchemaLocal<RecordType = Record<string, any>> {
    constructor(name: string, fields: Record<string, any>);
    name: string;
    fields: Record<string, any>;
  }

  export class CollSync<RecordType = Record<string, any>, KeyType = string> {
    constructor(options: { name: string; universe?: Universe; schema?: any });
    name: string;
    schema: any;
    get(key: KeyType): RecordType | undefined;
    set(key: KeyType, value: RecordType): void;
    delete(key: KeyType): boolean;
    has(key: KeyType): boolean;
    keys(): KeyType[];
    values(): RecordType[];
    entries(): [KeyType, RecordType][];
    forEach(callback: (value: RecordType, key: KeyType) => void): void;
    size: number;
  }

  export class Universe {
    constructor(name: string, multiverse?: Multiverse);
    name: string;
    collections: Map<string, any>;
    add<RecordType = Record<string, any>, KeyType = string>(collection: any): any;
    get(name: string): any;
    has(name: string): boolean;
    delete(name: string): boolean;
    size: number;
  }

  export class Multiverse {
    constructor(schema?: any);
    addUniverse(name: string): Universe;
    getUniverse(name: string): Universe;
    get(name: string): Universe;
    hasUniverse(name: string): boolean;
    deleteUniverse(name: string): boolean;
    get size(): number;
    transport(
      key: string,
      collectionName: string,
      fromU: string,
      toU: string,
    ): any;
  }
}

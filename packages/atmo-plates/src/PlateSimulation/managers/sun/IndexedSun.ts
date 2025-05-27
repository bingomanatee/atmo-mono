import { SunMemory } from '@wonderlandlabs/multiverse/src/suns/SunMemory';
import { SunIndex } from './SunIndex';
import type { CollSyncIF } from '@wonderlandlabs/multiverse/src/types.coll';
import { SchemaLocal } from '@wonderlandlabs/multiverse';
import type { Universe } from '@wonderlandlabs/multiverse';
import type { TransportResult } from '@wonderlandlabs/multiverse/src/types.multiverse';
import type { SendProps } from '@wonderlandlabs/multiverse/src/types.multiverse';
import type { UniverseName } from '@wonderlandlabs/multiverse/src/types.multiverse';
import type { MutationAction } from '@wonderlandlabs/multiverse/src/types.multiverse';
import { STREAM_ACTIONS } from '@wonderlandlabs/multiverse/src/constants';
import type { Pair } from '@wonderlandlabs/multiverse/src/type.schema';
import { CollSync } from '@wonderlandlabs/multiverse/src/collections/CollSync';
import { isColl } from '@wonderlandlabs/multiverse/src/typeguards.multiverse';

export class IndexedSun<
    RecordType extends Record<string, any> = any,
    ValueType = any,
  >
  extends SunMemory<RecordType, string>
  implements CollSyncIF<RecordType, string>
{
  readonly #indexes: Map<string, SunIndex<RecordType, ValueType>> = new Map();
  readonly schema: SchemaLocal;
  readonly isAsync = false;

  constructor(props: {
    name: string;
    universe: Universe;
    schema: SchemaLocal;
  }) {
    const coll = new CollSync<RecordType, string>({
      name: props.name,
      schema: props.schema,
      universe: props.universe,
    });
    const collWithIterator = coll as unknown as CollSyncIF<RecordType, string>;
    Object.defineProperty(collWithIterator, Symbol.iterator, {
      value: function* () {
        for (const [key, value] of this.values()) {
          yield [key, value];
        }
      },
      enumerable: false,
      configurable: true,
    });
    super({
      schema: props.schema,
      coll: collWithIterator,
    });
    if (!isColl(collWithIterator)) {
      throw new Error(
        'IndexedSun: coll is required and must be a valid collection',
      );
    }
    this.schema = props.schema;
  }

  /**
   * Get a record by key
   * @param key - The key of the record to get
   * @returns The record or undefined if not found
   */
  get(key: string): RecordType | undefined {
    return super.get(key);
  }

  /**
   * Find records matching multiple criteria, using indexes for efficiency
   * @param criteria Array of [key, value] pairs to match
   * @returns Generator yielding Pair<KeyType, RecordType> of matching records
   */
  *find(...criteria: any[]): Generator<Pair<string, RecordType>> {
    if (criteria.length === 0) {
      throw new Error('At least one search criterion is required');
    }

    // Get or create index for first criterion
    const [firstKey, firstValue] = criteria[0];
    const index = this.#getIndex(firstKey);

    // If only one criterion, use index directly
    if (criteria.length === 1) {
      for (const [id, record] of index.find(firstValue)) {
        yield [id, record];
      }
      return;
    }

    // For multiple criteria, filter the indexed results
    const remainingCriteria = criteria.slice(1);
    for (const [id, record] of index.find(firstValue)) {
      // Check if record matches all remaining criteria
      const matchesAll = remainingCriteria.every(
        ([key, value]) => record[key] === value,
      );
      if (matchesAll) {
        yield [id, record];
      }
    }
  }

  /**
   * Get the set of keys for a specific value in an indexed field
   * @param field The field to look up
   * @param value The value to find keys for
   * @returns Set of keys or undefined if no matches
   */
  keysFor(field: keyof RecordType, value: ValueType): Set<string> | undefined {
    const index = this.#getIndex(field);
    return index.getKeysFor(value);
  }

  /**
   * Get or create an index for a field
   * @param field The field to index
   * @returns The index for the field
   */
  #getIndex(field: keyof RecordType): SunIndex<RecordType, ValueType> {
    const fieldStr = field as string;
    let index = this.#indexes.get(fieldStr);
    if (!index) {
      index = new SunIndex(this, fieldStr);
      this.#indexes.set(fieldStr, index);
    }
    return index;
  }

  /**
   * Override set to clear indexes
   */
  set(id: string, value: RecordType): void {
    super.set(id, value);
    this.#clearAllIndexes();
  }

  /**
   * Override delete to clear indexes
   */
  delete(id: string): void {
    super.delete(id);
    this.#clearAllIndexes();
  }

  /**
   * Clear all indexes
   */
  #clearAllIndexes(): void {
    for (const index of this.#indexes.values()) {
      index.clear();
    }
  }

  // Required CollSyncIF methods
  get name(): string {
    return this.id;
  }

  send(key: string, target: UniverseName): TransportResult {
    throw new Error('Method not implemented.');
  }

  sendAll(props: SendProps<RecordType, string>): TransportResult {
    throw new Error('Method not implemented.');
  }

  sendMany(
    keys: string[],
    props: SendProps<RecordType, string>,
  ): TransportResult {
    throw new Error('Method not implemented.');
  }

  *values(): Generator<Pair<string, RecordType>> {
    return super.values();
  }

  [Symbol.iterator](): Iterator<Pair<string, RecordType>> {
    return this.values();
  }

  map(
    mapper: (
      record: RecordType,
      key: string,
      collection: CollSyncIF<RecordType, string>,
    ) => RecordType | void | MutationAction,
    noTransaction?: boolean,
  ): Map<string, RecordType> {
    return super.map(mapper, noTransaction);
  }

  mutate(
    key: string,
    mutator: import('@wonderlandlabs/multiverse/src/types.coll').CollSyncMutator<
      RecordType,
      string
    >,
  ): RecordType | undefined {
    return super.mutate(key, mutator);
  }

  count(): number {
    return super.count();
  }

  each(
    callback: (
      record: RecordType,
      key: string,
      collection: CollSyncIF<RecordType, string>,
    ) => void,
  ): void {
    super.each(callback);
  }

  getMany(keys: string[]): Map<string, RecordType> {
    return super.getMany(keys);
  }

  // Schema properties
  get schemaName(): string {
    return this.schema.name || '';
  }

  get schemaType(): string {
    return this.schema.fields.type?.type || '';
  }

  get schemaFields(): Record<string, any> {
    return this.schema.fields;
  }

  get schemaFilter(): ((record: RecordType) => RecordType) | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaValidate(): ((record: RecordType) => boolean) | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaTransform(): ((record: RecordType) => RecordType) | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaDefault(): RecordType | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaRequired(): string[] | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaUnique(): string[] | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaIndex(): string[] | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaRelations(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaOptions(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaVersion(): number | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaDescription(): string | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaTags(): string[] | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaMetadata(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaCreated(): Date | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaUpdated(): Date | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaDeleted(): Date | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaStatus(): string | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaOwner(): string | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaGroup(): string | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaPermissions(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaAudit(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaHistory(): Record<string, any>[] | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaChanges(): Record<string, any>[] | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaDependencies(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaReferences(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaConstraints(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaValidations(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaRules(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaTriggers(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaHooks(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaCallbacks(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaEvents(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaListeners(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaSubscribers(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaObservers(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaWatchers(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaHandlers(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaMiddleware(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaPlugins(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaExtensions(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }

  get schemaCustom(): Record<string, any> | undefined {
    return undefined; // Not implemented in SchemaLocal
  }
}

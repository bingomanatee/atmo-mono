import type { CollBaseIF, FieldLocalIF, SunIF } from '../types.multiverse';
import { isObj } from '../typeguards.multiverse';
import { validateField } from '../utils/validateField';

export abstract class SunBase<RecordType, KeyType>
  implements SunIF<RecordType, KeyType>
{
  protected coll!: CollBaseIF;

  abstract set(key: KeyType, value: RecordType): void;

  abstract get(key: KeyType): RecordType | undefined;

  abstract delete(key: KeyType): void;

  abstract clear(): void;

  abstract has(key: KeyType): boolean;

  protected eachField(
    callback: (field: FieldLocalIF, ...rest: any[]) => void,
    ...args: any[]
  ) {
    for (const fieldName in this.coll.schema.fields) {
      const field = this.coll.schema.fields[fieldName];
      callback(field, fieldName, ...args);
    }
  }

  protected validateInput(input: any) {
    if (!isObj(input)) {
      throw new Error(
        'SunFBase.set: input must be an object. ' + JSON.stringify(input),
      );
    }

    const inputObj = input as Record<string, any>;
    this.eachField((field, fieldName) => {
      if (field.meta?.optional && inputObj[fieldName] === undefined) {
        return;
      }

      const result = validateField(
        inputObj[fieldName],
        fieldName,
        this.coll.schema,
        input,
      );
      if (result) {
        throw new Error(`\`validation error: ${fieldName}, ${result}`);
      }
    });
  }
}

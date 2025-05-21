# Data Conversion in Multiverse

This document explains the various mechanisms available for translating data
between universes in the Multiverse system.

## Table of Contents

1. [Introduction](#introduction)
2. [Schema Definitions](#schema-definitions)
3. [Field Mapping Mechanisms](#field-mapping-mechanisms)
   - [Direct Field Mapping](#direct-field-mapping)
   - [universalName Property](#universalname-property)
   - [univFields Property](#univfields-property)
   - [exportOnly Property](#exportonly-property)
4. [Data Transformation Functions](#data-transformation-functions)
   - [export Function](#export-function)
   - [import Function](#import-function)
   - [filter Function](#filter-function)
   - [filterRecord Function](#filterrecord-function)
5. [System Limitations](#system-limitations)
   - [Nested Structure Depth](#nested-structure-depth)
   - [Complex Data Types](#complex-data-types)
   - [Performance Considerations](#performance-considerations)
6. [Post-Processing Best Practices](#post-processing-best-practices)
7. [Examples](#examples)
   - [Basic Field Mapping](#basic-field-mapping)
   - [Nested Object Mapping](#nested-object-mapping)
   - [Complex Data Transformations](#complex-data-transformations)
   - [Bidirectional Mapping](#bidirectional-mapping)

## Introduction

In modern software development, the same underlying data often needs to be
represented in different ways across various systems and contexts. For example:

- JavaScript clients typically use camelCase properties, while REST APIs might
  use snake_case
- Frontend frameworks like React may need nested object structures, while
  databases prefer flat structures
- Some systems are synchronous (IndexedDB), while others are asynchronous (RxJS)
- Different platforms may have different data type requirements or conventions

The Multiverse system is a "translation engine" designed to reduce technical
debt by facilitating data exchange between different systems that represent the
same underlying data in different formats or structures. Rather than writing
custom conversion code for each interaction between systems, Multiverse provides
a standardized way to define these transformations.

### Common Use Cases

Multiverse can bridge the gap between various data systems such as:

- RxJS observables and REST APIs
- IndexedDB and server-side data models
- Redux/Immer state and external services
- Different microservices with varying data conventions

Each of these systems may have common capabilities (like getting and setting
records) but different data representations. Without a translation layer like
Multiverse, developers often end up writing significant amounts of boilerplate
code to convert between these representations.

### How It Works

The Multiverse system allows data to be shared between different "universes,"
each with its own schema and data structure. When data is transported between
universes, it is first converted to a universal format and then to the target
universe's format.

This conversion process is controlled by schema definitions that specify how
fields are mapped and transformed. By centralizing these transformation rules,
Multiverse helps maintain consistency and reduces the complexity of cross-system
data exchange.

## Big Picture & Glossary

Before diving into the technical details, it's helpful to understand how the
components of Multiverse map to real-world concepts:

| Multiverse Term | Real-World Equivalent    | Description                                                                                                                                    |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multiverse**  | Orchestration Layer      | The central system that connects multiple data stores together with messaging and manages data translation between them.                       |
| **Universe**    | Database or Client Store | Represents a distinct data store such as a database, client-side cache, or state management system (e.g., PostgreSQL, IndexedDB, Redux store). |
| **Collection**  | Table or Collection      | Equivalent to a database table, a collection in MongoDB, or an RxJS collection. Contains records of a specific type.                           |
| **Schema**      | Data Model               | Defines the structure and validation rules for data in a specific universe or in the universal format.                                         |
| **Record**      | Row or Document          | An individual data item, like a database row, document in MongoDB, or object in a client-side store.                                           |
| **Field**       | Column or Property       | A single piece of data within a record, like a database column or object property.                                                             |
| **Sun**         | Data Access Layer        | The interface for a specific data storage technology (e.g., IndexedDB, REST API).                                                              |

### Conceptual Flow

1. A record exists in Universe A (e.g., a client-side store)
2. The record needs to be sent to Universe B (e.g., a server database)
3. Multiverse converts the record from Universe A's format to the universal format
4. Multiverse then converts from the universal format to Universe B's format
5. The record is stored in Universe B

This translation process is bidirectional and can be applied to individual
records or collections of records.

## Schema Definitions

Schemas in Multiverse exist in two distinct places, serving different but
complementary purposes:

### Universal vs. Local Schemas

1. **Universal Schema (Global)**:

   - Resides in the central Multiverse
   - Must be expansive enough to include every atomic field that needs to be
     transmitted between any universes
   - Serves as the common language that all universes can translate to and from
   - Acts as an intermediary format for all data exchange

2. **Local Schema (Per Universe)**:
   - Each universe has its own schema for its specific representation of data
   - Can include fields that are local-only (not shared with other universes)
   - Must provide mapping information for universal fields it needs to interact with
   - Can structure data differently (nested vs. flat, different field names, etc.)

### Schema Relationship Requirements

For the system to work properly:

- Every field in the universal schema must have an analog in each local schema
  that needs to access that field
- Local schemas can have additional fields that aren't in the universal schema
  (these will be local-only)
- The universal schema acts as the "contract" between universes, defining what
  data can be exchanged
- Local schemas define how that contract is fulfilled in their specific context

For example, if Universe A and Universe B both need to share a user's email
address:

- The universal schema must have an `email` field
- Universe A might store it as `userEmail` in a flat structure
- Universe B might store it as `contact.emailAddress` in a nested structure
- Both local schemas must map their representation to the universal `email` field

There are two types of schema classes:

- **SchemaUniversal**: Defines the universal format that serves as the
  intermediate representation.
- **SchemaLocal**: Defines the format for a specific universe and includes
  mapping information.

## Field Mapping Mechanisms

### Direct Field Mapping

The simplest form of mapping is when field names in the local schema match
field names in the universal schema. In this case, no explicit mapping is
needed.

```typescript
// Universal schema
const universalSchema = new SchemaUniversal('users', {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  email: FIELD_TYPES.string,
});

// Local schema with direct mapping
const localSchema = new SchemaLocal('users', {
  id: { type: FIELD_TYPES.string },
  name: { type: FIELD_TYPES.string },
  email: { type: FIELD_TYPES.string },
});
```

### universalName Property

When field names differ between the local and universal schemas, the
`universalName` property can be used to specify the mapping.

```typescript
// Universal schema
const universalSchema = new SchemaUniversal('users', {
  id: FIELD_TYPES.string,
  full_name: FIELD_TYPES.string,
  email_address: FIELD_TYPES.string,
});

// Local schema with universalName mapping
const localSchema = new SchemaLocal('users', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  name: {
    type: FIELD_TYPES.string,
    universalName: 'full_name',
  },
  email: {
    type: FIELD_TYPES.string,
    universalName: 'email_address',
  },
});
```

### univFields Property

The `univFields` property is used to map fields from a nested local object to
flat universal fields. This is particularly useful for handling structural
differences between schemas.

```typescript
// Universal schema (flat structure)
const universalSchema = new SchemaUniversal('users', {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  street: FIELD_TYPES.string,
  city: FIELD_TYPES.string,
  zip: FIELD_TYPES.string,
});

// Local schema with nested address object
const localSchema = new SchemaLocal('users', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  name: {
    type: FIELD_TYPES.string,
    universalName: 'name',
  },
  address: {
    type: FIELD_TYPES.object,
    isLocal: true,
    univFields: {
      street: 'street',
      city: 'city',
      zipCode: 'zip',
    },
  },
});
```

### exportOnly Property

The `exportOnly` property indicates that a field should only be used when
converting from local to universal format, but not when converting from
universal to local.

```typescript
// Universal schema
const universalSchema = new SchemaUniversal('users', {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  full_name: FIELD_TYPES.string,
});

// Local schema with exportOnly field
const localSchema = new SchemaLocal('users', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  firstName: {
    type: FIELD_TYPES.string,
  },
  lastName: {
    type: FIELD_TYPES.string,
  },
  fullName: {
    type: FIELD_TYPES.string,
    universalName: 'full_name',
    exportOnly: true,
    export: ({ inputRecord }) => {
      return `${inputRecord.firstName} ${inputRecord.lastName}`;
    },
  },
});
```

## Data Transformation Functions

### export Function

The `export` function is used to transform data when converting from local to
universal format.

```typescript
// Local schema with export function
const localSchema = new SchemaLocal('events', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  date: {
    type: FIELD_TYPES.date,
    universalName: 'date',
    export: ({ newValue }) => {
      if (newValue instanceof Date) {
        return newValue.toISOString();
      }
      return newValue ? String(newValue) : '';
    },
  },
});
```

### import Function

The `import` function is used to transform data when converting from universal
to local format.

```typescript
// Local schema with import function
const localSchema = new SchemaLocal('events', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  date: {
    type: FIELD_TYPES.date,
    universalName: 'date',
    import: ({ value }) => {
      if (typeof value === 'string') {
        return new Date(value);
      }
      return value;
    },
  },
});
```

### filter Function

The `filter` function is similar to `import` but is used when a simpler
transformation is needed.

```typescript
// Local schema with filter function
const localSchema = new SchemaLocal('products', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  price: {
    type: FIELD_TYPES.number,
    universalName: 'price',
    filter: ({ value }) => {
      return Number(value) || 0;
    },
  },
});
```

### filterRecord Function

The `filterRecord` function is applied to the entire record after all
field-level transformations.

```typescript
// Local schema with filterRecord function
const localSchema = new SchemaLocal('products', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  price: {
    type: FIELD_TYPES.number,
    universalName: 'price',
  },
  salePrice: {
    type: FIELD_TYPES.number,
  },
  filterRecord: ({ inputRecord }) => {
    // Calculate sale price as 90% of regular price
    inputRecord.salePrice = inputRecord.price * 0.9;
    return inputRecord;
  },
});
```

## Examples

### Basic Field Mapping

```typescript
// Universal schema
const universalSchema = new SchemaUniversal('users', {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  email: FIELD_TYPES.string,
});

// Local schema for Universe A
const schemaA = new SchemaLocal('users', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  fullName: {
    type: FIELD_TYPES.string,
    universalName: 'name',
  },
  emailAddress: {
    type: FIELD_TYPES.string,
    universalName: 'email',
  },
});

// Local schema for Universe B
const schemaB = new SchemaLocal('users', {
  userId: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  displayName: {
    type: FIELD_TYPES.string,
    universalName: 'name',
  },
  contactEmail: {
    type: FIELD_TYPES.string,
    universalName: 'email',
  },
});

// Data in Universe A
const userA = {
  id: '123',
  fullName: 'John Doe',
  emailAddress: 'john@example.com',
};

// Converted to universal format
const universalUser = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
};

// Converted to Universe B format
const userB = {
  userId: '123',
  displayName: 'John Doe',
  contactEmail: 'john@example.com',
};
```

### Nested Object Mapping

```typescript
// Universal schema (flat)
const universalSchema = new SchemaUniversal('contacts', {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  street: FIELD_TYPES.string,
  city: FIELD_TYPES.string,
  state: FIELD_TYPES.string,
  zip: FIELD_TYPES.string,
  phone: FIELD_TYPES.string,
});

// Local schema with nested objects
const localSchema = new SchemaLocal('contacts', {
  id: {
    type: FIELD_TYPES.string,
    universalName: 'id',
  },
  name: {
    type: FIELD_TYPES.string,
    universalName: 'name',
  },
  address: {
    type: FIELD_TYPES.object,
    isLocal: true,
    univFields: {
      street: 'street',
      city: 'city',
      state: 'state',
      zipCode: 'zip',
    },
  },
  contactInfo: {
    type: FIELD_TYPES.object,
    isLocal: true,
    univFields: {
      phoneNumber: 'phone',
    },
  },
});

// Local data
const contact = {
  id: '456',
  name: 'Jane Smith',
  address: {
    street: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
  },
  contactInfo: {
    phoneNumber: '555-123-4567',
  },
};

// Universal data
const universalContact = {
  id: '456',
  name: 'Jane Smith',
  street: '123 Main St',
  city: 'Anytown',
  state: 'CA',
  zip: '12345',
  phone: '555-123-4567',
};
```

For more examples and detailed documentation, refer to the test files in the
codebase.

## System Limitations

The Multiverse conversion system is powerful but has some important limitations
to be aware of.

### Nested Structure Depth

The system is primarily designed for handling relatively flat data structures
or structures with limited nesting (1-2 levels deep). While the `univFields`
property can map nested fields, there are limitations:

- Deep nesting (3+ levels) can become difficult to manage and maintain
- Complex nested arrays of objects may require custom transformation functions
- Circular references are not supported and will cause errors

For deeply nested structures, consider:

1. Flattening your data model where possible
2. Using custom `export` and `import` functions for complex transformations
3. Breaking complex objects into separate collections with references

### Complex Data Types

The universal schema is designed for simple data types. Complex types require
special handling:

- **Dates**: The universal schema typically stores dates as strings, requiring
  conversion
- **Binary Data**: Must be encoded/decoded (e.g., Base64) during conversion
- **Custom Objects**: Need to be serialized/deserialized with custom functions
- **Functions**: Cannot be transported between universes

Example of date handling:

```typescript
const schema = new SchemaLocal('events', {
  id: { type: FIELD_TYPES.string },
  eventDate: {
    type: FIELD_TYPES.date,
    universalName: 'event_date',
    // Convert Date to ISO string when going to universal
    export: ({ newValue }) => {
      if (newValue instanceof Date) {
        return newValue.toISOString();
      }
      return String(newValue || '');
    },
    // Parse string back to Date when coming from universal
    import: ({ value }) => {
      if (typeof value === 'string' && value) {
        return new Date(value);
      }
      return value || null;
    },
  },
});
```

### Referential Identity Limitations

The Multiverse system does not maintain referential identity during data
conversion. When data is transported between universes:

- New object instances are always created
- Object references are not preserved
- Circular references will cause issues
- Shared references to the same object will become separate copies

This means the system is only suitable for scenarios where value equality is
important, not referential identity. For example:

```typescript
// In Universe A
const obj1 = { id: 1, name: 'Shared' };
const record1 = { id: 'rec1', sharedObj: obj1 };
const record2 = { id: 'rec2', sharedObj: obj1 }; // Same reference as
record1.sharedObj;

// After transport to Universe B
const record1B = universeB.get('records').get('rec1');
const record2B = universeB.get('records').get('rec2');

// These are now different objects with the same values
console.log(record1B.sharedObj === record2B.sharedObj); // false
console.log(record1B.sharedObj.name === record2B.sharedObj.name); // true
```

If your application relies on object identity or shared references, you'll need
to implement additional logic outside the Multiverse system to restore these
relationships.

### Performance Considerations

The conversion process involves multiple steps and can impact performance:

- Each field may go through multiple transformations
- Complex `export` and `import` functions can be computationally expensive
- Large datasets with many fields will take longer to process
- Field maps are cached, but the transformation process still occurs for each
  record

For performance-critical applications:

- Minimize the number of fields that require transformation
- Keep transformation functions simple and efficient
- Consider batching operations when working with large datasets

## Post-Processing Best Practices

The Multiverse system provides several post-processing functions that should be
used for specific purposes:

### Field-Level Processing

Field-level functions should be used for transformations that only depend on
the field's value:

- **export/import**: Use for type conversions (e.g., Date ↔ String)
- **filter**: Use for simple value transformations (e.g., formatting,
  normalization)

```typescript
const schema = new SchemaLocal('users', {
  name: {
    type: FIELD_TYPES.string,
    // Normalize case during import
    filter: ({ value }) => {
      if (typeof value === 'string') {
        return value.trim().toLowerCase();
      }
      return value;
    },
  },
});
```

### Record-Level Processing

Record-level functions should be used for transformations that depend on
multiple fields:

- **filterRecord**: Use for business logic that requires multiple fields
- **import (schema level)**: Use for complex record initialization

```typescript
const schema = new SchemaLocal('orders', {
  // Field definitions...

  // Calculate total based on items and tax
  filterRecord: ({ inputRecord }) => {
    const subtotal = inputRecord.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    inputRecord.subtotal = subtotal;
    inputRecord.tax = subtotal * 0.08;
    inputRecord.total = subtotal + inputRecord.tax;
    return inputRecord;
  },
});
```

### When to Use Each Function

- **Field export/import**: For bidirectional type conversions
- **Field filter**: For simple value normalization
- **Record filterRecord**: For derived fields and cross-field validations
- **Schema import**: For complex initialization logic

Remember that these functions are executed in a specific order:

1. Field-level `import` functions are applied first
2. Field-level `filter` functions are applied next
3. Record-level `filterRecord` function is applied last

This order ensures that all field-level transformations are complete before
record-level business logic is applied.

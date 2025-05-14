#  Multiverse

Multiverse is a synchronization engine for sending records and signals between multiple scopes, called _Universes_.
it has a "base" / multiveral schema describing the collections that universes must realize; these colelctions have a
"base" field definition in the multiverse. In order to translate from one collection to another they must all be able
to write to this baseline schema and have records created by that.

## Universes

A Universe is a data collection; it can be

* A Database
* A remote server
* A local memory system (POJO or RXJS etc.)

The assumption is each Universe has (largely) the same collections. They may have different name patterns, formats,
and some may have unique fields or be represented by classes, but they all can be described with a single 
basic _schema_.

## Schema

Schema is a collection of field definitions. Whether local or multiversal has the same basic signature:

* _type_: a string (see FIELD_TYPES) describing its format. 
* _meta_: a recocd of optional decotators including 
  - optional (!required)
  - filter (a function that post-processes each field as it is written in)
  - local (a field unique to a universe - not sent back and forth)

### Local and Export fields

By default all fields on all collections in all Universes have matching members in the base / multiversal schema.
They may have different names and may even have different types but they all have some entry in their schema for each
universal field. If their name is different than the universal field the schema will have a "universalName" property
to map the schema back to its baseline.  


There ay be "local fields" (isLocal = true) that are universe specific, but they are defined in such a way that they 
are not expected to be transported out to other scopes.
And there are also "export" entries in the schema marked with "exportOnly"

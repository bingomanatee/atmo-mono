#  Multiverse

Multiverse is a synchronniztion engien for sending records and signals between multiple scopes, called _Universes_.

## Universes

A Universe is a data collection; it can be

* A Database
* A remote server
* A local memory system (POJO or RXJS etc.)

The assumption is each Universe has (largely) the same collections. They may have different name patterns, formats,
and some may have unique fields or be represented by classes, but they all can be described with a single 
basic _universal schema_. 

## Schema

Schema whether local or universal has the same basic signature:

* _type_: a string (see FIELD_TYPES) describing its format. 
* _meta_: a recocd of optional decotators including 
  - optional (!required)
  - filter (a function that post-processes each field as it is written in)
  - local (a field unique to a universe - not sent back and forth)
  - 

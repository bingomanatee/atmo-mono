  describe('sendMany', () => {
    let multiverse: Multiverse;
    let serverUniverse: Universe;
    let clientUniverse: Universe;
    let serverCollection: CollSync<any, string>;
    let clientCollection: CollSync<any, string>;
    let schema: SchemaLocal;

    beforeEach(() => {
      // Create a multiverse with a universal schema
      multiverse = new Multiverse();
      const universalSchema = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        age: { type: FIELD_TYPES.number },
        status: { type: FIELD_TYPES.string, meta: { optional: true } },
      });
      multiverse.baseSchemas.set('users', universalSchema);

      // Create server universe and collection
      serverUniverse = new Universe('server', multiverse);
      schema = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.string, universalName: 'id' },
        name: { type: FIELD_TYPES.string, universalName: 'name' },
        age: { type: FIELD_TYPES.number, universalName: 'age' },
        status: { type: FIELD_TYPES.string, universalName: 'status', meta: { optional: true } },
      });
      serverCollection = new CollSync({
        name: 'users',
        schema,
        universe: serverUniverse,
      });

      // Create client universe and collection
      clientUniverse = new Universe('client', multiverse);
      schema = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.string, universalName: 'id' },
        name: { type: FIELD_TYPES.string, universalName: 'name' },
        age: { type: FIELD_TYPES.number, universalName: 'age' },
        status: { type: FIELD_TYPES.string, universalName: 'status', meta: { optional: true } },
      });
      clientCollection = new CollSync({
        name: 'users',
        schema,
        universe: clientUniverse,
      });

      // Add some test data to the server collection
      serverCollection.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
      serverCollection.set('user2', { id: 'user2', name: 'Jane Smith', age: 25 });
      serverCollection.set('user3', { id: 'user3', name: 'Bob Johnson', age: 40, status: 'active' });
      serverCollection.set('user4', { id: 'user4', name: 'Alice Brown', age: 35, status: 'active' });
    });

    it('should send multiple records to another universe', async () => {
      // Spy on the transportGenerator method
      const transportSpy = vi.spyOn(multiverse, 'transportGenerator');

      // Send multiple records from server to client
      const keys = ['user1', 'user2', 'user3'];
      const sendStream = serverCollection.sendMany(keys, 'client');

      // Collect all progress updates
      const updates = await firstValueFrom(sendStream.pipe(toArray()));

      // Check that transportGenerator was called with the correct parameters
      expect(transportSpy).toHaveBeenCalledWith(
        expect.any(Object), // Generator
        'users',           // Collection name
        'server',          // Source universe
        'client',          // Target universe
      );

      // Check the final update
      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate.processed).toBe(3);
      expect(finalUpdate.successful).toBe(3);
      expect(finalUpdate.failed).toBe(0);
      expect(finalUpdate.total).toBe(3);

      // Verify the transported records
      expect(clientCollection.get('user1')).toEqual(serverCollection.get('user1'));
      expect(clientCollection.get('user2')).toEqual(serverCollection.get('user2'));
      expect(clientCollection.get('user3')).toEqual(serverCollection.get('user3'));
    });

    it('should handle errors when sending records', async () => {
      // Mock the send method to throw an error for a specific key
      const originalSend = serverCollection.send;
      serverCollection.send = vi.fn((key, target) => {
        if (key === 'user2') {
          throw new Error('Test error');
        }
        return originalSend.call(serverCollection, key, target);
      });

      // Send multiple records from server to client
      const keys = ['user1', 'user2', 'user3'];
      const sendStream = serverCollection.sendMany(keys, 'client');

      // Collect all progress updates
      const updates = await firstValueFrom(sendStream.pipe(toArray()));

      // Check the final update
      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate.processed).toBe(3);
      expect(finalUpdate.successful).toBe(2);
      expect(finalUpdate.failed).toBe(1);

      // Verify the transported records
      expect(clientCollection.get('user1')).toEqual(serverCollection.get('user1'));
      expect(clientCollection.get('user2')).toBeUndefined(); // Failed to transport
      expect(clientCollection.get('user3')).toEqual(serverCollection.get('user3'));
    });
  });

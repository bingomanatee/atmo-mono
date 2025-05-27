import { beforeEach, describe, expect, it } from 'vitest';
import { CollSync } from './collections/CollSync';
import { FIELD_TYPES } from './constants';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import type {
  Purchase,
  ServerPurchase,
  ServerUser,
  User,
} from './streaming.types';
import { Universe } from './Universe';
import { generatorToMap } from './utils.sun';

describe('Streaming Data Transport', () => {
  let multiverse: Multiverse;
  let clientUniverse: Universe;
  let serverUniverse: Universe;

  // Client collections (camelCase)
  let clientUsers: CollSync<User, number>;
  let clientPurchases: CollSync<Purchase, number>;

  // Server collections (snake_case)
  let serverUsers: CollSync<ServerUser, number>;
  let serverPurchases: CollSync<ServerPurchase, number>;

  // Sample data
  const sampleUsers: User[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com' },
    { id: 5, name: 'Charlie Davis', email: 'charlie@example.com' },
  ];

  const samplePurchases: Purchase[] = [
    {
      id: 101,
      userId: 1,
      productName: 'Laptop',
      price: 1200,
      date: '2023-01-15',
    },
    { id: 102, userId: 1, productName: 'Mouse', price: 25, date: '2023-01-16' },
    {
      id: 103,
      userId: 2,
      productName: 'Keyboard',
      price: 50,
      date: '2023-02-10',
    },
    {
      id: 104,
      userId: 3,
      productName: 'Monitor',
      price: 300,
      date: '2023-03-05',
    },
    {
      id: 105,
      userId: 4,
      productName: 'Headphones',
      price: 150,
      date: '2023-03-20',
    },
    {
      id: 106,
      userId: 2,
      productName: 'Webcam',
      price: 80,
      date: '2023-04-12',
    },
    {
      id: 107,
      userId: 5,
      productName: 'Tablet',
      price: 500,
      date: '2023-05-01',
    },
    {
      id: 108,
      userId: 3,
      productName: 'Docking Station',
      price: 200,
      date: '2023-05-15',
    },
    {
      id: 109,
      userId: 1,
      productName: 'External SSD',
      price: 120,
      date: '2023-06-10',
    },
    {
      id: 110,
      userId: 4,
      productName: 'Wireless Charger',
      price: 40,
      date: '2023-06-25',
    },
  ];

  // Convert client data to server format
  const serverUserData: ServerUser[] = sampleUsers.map((user) => ({
    id: user.id,
    user_name: user.name,
    user_email: user.email,
  }));

  const serverPurchaseData: ServerPurchase[] = samplePurchases.map(
    (purchase) => ({
      id: purchase.id,
      user_id: purchase.userId,
      product_name: purchase.productName,
      product_price: purchase.price,
      purchase_date: purchase.date,
    }),
  );

  beforeEach(() => {
    // Create universal schemas
    const universalSchemas = new Map([
      [
        'users',
        new SchemaUniversal('users', {
          id: FIELD_TYPES.number,
          name: FIELD_TYPES.string,
          email: FIELD_TYPES.string,
        }),
      ],
      [
        'purchases',
        new SchemaUniversal('purchases', {
          id: FIELD_TYPES.number,
          userId: FIELD_TYPES.number,
          productName: FIELD_TYPES.string,
          price: FIELD_TYPES.number,
          date: FIELD_TYPES.string,
        }),
      ],
    ]);

    // Create multiverse with universal schemas
    multiverse = new Multiverse(universalSchemas);

    // Create universes
    clientUniverse = new Universe('client', multiverse);
    serverUniverse = new Universe('server', multiverse);

    // Create client collections with camelCase schema
    clientUsers = new CollSync<User, number>({
      name: 'users',
      universe: clientUniverse,
      schema: new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
        name: { type: FIELD_TYPES.string },
        email: { type: FIELD_TYPES.string },
      }),
    });

    clientPurchases = new CollSync<Purchase, number>({
      name: 'purchases',
      universe: clientUniverse,
      schema: new SchemaLocal('purchases', {
        id: { type: FIELD_TYPES.number },
        userId: { type: FIELD_TYPES.number },
        productName: { type: FIELD_TYPES.string },
        price: { type: FIELD_TYPES.number },
        date: { type: FIELD_TYPES.string },
      }),
    });

    // Create server collections with snake_case schema
    serverUsers = new CollSync<ServerUser, number>({
      name: 'users',
      universe: serverUniverse,
      schema: new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
        user_name: { type: FIELD_TYPES.string, universalName: 'name' },
        user_email: {
          type: FIELD_TYPES.string,
          universalName: 'email',
          validator(value, props) {
            if (typeof value !== 'string') {
              throw new Error('email must be a string');
            }
            if (!/.+@.+\..+/.test(value)) {
              throw new Error('email must be a valid email address');
            }
          },
        },
      }),
    });

    serverPurchases = new CollSync<ServerPurchase, number>({
      name: 'purchases',
      universe: serverUniverse,
      schema: new SchemaLocal('purchases', {
        id: { type: FIELD_TYPES.number },
        user_id: { type: FIELD_TYPES.number, universalName: 'userId' },
        product_name: {
          type: FIELD_TYPES.string,
          universalName: 'productName',
        },
        product_price: { type: FIELD_TYPES.number, universalName: 'price' },
        purchase_date: { type: FIELD_TYPES.string, universalName: 'date' },
      }),
    });

    // Add collections to universes
    clientUniverse.add(clientUsers);
    clientUniverse.add(clientPurchases);
    serverUniverse.add(serverUsers);
    serverUniverse.add(serverPurchases);

    // Populate server collections with sample data
    serverUserData.forEach((user) => serverUsers.set(user.id, user));
    serverPurchaseData.forEach((purchase) =>
      serverPurchases.set(purchase.id, purchase),
    );
  });

  describe('transportGenerator', () => {
    it('should stream records from server to client', async () => {
      // Get a generator of users from the server
      const userGenerator = serverUsers.values();
      const clients = new Map(clientUniverse.get('users')!.values());
      expect(clients.size).toBe(0);

      // Transport the generator to the client
      await new Promise<void>((resolve) => {
        let subscription: any = null;
        subscription = multiverse.transportGenerator({
          generator: userGenerator,
          collectionName: 'users',
          fromU: 'server',
          toU: 'client',
          listener: {
            complete() {
              subscription?.unsubscribe();
              resolve();
            },
            error(err) {
              subscription?.unsubscribe();
              resolve();
            },
          },
        });
      });

      const newClients = new Map(clientUniverse.get('users')!.values());
      expect(newClients.size).toBe(5);

      expect(newClients.get(5)).toEqual({
        id: 5,
        name: 'Charlie Davis',
        email: 'charlie@example.com',
      });
      expect(newClients.get(1)).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(Array.from(newClients.keys()).sort()).toEqual([1, 2, 3, 4, 5]);
    }, 10000);

    it('should handle errors during transport', async () => {
      clientUniverse
        .get('users')!
        .set(1, { id: 1, name: 'John Doe', email: 'badly formatted email' });

      const userGenerator = clientUsers.values();

      // Use a promise to properly handle the async nature of the test
      return new Promise<void>((resolve) => {
        let subscription: any = null;
        subscription = multiverse.transportGenerator({
          generator: userGenerator,
          collectionName: 'users',
          fromU: 'client',
          toU: 'server',
          listener: {
            next(msg) {
              if (msg.error) {
                expect(msg.error).toBeInstanceOf(Error);
                expect(msg.error.message).toMatch(
                  /must be a valid email address/,
                );

                // Clean up subscription and resolve the promise
                subscription?.unsubscribe();
                resolve();
              }
            },
            error(err) {
              console.log('error is ', err);
              // Clean up and resolve even on error
              subscription?.unsubscribe();
              resolve();
            },
            complete() {
              // Clean up and resolve when complete
              subscription?.unsubscribe();
              resolve();
            },
          },
        });
      });
    });
  });

  describe('find', () => {
    it('should find records and return them as a generator', async () => {
      // Find users with IDs 1 and 3 using generator
      const userGenerator = serverUsers.find(
        (record) => record.id === 1 || record.id === 3,
      );

      const users = generatorToMap(userGenerator);
      expect(Array.from(users.keys()).sort()).toEqual([1, 3]);
    });
    it('should find records and return them as a generator', async () => {
      // Find users with IDs 1 and 3 using generator
      const userGenerator = serverUsers.find(
        (record) => record.id === 1 || record.id === 3,
      );

      const users = generatorToMap(userGenerator);
      console.log('Found users:', Array.from(users.entries()));
      console.log('User keys:', Array.from(users.keys()));
      expect(Array.from(users.keys()).sort()).toEqual([1, 3]);
    });
  });
});

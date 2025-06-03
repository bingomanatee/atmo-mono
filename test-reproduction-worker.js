// Reproduction Worker - Shares the same population database
importScripts("https://unpkg.com/dexie@3.2.4/dist/dexie.min.js");

class SharedDexieManager {
  constructor(dbName, schemas, dontClear = true) {
    // Workers don't clear by default
    this.dbName = dbName;
    this.schemas = schemas;
    this.dontClear = dontClear;
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log("🤖 Worker: Connecting to population database...");

      this.db = new Dexie(this.dbName);

      const stores = {};
      for (const [tableName, schema] of Object.entries(this.schemas)) {
        const indexes = this.extractIndexes(schema);
        const indexString = ["id", ...indexes].join(",");
        stores[tableName] = indexString;
      }

      this.db.version(1).stores(stores);
      await this.db.open();

      this.isInitialized = true;
      console.log(`✅ Worker: Connected to population database`);
    } catch (error) {
      console.error("❌ Worker: Database connection failed:", error);
      throw error;
    }
  }

  extractIndexes(schema) {
    const indexes = [];
    for (const [fieldName, field] of Object.entries(schema.fields)) {
      if (field.meta?.index === true) {
        indexes.push(fieldName);
      }
    }
    return indexes;
  }

  getTable(tableName) {
    if (!this.isInitialized || !this.db) {
      throw new Error(`Worker: Database not ready for ${tableName}`);
    }
    return this.db.table(tableName);
  }
}

// Worker state
let manager;
const workerNames = [
  "Zara",
  "Kai",
  "Nova",
  "Orion",
  "Luna",
  "Atlas",
  "Iris",
  "Zephyr",
];

// Worker message handler
self.onmessage = async function (e) {
  const { command, schemas } = e.data;

  try {
    switch (command) {
      case "init":
        await initWorker(schemas);
        break;
      case "breed":
        await workerBreeding();
        break;
      case "add-immigrant":
        await addImmigrant();
        break;
      case "population-report":
        await populationReport();
        break;
      default:
        console.warn("🤖 Worker: Unknown command:", command);
    }
  } catch (error) {
    console.error("❌ Worker: Command failed:", error);
    self.postMessage({
      type: "error",
      message: error.message,
      command,
    });
  }
};

async function initWorker(schemas) {
  try {
    self.postMessage({
      type: "status",
      message: "Connecting to population...",
    });

    manager = new SharedDexieManager("reproduction-sim", schemas, true);
    await manager.initialize();

    self.postMessage({ type: "status", message: "Connected! 🤖" });
    console.log("🤖 Worker: Ready to manipulate population");

    // Report current population
    await populationReport();

    // Start autonomous breeding behavior
    setTimeout(() => autonomousBreeding(), 5000);
  } catch (error) {
    self.postMessage({ type: "status", message: `Error - ${error.message}` });
    console.error("❌ Worker initialization failed:", error);
  }
}

async function workerBreeding() {
  console.log("🤖 Worker: Initiating breeding program...");

  const peopleTable = manager.getTable("people");
  const relationshipsTable = manager.getTable("relationships");

  // Find unmarried people
  const allPeople = await peopleTable.toArray();
  const singles = allPeople.filter(
    (p) => p.isAlive && p.age >= 18 && (!p.marriedTo || p.marriedTo === "")
  );

  if (singles.length >= 2) {
    // Worker strategy: pair up randomly regardless of gender (progressive worker!)
    const person1 = singles[Math.floor(Math.random() * singles.length)];
    const person2 = singles.filter((p) => p.id !== person1.id)[
      Math.floor(Math.random() * (singles.length - 1))
    ];

    if (person1 && person2) {
      // Create union
      person1.marriedTo = person2.id;
      person2.marriedTo = person1.id;

      await peopleTable.put(person1);
      await peopleTable.put(person2);

      const relationship = {
        id: `worker_union_${Date.now()}`,
        personA: person1.id,
        personB: person2.id,
        type: "marriage",
        startTime: Date.now(),
        isActive: true,
      };
      await relationshipsTable.put(relationship);

      console.log(`🤖 Worker: United ${person1.name} with ${person2.name}`);

      // Immediate reproduction (worker is efficient!)
      await createOffspring(person1, person2);

      self.postMessage({
        type: "population-changed",
        action: "worker-breeding",
        couple: [person1.name, person2.name],
      });
    }
  } else {
    console.log("🤖 Worker: Not enough singles for breeding");
    // Add immigrants to increase genetic diversity
    await addImmigrant();
  }
}

async function createOffspring(parent1, parent2) {
  const peopleTable = manager.getTable("people");
  const relationshipsTable = manager.getTable("relationships");

  // Worker creates multiple offspring (efficient reproduction!)
  const numOffspring = 1 + Math.floor(Math.random() * 3); // 1-3 children

  for (let i = 0; i < numOffspring; i++) {
    const child = {
      id: `worker_child_${Date.now()}_${i}`,
      name: `${workerNames[Math.floor(Math.random() * workerNames.length)]}-${
        i + 1
      }`,
      gender: Math.random() > 0.5 ? "male" : "female",
      age: 0,
      marriedTo: "",
      parentA: parent1.id,
      parentB: parent2.id,
      generation:
        Math.max(parent1.generation || 0, parent2.generation || 0) + 1,
      birthTime: Date.now(),
      isAlive: true,
    };

    await peopleTable.put(child);

    // Create parent-child relationships
    await relationshipsTable.put({
      id: `worker_parent_${Date.now()}_${i}_A`,
      personA: parent1.id,
      personB: child.id,
      type: "parent-child",
      startTime: Date.now(),
      isActive: true,
    });

    await relationshipsTable.put({
      id: `worker_parent_${Date.now()}_${i}_B`,
      personA: parent2.id,
      personB: child.id,
      type: "parent-child",
      startTime: Date.now(),
      isActive: true,
    });

    console.log(`🤖👶 Worker created: ${child.name} (Gen ${child.generation})`);
  }
}

async function addImmigrant() {
  const peopleTable = manager.getTable("people");

  const immigrant = {
    id: `immigrant_${Date.now()}`,
    name: `${
      workerNames[Math.floor(Math.random() * workerNames.length)]
    } Immigrant`,
    gender: Math.random() > 0.5 ? "male" : "female",
    age: 20 + Math.floor(Math.random() * 15), // 20-35 years old
    marriedTo: "",
    parentA: "", // Unknown parents (immigrant)
    parentB: "",
    generation: 0, // Fresh genetic material
    birthTime: Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000, // Born 0-10 years ago
    isAlive: true,
  };

  await peopleTable.put(immigrant);
  console.log(`🤖🌍 Worker: Added immigrant ${immigrant.name}`);

  self.postMessage({
    type: "population-changed",
    action: "immigration",
    immigrant: immigrant.name,
  });
}

async function populationReport() {
  const peopleTable = manager.getTable("people");
  const relationshipsTable = manager.getTable("relationships");

  const allPeople = await peopleTable.toArray();
  const totalPeople = allPeople.filter((p) => p.isAlive === true).length;

  const allRelationships = await relationshipsTable.toArray();
  const marriages = allRelationships.filter(
    (r) => r.type === "marriage" && r.isActive
  ).length;

  const children = allPeople.filter(
    (p) => p.parentA && p.parentA !== ""
  ).length;

  console.log(
    `🤖📊 Worker Report: ${totalPeople} people, ${marriages} marriages, ${children} children`
  );

  self.postMessage({
    type: "population-report",
    totalPeople,
    marriages,
    children,
  });
}

async function autonomousBreeding() {
  console.log("🤖🔄 Worker: Starting autonomous breeding cycle...");

  try {
    // Check if breeding is needed
    const peopleTable = manager.getTable("people");
    const allPeople = await peopleTable.toArray();
    const population = allPeople.filter((p) => p.isAlive === true).length;

    if (population < 20) {
      // Keep population growing
      await workerBreeding();
    }

    // Schedule next breeding cycle
    setTimeout(() => autonomousBreeding(), 10000 + Math.random() * 10000); // 10-20 seconds
  } catch (error) {
    console.error("🤖❌ Autonomous breeding failed:", error);
    // Retry in a bit
    setTimeout(() => autonomousBreeding(), 15000);
  }
}

console.log("🤖 Reproduction Worker loaded and ready to breed!");

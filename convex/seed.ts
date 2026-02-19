import { mutation } from "./_generated/server";

// ============================================================
// SEED DATA — CCS Technologies Operational Platform
// ============================================================
// Run:   npx convex run seed:run
// Clear: npx convex run seed:clear
//
// Inserts real CCS components, realistic inventory levels,
// active POs, alerts, and tasks so every mobile screen has
// content to display.
// ============================================================

export const run = mutation({
  handler: async (ctx) => {
    // Guard: don't double-seed
    const existingComponents = await ctx.db.query("components").take(1);
    if (existingComponents.length > 0) {
      throw new Error(
        "Database already has data. Run seed:clear first if you want to re-seed."
      );
    }

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // ===========================================================
    // 1. SUPPLIERS
    // ===========================================================
    const supDigiKey = await ctx.db.insert("suppliers", {
      name: "DigiKey",
      code: "DK",
      website: "https://www.digikey.com",
      notes: "Primary electronics supplier, fast shipping",
      rating: 5,
      leadTimeDays: 3,
      shippingNotes: "Free shipping over $50",
      status: "preferred",
      updatedAt: now,
    });

    const supMouser = await ctx.db.insert("suppliers", {
      name: "Mouser",
      code: "MOU",
      website: "https://www.mouser.com",
      notes: "Good for specialty ICs",
      rating: 4,
      leadTimeDays: 3,
      shippingNotes: "Free shipping over $50",
      status: "active",
      updatedAt: now,
    });

    const supJLCPCB = await ctx.db.insert("suppliers", {
      name: "JLCPCB",
      code: "JLC",
      website: "https://jlcpcb.com",
      notes: "PCBs and SMT assembly",
      rating: 4,
      leadTimeDays: 14,
      shippingNotes: "DHL Express ~5 days from Shenzhen",
      status: "active",
      updatedAt: now,
    });

    // ===========================================================
    // 2. COMPONENTS
    // ===========================================================
    const cESP32C3 = await ctx.db.insert("components", {
      partNumber: "CCS-MCU-001",
      name: "ESP32-C3 SuperMini",
      description: "Low-power WiFi+BLE MCU, RISC-V core. Used in Oil Heater Controller, RaceScale, Tire Temp Probe",
      category: "mcu",
      subcategory: "wifi_ble",
      manufacturer: "Espressif",
      manufacturerPartNumber: "ESP32-C3-MINI-1",
      unitOfMeasure: "each",
      specs: { voltage: "3.3V", custom: { flash: "4MB", arch: "RISC-V", cores: 1 } },
      status: "active",
      usedInProducts: ["Oil_Heater_Controller", "RaceScale", "Tire-Temp-Probe"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cESP32S3 = await ctx.db.insert("components", {
      partNumber: "CCS-MCU-002",
      name: "ESP32-S3 DevKitC",
      description: "Dual-core WiFi+BLE MCU with USB OTG. Used in Ride Height Sensor",
      category: "mcu",
      subcategory: "wifi_ble",
      manufacturer: "Espressif",
      manufacturerPartNumber: "ESP32-S3-WROOM-1",
      unitOfMeasure: "each",
      specs: { voltage: "3.3V", custom: { flash: "8MB", psram: "8MB", cores: 2 } },
      status: "active",
      usedInProducts: ["Ride_Height_Sensor"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cMAX6675 = await ctx.db.insert("components", {
      partNumber: "CCS-SNS-001",
      name: "MAX6675 Breakout Board",
      description: "K-type thermocouple-to-digital converter, SPI interface. Oil Heater temp sensing",
      category: "sensor",
      subcategory: "thermocouple_interface",
      manufacturer: "Maxim",
      manufacturerPartNumber: "MAX6675ISA+",
      unitOfMeasure: "each",
      specs: { voltage: "3.3-5V", temperature: "0-1024°C", custom: { interface: "SPI" } },
      status: "active",
      usedInProducts: ["Oil_Heater_Controller"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cHX711 = await ctx.db.insert("components", {
      partNumber: "CCS-SNS-002",
      name: "HX711 Load Cell Amplifier",
      description: "24-bit ADC for load cells. RaceScale weight measurement",
      category: "sensor",
      subcategory: "load_cell_amp",
      manufacturer: "Avia",
      manufacturerPartNumber: "HX711",
      unitOfMeasure: "each",
      specs: { voltage: "2.7-5.5V", custom: { resolution: "24-bit", sampleRate: "10/80 SPS" } },
      status: "active",
      usedInProducts: ["RaceScale"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cVL53L0X = await ctx.db.insert("components", {
      partNumber: "CCS-SNS-003",
      name: "VL53L0X ToF Sensor",
      description: "Time-of-flight laser distance sensor, I2C. Ride Height Sensor",
      category: "sensor",
      subcategory: "distance",
      manufacturer: "STMicroelectronics",
      manufacturerPartNumber: "VL53L0X",
      unitOfMeasure: "each",
      specs: { voltage: "2.6-3.5V", custom: { interface: "I2C", range: "2m" } },
      status: "active",
      usedInProducts: ["Ride_Height_Sensor"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cCap100nF = await ctx.db.insert("components", {
      partNumber: "CCS-PAS-001",
      name: "0.1uF Ceramic Capacitor",
      description: "100nF 50V X7R 0603 decoupling cap",
      category: "passive",
      subcategory: "capacitor",
      manufacturer: "Samsung",
      manufacturerPartNumber: "CL10B104KB8NNNC",
      unitOfMeasure: "each",
      specs: { value: "100nF", voltage: "50V", custom: { package: "0603", dielectric: "X7R" } },
      status: "active",
      usedInProducts: ["Oil_Heater_Controller", "RaceScale", "Ride_Height_Sensor"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cRes10K = await ctx.db.insert("components", {
      partNumber: "CCS-PAS-002",
      name: "10K Ohm Resistor",
      description: "10K 1% 0603 resistor, pull-ups and voltage dividers",
      category: "passive",
      subcategory: "resistor",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0603FR-0710KL",
      unitOfMeasure: "each",
      specs: { value: "10kΩ", tolerance: "1%", custom: { package: "0603" } },
      status: "active",
      usedInProducts: ["Oil_Heater_Controller", "RaceScale", "Ride_Height_Sensor"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cUSBC = await ctx.db.insert("components", {
      partNumber: "CCS-CON-001",
      name: "USB-C Connector",
      description: "USB Type-C 2.0 receptacle, SMD. Power and data for all devices",
      category: "connector",
      subcategory: "usb",
      manufacturer: "GCT",
      manufacturerPartNumber: "USB4110-GF-A",
      unitOfMeasure: "each",
      specs: { custom: { type: "USB-C 2.0", mounting: "SMD" } },
      status: "active",
      usedInProducts: ["Oil_Heater_Controller", "RaceScale", "Ride_Height_Sensor"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cPCBOilHeater = await ctx.db.insert("components", {
      partNumber: "CCS-PCB-001",
      name: "Oil Heater Controller PCB Rev C",
      description: "4-layer PCB for Oil Heater Controller, 80x50mm",
      category: "pcb",
      subcategory: "custom",
      manufacturer: "JLCPCB",
      unitOfMeasure: "each",
      specs: { custom: { layers: 4, size: "80x50mm", revision: "C" } },
      status: "active",
      usedInProducts: ["Oil_Heater_Controller"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cPCBRaceScale = await ctx.db.insert("components", {
      partNumber: "CCS-PCB-002",
      name: "RaceScale Main PCB Rev B",
      description: "2-layer PCB for RaceScale, 60x40mm",
      category: "pcb",
      subcategory: "custom",
      manufacturer: "JLCPCB",
      unitOfMeasure: "each",
      specs: { custom: { layers: 2, size: "60x40mm", revision: "B" } },
      status: "active",
      usedInProducts: ["RaceScale"],
      createdBy: "seed",
      updatedAt: now,
    });

    // ===========================================================
    // 3. LOCATIONS (hierarchical — insert parents first)
    // ===========================================================
    const locWorkshop = await ctx.db.insert("locations", {
      name: "Workshop",
      code: "WS",
      type: "room",
      description: "105 Hathaway Ln, Unit 103, Mooresville, NC — CCS Technologies HQ",
      status: "active",
      updatedAt: now,
    });

    const locShelfA = await ctx.db.insert("locations", {
      name: "Main Shelf A",
      code: "WS-SA",
      type: "shelf",
      parentId: locWorkshop,
      status: "active",
      updatedAt: now,
    });

    const locShelfB = await ctx.db.insert("locations", {
      name: "Main Shelf B",
      code: "WS-SB",
      type: "shelf",
      parentId: locWorkshop,
      status: "active",
      updatedAt: now,
    });

    const locBin1 = await ctx.db.insert("locations", {
      name: "Bin 1 — MCUs",
      code: "WS-SA-B1",
      type: "bin",
      parentId: locShelfA,
      description: "Microcontrollers and dev boards",
      status: "active",
      updatedAt: now,
    });

    const locBin2 = await ctx.db.insert("locations", {
      name: "Bin 2 — Sensors",
      code: "WS-SA-B2",
      type: "bin",
      parentId: locShelfA,
      description: "Sensor modules and breakout boards",
      status: "active",
      updatedAt: now,
    });

    const locBin3 = await ctx.db.insert("locations", {
      name: "Bin 3 — Passives",
      code: "WS-SB-B3",
      type: "bin",
      parentId: locShelfB,
      description: "Resistors, capacitors, inductors",
      status: "active",
      updatedAt: now,
    });

    const locDrawer1 = await ctx.db.insert("locations", {
      name: "Drawer 1 — Connectors & PCBs",
      code: "WS-SB-D1",
      type: "drawer",
      parentId: locShelfB,
      description: "Connectors, custom PCBs, breakout boards",
      status: "active",
      updatedAt: now,
    });

    // ===========================================================
    // 4. INVENTORY
    // ===========================================================
    const thirtyDaysAgo = now - 30 * DAY;
    const sixtyDaysAgo = now - 60 * DAY;

    // helper to derive status
    function stockStatus(qty: number, min: number): string {
      if (qty <= 0) return "out_of_stock";
      if (qty <= min) return "low_stock";
      return "in_stock";
    }

    // ESP32-C3 SuperMini — Bin 1, 33 qty, 5 reserved
    await ctx.db.insert("inventory", {
      componentId: cESP32C3,
      locationId: locBin1,
      quantity: 33,
      reservedQty: 5,
      availableQty: 28,
      minimumStock: 10,
      costPerUnit: 3.50,
      lastCountedAt: thirtyDaysAgo,
      status: stockStatus(33, 10),
      updatedAt: now,
    });

    // ESP32-S3 DevKitC — Bin 1, 8 qty, 0 reserved
    await ctx.db.insert("inventory", {
      componentId: cESP32S3,
      locationId: locBin1,
      quantity: 8,
      reservedQty: 0,
      availableQty: 8,
      minimumStock: 5,
      costPerUnit: 11.49,
      lastCountedAt: thirtyDaysAgo,
      status: stockStatus(8, 5),
      updatedAt: now,
    });

    // MAX6675 — Bin 2, 12 qty, 3 reserved
    await ctx.db.insert("inventory", {
      componentId: cMAX6675,
      locationId: locBin2,
      quantity: 12,
      reservedQty: 3,
      availableQty: 9,
      minimumStock: 5,
      costPerUnit: 4.99,
      lastCountedAt: thirtyDaysAgo,
      status: stockStatus(12, 5),
      updatedAt: now,
    });

    // HX711 — Bin 2, 4 qty, 0 reserved — LOW STOCK (min 5)
    await ctx.db.insert("inventory", {
      componentId: cHX711,
      locationId: locBin2,
      quantity: 4,
      reservedQty: 0,
      availableQty: 4,
      minimumStock: 5,
      costPerUnit: 2.80,
      lastCountedAt: thirtyDaysAgo,
      status: "low_stock",
      updatedAt: now,
    });

    // VL53L0X — Bin 2, 2 qty, 0 reserved — LOW STOCK, last counted 60 days ago
    await ctx.db.insert("inventory", {
      componentId: cVL53L0X,
      locationId: locBin2,
      quantity: 2,
      reservedQty: 0,
      availableQty: 2,
      minimumStock: 5,
      costPerUnit: 2.40,
      lastCountedAt: sixtyDaysAgo,
      status: "low_stock",
      updatedAt: now,
    });

    // 0.1uF Caps — Bin 3, 247 qty
    await ctx.db.insert("inventory", {
      componentId: cCap100nF,
      locationId: locBin3,
      quantity: 247,
      reservedQty: 0,
      availableQty: 247,
      minimumStock: 100,
      costPerUnit: 0.02,
      lastCountedAt: thirtyDaysAgo,
      status: stockStatus(247, 100),
      updatedAt: now,
    });

    // 10K Resistors — Bin 3, 189 qty
    await ctx.db.insert("inventory", {
      componentId: cRes10K,
      locationId: locBin3,
      quantity: 189,
      reservedQty: 0,
      availableQty: 189,
      minimumStock: 100,
      costPerUnit: 0.01,
      lastCountedAt: thirtyDaysAgo,
      status: stockStatus(189, 100),
      updatedAt: now,
    });

    // USB-C Connectors — Drawer 1, 15 qty
    await ctx.db.insert("inventory", {
      componentId: cUSBC,
      locationId: locDrawer1,
      quantity: 15,
      reservedQty: 0,
      availableQty: 15,
      minimumStock: 10,
      costPerUnit: 1.20,
      lastCountedAt: thirtyDaysAgo,
      status: stockStatus(15, 10),
      updatedAt: now,
    });

    // Oil Heater PCB Rev C — Drawer 1, 3 qty — LOW STOCK (min 5)
    await ctx.db.insert("inventory", {
      componentId: cPCBOilHeater,
      locationId: locDrawer1,
      quantity: 3,
      reservedQty: 0,
      availableQty: 3,
      minimumStock: 5,
      costPerUnit: 12.60,
      lastCountedAt: thirtyDaysAgo,
      status: "low_stock",
      updatedAt: now,
    });

    // RaceScale PCB Rev B — Drawer 1, 7 qty
    await ctx.db.insert("inventory", {
      componentId: cPCBRaceScale,
      locationId: locDrawer1,
      quantity: 7,
      reservedQty: 0,
      availableQty: 7,
      minimumStock: 5,
      costPerUnit: 12.00,
      lastCountedAt: thirtyDaysAgo,
      status: stockStatus(7, 5),
      updatedAt: now,
    });

    // ===========================================================
    // 5. PURCHASE ORDERS
    // ===========================================================
    const orderDate = now - 5 * DAY;

    // PO-2026-001 — DigiKey, shipped
    const po1 = await ctx.db.insert("purchaseOrders", {
      poNumber: "PO-2026-001",
      supplierId: supDigiKey,
      status: "shipped",
      orderDate,
      expectedDelivery: now + 2 * DAY,
      trackingNumber: "1Z999AA10123456784",
      subtotal: 127.50,
      totalCost: 127.50,
      notes: "Restock sensors and MCUs — low stock triggered by agent",
      createdBy: "agent",
      updatedAt: now,
    });

    await ctx.db.insert("purchaseOrderLines", {
      purchaseOrderId: po1,
      componentId: cESP32C3,
      quantityOrdered: 25,
      quantityReceived: 0,
      unitPrice: 3.50,
      lineTotal: 87.50,
      status: "pending",
      updatedAt: now,
    });

    await ctx.db.insert("purchaseOrderLines", {
      purchaseOrderId: po1,
      componentId: cHX711,
      quantityOrdered: 10,
      quantityReceived: 0,
      unitPrice: 2.80,
      lineTotal: 28.00,
      status: "pending",
      updatedAt: now,
    });

    await ctx.db.insert("purchaseOrderLines", {
      purchaseOrderId: po1,
      componentId: cVL53L0X,
      quantityOrdered: 5,
      quantityReceived: 0,
      unitPrice: 2.40,
      lineTotal: 12.00,
      status: "pending",
      updatedAt: now,
    });

    // PO-2026-002 — JLCPCB, confirmed
    const po2 = await ctx.db.insert("purchaseOrders", {
      poNumber: "PO-2026-002",
      supplierId: supJLCPCB,
      status: "confirmed",
      orderDate,
      expectedDelivery: now + 10 * DAY,
      subtotal: 186.00,
      totalCost: 186.00,
      notes: "PCB restock for upcoming Oil Heater and RaceScale builds",
      createdBy: "agent",
      updatedAt: now,
    });

    await ctx.db.insert("purchaseOrderLines", {
      purchaseOrderId: po2,
      componentId: cPCBOilHeater,
      quantityOrdered: 10,
      quantityReceived: 0,
      unitPrice: 12.60,
      lineTotal: 126.00,
      status: "pending",
      updatedAt: now,
    });

    await ctx.db.insert("purchaseOrderLines", {
      purchaseOrderId: po2,
      componentId: cPCBRaceScale,
      quantityOrdered: 5,
      quantityReceived: 0,
      unitPrice: 12.00,
      lineTotal: 60.00,
      status: "pending",
      updatedAt: now,
    });

    // ===========================================================
    // 6. ALERTS — staggered timestamps
    // ===========================================================
    await ctx.db.insert("alerts", {
      type: "low_stock",
      severity: "critical",
      title: "Low Stock: HX711 Load Cell Amplifier",
      message: "Only 4 units remaining (available: 4). Minimum threshold is 5. DigiKey has stock at $2.80/ea with 3-day lead. PO-2026-001 includes 10 units arriving in 2 days.",
      componentId: cHX711,
      status: "active",
      agentGenerated: true,
      agentContext: JSON.stringify({ trigger: "stock_monitor", threshold: 5, current: 4 }),
      updatedAt: now - 1 * 60 * 60 * 1000, // 1 hour ago
    });

    await ctx.db.insert("alerts", {
      type: "low_stock",
      severity: "critical",
      title: "Low Stock: VL53L0X ToF Sensor",
      message: "Only 2 units remaining (available: 2). Minimum threshold is 5. Needed for Ride Height Sensor builds. PO-2026-001 includes 5 units.",
      componentId: cVL53L0X,
      status: "active",
      agentGenerated: true,
      agentContext: JSON.stringify({ trigger: "stock_monitor", threshold: 5, current: 2 }),
      updatedAt: now - 3 * 60 * 60 * 1000, // 3 hours ago
    });

    await ctx.db.insert("alerts", {
      type: "low_stock",
      severity: "warning",
      title: "Low Stock: Oil Heater Controller PCB Rev C",
      message: "Only 3 units remaining (available: 3). Minimum threshold is 5. PO-2026-002 from JLCPCB includes 10 units, arriving in ~10 days.",
      componentId: cPCBOilHeater,
      status: "active",
      agentGenerated: true,
      agentContext: JSON.stringify({ trigger: "stock_monitor", threshold: 5, current: 3 }),
      updatedAt: now - 1 * DAY, // 1 day ago
    });

    await ctx.db.insert("alerts", {
      type: "po_overdue",
      severity: "warning",
      title: "PO-2026-001 Arriving Soon",
      message: "DigiKey shipment with 40 items expected in 2 days. Tracking: 1Z999AA10123456784. Prepare receiving area in Bin 1 (MCUs) and Bin 2 (Sensors).",
      purchaseOrderId: po1,
      status: "active",
      agentGenerated: true,
      updatedAt: now - 2 * DAY, // 2 days ago
    });

    await ctx.db.insert("alerts", {
      type: "count_needed",
      severity: "info",
      title: "Physical Count Needed: VL53L0X ToF Sensor",
      message: "Last counted 60 days ago (Bin 2 — Sensors). System shows 2 units. Please verify. Discrepancy risk is high given age of count.",
      componentId: cVL53L0X,
      locationId: locBin2,
      status: "active",
      agentGenerated: true,
      updatedAt: now - 3 * DAY, // 3 days ago
    });

    // ===========================================================
    // 7. TASKS — staggered priorities and due dates
    // ===========================================================
    await ctx.db.insert("tasks", {
      title: "Receive DigiKey Shipment PO-2026-001",
      description: "Package arriving in 2 days. Contains 25x ESP32-C3 SuperMini, 10x HX711 Load Cell Amp, 5x VL53L0X ToF Sensor. Verify quantities against packing slip. Store MCUs in Bin 1, sensors in Bin 2. Update inventory and close PO.",
      type: "receive_shipment",
      priority: "urgent",
      status: "pending",
      dueAt: now + 2 * DAY,
      slaHours: 48,
      escalationLevel: 0,
      purchaseOrderId: po1,
      agentGenerated: true,
      agentContext: JSON.stringify({ trigger: "po_shipped", poNumber: "PO-2026-001" }),
      updatedAt: now,
    });

    await ctx.db.insert("tasks", {
      title: "Physical Count: VL53L0X ToF Sensor",
      description: "System shows 2 units in Bin 2 — Sensors. Last counted 60 days ago. Count actual units and report back. If discrepancy found, check if any were used in prototype builds or misplaced.",
      type: "count_inventory",
      priority: "high",
      status: "pending",
      dueAt: now + 1 * DAY,
      slaHours: 24,
      escalationLevel: 0,
      componentId: cVL53L0X,
      locationId: locBin2,
      agentGenerated: true,
      updatedAt: now,
    });

    await ctx.db.insert("tasks", {
      title: "Review JLCPCB PCB Order PO-2026-002",
      description: "Confirm order details for 10x Oil Heater PCB Rev C and 5x RaceScale PCB Rev B. Expected delivery in 10 days. Verify Gerber files match latest revision. Check DHL tracking once shipped.",
      type: "general",
      priority: "normal",
      status: "pending",
      dueAt: now + 5 * DAY,
      slaHours: 120,
      escalationLevel: 0,
      purchaseOrderId: po2,
      agentGenerated: true,
      updatedAt: now,
    });

    await ctx.db.insert("tasks", {
      title: "Update Oil Heater BOM to Rev D",
      description: "Engineering made component changes. Update the BOM spreadsheet in Google Drive at Products/Oil_Heater_Controller/BOM/. Add MAX31855 as alternate for MAX6675. Update version field to Rev D and notify team.",
      type: "review_bom",
      priority: "normal",
      status: "pending",
      dueAt: now + 7 * DAY,
      slaHours: 168,
      escalationLevel: 0,
      agentGenerated: true,
      updatedAt: now,
    });

    await ctx.db.insert("tasks", {
      title: "Restock Passive Components",
      description: "0.1uF caps (247) and 10K resistors (189) are well stocked but haven't been counted in 45 days. Do a quick count of Bin 3 — Passives. No urgent action needed — purely a housekeeping count.",
      type: "count_inventory",
      priority: "low",
      status: "pending",
      dueAt: now + 14 * DAY,
      slaHours: 336,
      escalationLevel: 0,
      locationId: locBin3,
      agentGenerated: true,
      updatedAt: now,
    });

    // ===========================================================
    // 8. BOM ENTRIES — Oil_Heater_Controller
    // ===========================================================
    const bomEntries = [
      { componentId: cESP32C3, quantityPerUnit: 1, referenceDesignator: "U1" },
      { componentId: cMAX6675, quantityPerUnit: 1, referenceDesignator: "U2" },
      { componentId: cCap100nF, quantityPerUnit: 6, referenceDesignator: "C1-C6" },
      { componentId: cRes10K, quantityPerUnit: 4, referenceDesignator: "R1-R4" },
      { componentId: cUSBC, quantityPerUnit: 1, referenceDesignator: "J1" },
      { componentId: cPCBOilHeater, quantityPerUnit: 1, referenceDesignator: undefined },
    ];

    for (const entry of bomEntries) {
      await ctx.db.insert("bomEntries", {
        productName: "Oil_Heater_Controller",
        componentId: entry.componentId,
        quantityPerUnit: entry.quantityPerUnit,
        referenceDesignator: entry.referenceDesignator,
        isOptional: false,
        bomVersion: "1.0",
        updatedAt: now,
      });
    }

    return {
      message: "🏁 CCS Operations seeded successfully!",
      suppliers: 3,
      components: 10,
      locations: 7,
      inventory: 10,
      purchaseOrders: 2,
      purchaseOrderLines: 5,
      alerts: 5,
      tasks: 5,
      bomEntries: 6,
    };
  },
});

// ============================================================
// CLEAR — Wipe all operational data (run before re-seeding)
// Run with: npx convex run seed:clear
// ============================================================
export const clear = mutation({
  handler: async (ctx) => {
    const tables = [
      "receiptPhotos",
      "inventoryTransactions",
      "purchaseOrderLines",
      "purchaseOrders",
      "bomEntries",
      "componentSuppliers",
      "inventory",
      "buildOrders",
      "tasks",
      "alerts",
      "components",
      "suppliers",
      "locations",
      "bomChangeLogs",
      "bomSnapshots",
      "briefings",
      "driveFiles",
      "driveSyncLog",
    ] as const;

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table as any).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      counts[table] = rows.length;
    }

    return { message: "🧹 All data cleared.", deleted: counts };
  },
});

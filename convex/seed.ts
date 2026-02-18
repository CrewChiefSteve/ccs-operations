import { mutation } from "./_generated/server";

// ============================================================
// SEED DATA — CCS Technologies Operational Platform
// ============================================================
// Run with: npx convex run seed:run
//
// Populates the database with:
//   - Warehouse locations (105 Hathaway Ln, Unit 103)
//   - Suppliers (Amazon, plus placeholders for DigiKey/Mouser/JLCPCB)
//   - Components (real parts from Amazon orders + known product BOMs)
//   - Component-Supplier links with pricing
//   - BOM entries for all 5 products
//   - Test inventory (fake quantities — clean out later)
//   - Sample purchase order + build order
//   - Sample alerts and tasks to exercise the dashboard
//
// SAFE TO RE-RUN: Checks for existing data before inserting.
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
    const results: Record<string, number> = {};

    // ===========================================================
    // 1. LOCATIONS — 105 Hathaway Ln, Unit 103, Mooresville NC
    // ===========================================================
    const locUnit = await ctx.db.insert("locations", {
      name: "Unit 103",
      code: "U103",
      type: "room",
      description: "105 Hathaway Ln, Unit 103, Mooresville, NC 28117 — CCS Technologies HQ",
      status: "active",
      updatedAt: now,
    });

    const locWorkbench = await ctx.db.insert("locations", {
      name: "Main Workbench",
      code: "U103-WB",
      type: "zone",
      parentId: locUnit,
      description: "Primary electronics assembly area",
      status: "active",
      updatedAt: now,
    });

    const locShelfA = await ctx.db.insert("locations", {
      name: "Shelf A — MCUs & Dev Boards",
      code: "U103-SA",
      type: "shelf",
      parentId: locUnit,
      description: "Microcontrollers, dev boards, programmer tools",
      status: "active",
      updatedAt: now,
    });

    const locShelfB = await ctx.db.insert("locations", {
      name: "Shelf B — Sensors & Modules",
      code: "U103-SB",
      type: "shelf",
      parentId: locUnit,
      description: "Sensors, breakout boards, display modules",
      status: "active",
      updatedAt: now,
    });

    const locShelfC = await ctx.db.insert("locations", {
      name: "Shelf C — Passives & Connectors",
      code: "U103-SC",
      type: "shelf",
      parentId: locUnit,
      description: "Resistors, capacitors, connectors, wire, solder",
      status: "active",
      updatedAt: now,
    });

    const locShelfD = await ctx.db.insert("locations", {
      name: "Shelf D — Power & Batteries",
      code: "U103-SD",
      type: "shelf",
      parentId: locUnit,
      description: "Power supplies, batteries, charger modules, SSRs",
      status: "active",
      updatedAt: now,
    });

    const locBinPCB = await ctx.db.insert("locations", {
      name: "PCB Storage Bin",
      code: "U103-PCB",
      type: "bin",
      parentId: locUnit,
      description: "Custom PCBs and protoboards",
      status: "active",
      updatedAt: now,
    });

    const locEnclosures = await ctx.db.insert("locations", {
      name: "Enclosure Storage",
      code: "U103-ENC",
      type: "bin",
      parentId: locUnit,
      description: "Project boxes, 3D printed enclosures, hardware",
      status: "active",
      updatedAt: now,
    });

    const locInbound = await ctx.db.insert("locations", {
      name: "Inbound / Receiving",
      code: "U103-IN",
      type: "zone",
      parentId: locUnit,
      description: "Packages awaiting intake processing",
      status: "active",
      updatedAt: now,
    });

    results.locations = 9;

    // ===========================================================
    // 2. SUPPLIERS
    // ===========================================================
    const supAmazon = await ctx.db.insert("suppliers", {
      name: "Amazon",
      code: "AMZ",
      website: "https://www.amazon.com",
      contactEmail: undefined,
      notes: "Primary supplier for dev boards and prototyping components. Prime shipping.",
      leadTimeDays: 2,
      shippingNotes: "Free 2-day with Prime",
      status: "active",
      updatedAt: now,
    });

    const supDigiKey = await ctx.db.insert("suppliers", {
      name: "DigiKey",
      code: "DK",
      website: "https://www.digikey.com",
      notes: "Production-grade components. Better pricing at volume.",
      leadTimeDays: 3,
      shippingNotes: "Free shipping over $50",
      status: "active",
      updatedAt: now,
    });

    const supMouser = await ctx.db.insert("suppliers", {
      name: "Mouser Electronics",
      code: "MOU",
      website: "https://www.mouser.com",
      notes: "Wide selection, good for hard-to-find parts",
      leadTimeDays: 3,
      shippingNotes: "Free shipping over $50",
      status: "active",
      updatedAt: now,
    });

    const supJLCPCB = await ctx.db.insert("suppliers", {
      name: "JLCPCB",
      code: "JLC",
      website: "https://jlcpcb.com",
      notes: "PCB fabrication and SMT assembly. 5-day production + shipping from China.",
      leadTimeDays: 14,
      shippingNotes: "DHL Express ~5 days from Shenzhen",
      status: "active",
      updatedAt: now,
    });

    results.suppliers = 4;

    // ===========================================================
    // 3. COMPONENTS
    // ===========================================================

    // --- MCU / Dev Boards ---
    const cESP32S3 = await ctx.db.insert("components", {
      partNumber: "CCS-MCU-001",
      name: "ESP32-S3-DevKitC-1 N16R8",
      description: "ESP32-S3 dev board with 16MB Flash, 8MB PSRAM, dual Type-C, WiFi + BLE",
      category: "microcontroller",
      subcategory: "dev_board",
      manufacturer: "Espressif (YEJMKJ)",
      manufacturerPartNumber: "ESP32-S3-DevKitC-1-N16R8",
      unitOfMeasure: "each",
      specs: { voltage: "3.3V", custom: { flash: "16MB", psram: "8MB", cores: 2 } },
      notes: "Amazon order Feb 13, 2026 — 2pcs. Used for display/UI applications.",
      status: "active",
      usedInProducts: ["RaceScale", "Tire_Temperature"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cESP32C3 = await ctx.db.insert("components", {
      partNumber: "CCS-MCU-002",
      name: "ESP32-C3-DevKitM-1",
      description: "ESP32-C3 RISC-V dev board, WiFi + BLE 5.0, dual Type-C",
      category: "microcontroller",
      subcategory: "dev_board",
      manufacturer: "Espressif (HiLetgo)",
      manufacturerPartNumber: "ESP32-C3-MINI-1",
      unitOfMeasure: "each",
      specs: { voltage: "3.3V", custom: { flash: "4MB", cores: 1, arch: "RISC-V" } },
      notes: "Amazon order Jan 19, 2026. Primary BLE controller for sensor devices.",
      status: "active",
      usedInProducts: ["Ride_Height_Sensor", "Tire-Temp-Probe"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cESP32DevKit = await ctx.db.insert("components", {
      partNumber: "CCS-MCU-003",
      name: "ESP32 DevKit V1 (WROOM-32)",
      description: "Classic ESP32 dev board, WiFi + BLE, dual core",
      category: "microcontroller",
      subcategory: "dev_board",
      manufacturer: "Espressif",
      manufacturerPartNumber: "ESP32-WROOM-32",
      unitOfMeasure: "each",
      specs: { voltage: "3.3V", custom: { flash: "4MB", cores: 2 } },
      notes: "Oil Heater controller board. Running PlatformIO firmware.",
      status: "active",
      usedInProducts: ["Oil_Heater_Controller"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cWaveshare7 = await ctx.db.insert("components", {
      partNumber: "CCS-DSP-001",
      name: 'Waveshare 7" ESP32-S3 LCD Touch Display',
      description: "7 inch 800x480 capacitive touch display with onboard ESP32-S3, UART interface",
      category: "display",
      subcategory: "lcd_module",
      manufacturer: "Waveshare",
      unitOfMeasure: "each",
      specs: { custom: { resolution: "800x480", interface: "UART", touch: "capacitive" } },
      notes: "Oil Heater display board. Runs Arduino + LVGL graphics. Communicates with controller via UART.",
      status: "active",
      usedInProducts: ["Oil_Heater_Controller"],
      createdBy: "seed",
      updatedAt: now,
    });

    // --- Sensors ---
    const cMAX6675 = await ctx.db.insert("components", {
      partNumber: "CCS-SEN-001",
      name: "MAX6675 Thermocouple Module",
      description: "K-type thermocouple to digital converter, SPI interface, 0-1024°C",
      category: "sensor",
      subcategory: "temperature",
      manufacturer: "Maxim Integrated",
      manufacturerPartNumber: "MAX6675",
      unitOfMeasure: "each",
      specs: { voltage: "3.3-5V", temperature: "0-1024°C", custom: { interface: "SPI", resolution: "0.25°C" } },
      notes: "Oil Heater primary temperature sensor. Reads oil sump temperature.",
      status: "active",
      usedInProducts: ["Oil_Heater_Controller"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cVL53L1X = await ctx.db.insert("components", {
      partNumber: "CCS-SEN-002",
      name: "TOF400C VL53L1X Laser Ranging Sensor Module",
      description: "Time-of-Flight laser distance sensor, I2C, 4M range",
      category: "sensor",
      subcategory: "distance",
      manufacturer: "STMicroelectronics",
      manufacturerPartNumber: "VL53L1X",
      unitOfMeasure: "each",
      specs: { voltage: "3.3-5V", custom: { interface: "I2C", range: "4m", accuracy: "±1mm" } },
      notes: "Amazon order Jan 19, 2026 — 4pcs. Ride height measurement sensor.",
      status: "active",
      usedInProducts: ["Ride_Height_Sensor"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cDS18B20 = await ctx.db.insert("components", {
      partNumber: "CCS-SEN-003",
      name: "DS18B20 Waterproof Temperature Probe",
      description: "1-Wire digital temperature sensor, stainless steel probe, 1m cable",
      category: "sensor",
      subcategory: "temperature",
      manufacturer: "Dallas/Maxim",
      manufacturerPartNumber: "DS18B20",
      unitOfMeasure: "each",
      specs: { voltage: "3.0-5.5V", temperature: "-55 to 125°C", custom: { interface: "1-Wire", accuracy: "±0.5°C" } },
      notes: "Tire temperature probe sensor element.",
      status: "active",
      usedInProducts: ["Tire-Temp-Probe", "Tire_Temperature"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cMLX90614 = await ctx.db.insert("components", {
      partNumber: "CCS-SEN-004",
      name: "MLX90614 IR Temperature Sensor",
      description: "Non-contact infrared temperature sensor, I2C, -70 to 380°C",
      category: "sensor",
      subcategory: "temperature",
      manufacturer: "Melexis",
      manufacturerPartNumber: "MLX90614ESF-BAA",
      unitOfMeasure: "each",
      specs: { voltage: "3.3V", temperature: "-70 to 380°C", custom: { interface: "I2C", fov: "90°" } },
      notes: "Tire temperature gun — non-contact IR reading.",
      status: "active",
      usedInProducts: ["Tire_Temperature"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cHX711 = await ctx.db.insert("components", {
      partNumber: "CCS-SEN-005",
      name: "HX711 Load Cell Amplifier",
      description: "24-bit ADC for load cells/strain gauges",
      category: "sensor",
      subcategory: "load_cell",
      manufacturer: "Avia Semiconductor",
      manufacturerPartNumber: "HX711",
      unitOfMeasure: "each",
      specs: { voltage: "2.7-5.5V", custom: { resolution: "24-bit", sampleRate: "10/80 SPS" } },
      notes: "RaceScale ADC — reads 4 load cells for corner weight measurement.",
      status: "active",
      usedInProducts: ["RaceScale"],
      createdBy: "seed",
      updatedAt: now,
    });

    // --- Power ---
    const cTP4056 = await ctx.db.insert("components", {
      partNumber: "CCS-PWR-001",
      name: "TP4056 Type-C USB Charger Module",
      description: "5V 1A lithium battery charger with dual protection (over-discharge + over-charge)",
      category: "power",
      subcategory: "charger",
      manufacturer: "HiLetgo",
      manufacturerPartNumber: "TP4056",
      unitOfMeasure: "each",
      specs: { voltage: "5V input", current: "1A charge", custom: { protection: "dual" } },
      notes: "Amazon order Jan 19, 2026 — 3pcs. Battery charging for portable devices.",
      status: "active",
      usedInProducts: ["Ride_Height_Sensor", "Tire-Temp-Probe", "Tire_Temperature"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cLipo500 = await ctx.db.insert("components", {
      partNumber: "CCS-PWR-002",
      name: "EEMB 3.7V 500mAh LiPo Battery (403048)",
      description: "Lithium polymer rechargeable battery, JST connector, 403048 form factor",
      category: "power",
      subcategory: "battery",
      manufacturer: "EEMB",
      manufacturerPartNumber: "403048",
      unitOfMeasure: "each",
      specs: { voltage: "3.7V", current: "500mAh", custom: { connector: "JST", formFactor: "403048" } },
      notes: "Amazon order Jan 19, 2026. Portable device battery.",
      status: "active",
      usedInProducts: ["Ride_Height_Sensor", "Tire-Temp-Probe"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cSSR40A = await ctx.db.insert("components", {
      partNumber: "CCS-PWR-003",
      name: "SSR-40DA Solid State Relay 40A",
      description: "40A 24-380VAC solid state relay, 3-32VDC control",
      category: "power",
      subcategory: "relay",
      manufacturer: "Fotek",
      manufacturerPartNumber: "SSR-40DA",
      unitOfMeasure: "each",
      specs: { voltage: "24-380VAC", current: "40A", custom: { control: "3-32VDC" } },
      notes: "Oil Heater — switches the heating element on/off via PID control.",
      status: "active",
      usedInProducts: ["Oil_Heater_Controller"],
      createdBy: "seed",
      updatedAt: now,
    });

    // --- Passives & Connectors ---
    const cKTypeProbe = await ctx.db.insert("components", {
      partNumber: "CCS-CON-001",
      name: "K-Type Thermocouple Probe (M6 thread)",
      description: "K-type thermocouple with M6 threaded tip, 1m cable, -50 to 500°C",
      category: "sensor",
      subcategory: "thermocouple",
      manufacturer: "Generic",
      unitOfMeasure: "each",
      specs: { temperature: "-50 to 500°C", custom: { type: "K", thread: "M6" } },
      notes: "Oil Heater — screws into oil sump drain plug for temperature reading.",
      status: "active",
      usedInProducts: ["Oil_Heater_Controller"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cJSTConn = await ctx.db.insert("components", {
      partNumber: "CCS-CON-002",
      name: "JST-PH 2.0mm 2-Pin Connector Pair",
      description: "JST PH 2-pin male header + female housing with pre-crimped wires",
      category: "connector",
      subcategory: "jst",
      manufacturer: "JST",
      unitOfMeasure: "each",
      specs: { custom: { pitch: "2.0mm", pins: 2, type: "PH" } },
      notes: "Battery connector standard across portable CCS devices.",
      status: "active",
      usedInProducts: ["Ride_Height_Sensor", "Tire-Temp-Probe", "Tire_Temperature"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cUSBC = await ctx.db.insert("components", {
      partNumber: "CCS-CON-003",
      name: "USB Type-C Breakout Board",
      description: "USB-C female connector breakout to pins, supports data + charging",
      category: "connector",
      subcategory: "usb",
      manufacturer: "Generic",
      unitOfMeasure: "each",
      specs: { custom: { type: "USB-C", pins: "breakout" } },
      status: "active",
      usedInProducts: ["Oil_Heater_Controller"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cLoadCell50kg = await ctx.db.insert("components", {
      partNumber: "CCS-SEN-006",
      name: "50kg Load Cell (Half-Bridge)",
      description: "50kg half-bridge strain gauge load cell for platform scales",
      category: "sensor",
      subcategory: "load_cell",
      manufacturer: "Generic",
      unitOfMeasure: "each",
      specs: { custom: { capacity: "50kg", type: "half-bridge" } },
      notes: "RaceScale — 4 per scale pad, 16 total per 4-corner system.",
      status: "active",
      usedInProducts: ["RaceScale"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cProjectBox = await ctx.db.insert("components", {
      partNumber: "CCS-ENC-001",
      name: "ABS Project Box 150x100x50mm",
      description: "Black ABS plastic project enclosure with screw-down lid",
      category: "enclosure",
      manufacturer: "Generic",
      unitOfMeasure: "each",
      status: "active",
      usedInProducts: ["Oil_Heater_Controller", "Tire_Temperature"],
      createdBy: "seed",
      updatedAt: now,
    });

    const cProtoBoard = await ctx.db.insert("components", {
      partNumber: "CCS-PCB-001",
      name: "Double-Sided Prototype PCB 70x90mm",
      description: "FR-4 double-sided prototype board with plated through holes",
      category: "pcb",
      subcategory: "protoboard",
      manufacturer: "Generic",
      unitOfMeasure: "each",
      status: "active",
      createdBy: "seed",
      updatedAt: now,
    });

    const cWire22 = await ctx.db.insert("components", {
      partNumber: "CCS-WIR-001",
      name: "22 AWG Silicone Hook-Up Wire (assorted)",
      description: "22 AWG stranded silicone insulated wire, 6 color assortment",
      category: "passive",
      subcategory: "wire",
      manufacturer: "Generic",
      unitOfMeasure: "ft",
      status: "active",
      createdBy: "seed",
      updatedAt: now,
    });

    const allComponents = [
      cESP32S3, cESP32C3, cESP32DevKit, cWaveshare7,
      cMAX6675, cVL53L1X, cDS18B20, cMLX90614, cHX711,
      cTP4056, cLipo500, cSSR40A,
      cKTypeProbe, cJSTConn, cUSBC, cLoadCell50kg,
      cProjectBox, cProtoBoard, cWire22,
    ];
    results.components = allComponents.length;

    // ===========================================================
    // 4. COMPONENT-SUPPLIER LINKS (Amazon pricing)
    // ===========================================================
    const supplierLinks = [
      { componentId: cESP32S3, supplierId: supAmazon, supplierPartNumber: "B0DJYM3T7Q", unitPrice: 11.49, minOrderQty: 2, url: "https://www.amazon.com/dp/B0DJYM3T7Q", inStock: true },
      { componentId: cESP32C3, supplierId: supAmazon, supplierPartNumber: "B0B7JXCDP4", unitPrice: 7.99, minOrderQty: 1, url: "https://www.amazon.com/dp/B0B7JXCDP4", inStock: true },
      { componentId: cTP4056, supplierId: supAmazon, supplierPartNumber: "B00LTQU2RK", unitPrice: 2.33, minOrderQty: 3, url: "https://www.amazon.com/dp/B00LTQU2RK", inStock: true },
      { componentId: cVL53L1X, supplierId: supAmazon, supplierPartNumber: "B09MFKBFYM", unitPrice: 4.25, minOrderQty: 4, url: "https://www.amazon.com/dp/B09MFKBFYM", inStock: true },
      { componentId: cLipo500, supplierId: supAmazon, supplierPartNumber: "B08214DJLJ", unitPrice: 8.99, minOrderQty: 1, url: "https://www.amazon.com/dp/B08214DJLJ", inStock: true },
      { componentId: cMAX6675, supplierId: supAmazon, unitPrice: 4.99, minOrderQty: 1, inStock: true },
      { componentId: cSSR40A, supplierId: supAmazon, unitPrice: 8.49, minOrderQty: 1, inStock: true },
      { componentId: cDS18B20, supplierId: supAmazon, unitPrice: 2.99, minOrderQty: 5, inStock: true },
      { componentId: cHX711, supplierId: supAmazon, unitPrice: 1.99, minOrderQty: 5, inStock: true },
      { componentId: cKTypeProbe, supplierId: supAmazon, unitPrice: 6.99, minOrderQty: 1, inStock: true },
      { componentId: cLoadCell50kg, supplierId: supAmazon, unitPrice: 3.49, minOrderQty: 4, inStock: true },
      { componentId: cESP32DevKit, supplierId: supAmazon, unitPrice: 6.99, minOrderQty: 1, inStock: true },
      { componentId: cWaveshare7, supplierId: supAmazon, unitPrice: 52.99, minOrderQty: 1, inStock: true },
      { componentId: cMLX90614, supplierId: supAmazon, unitPrice: 12.99, minOrderQty: 1, inStock: true },
    ];

    for (const link of supplierLinks) {
      await ctx.db.insert("componentSuppliers", {
        componentId: link.componentId,
        supplierId: link.supplierId,
        supplierPartNumber: link.supplierPartNumber,
        unitPrice: link.unitPrice,
        currency: "USD",
        minOrderQty: link.minOrderQty,
        leadTimeDays: 2,
        url: link.url,
        inStock: link.inStock ?? true,
        isPreferred: true,
        lastPriceCheck: now,
        updatedAt: now,
      });
    }
    results.componentSuppliers = supplierLinks.length;

    // ===========================================================
    // 5. BOM ENTRIES — All 5 Products
    // ===========================================================
    const bomData = [
      // --- Oil Heater Controller ---
      { productName: "Oil_Heater_Controller", componentId: cESP32DevKit, quantityPerUnit: 1, referenceDesignator: "U1", placement: "through-hole", notes: "Controller board — PlatformIO firmware" },
      { productName: "Oil_Heater_Controller", componentId: cWaveshare7, quantityPerUnit: 1, referenceDesignator: "DSP1", placement: "mechanical", notes: "Display board — Arduino + LVGL, UART to controller" },
      { productName: "Oil_Heater_Controller", componentId: cMAX6675, quantityPerUnit: 1, referenceDesignator: "U2", placement: "through-hole", notes: "SPI thermocouple ADC" },
      { productName: "Oil_Heater_Controller", componentId: cKTypeProbe, quantityPerUnit: 1, referenceDesignator: "TC1", placement: "mechanical", notes: "M6 thread into oil sump" },
      { productName: "Oil_Heater_Controller", componentId: cSSR40A, quantityPerUnit: 1, referenceDesignator: "K1", placement: "mechanical", notes: "Heater element switching" },
      { productName: "Oil_Heater_Controller", componentId: cProjectBox, quantityPerUnit: 1, referenceDesignator: "ENC1", placement: "mechanical" },

      // --- RaceScale ---
      { productName: "RaceScale", componentId: cESP32S3, quantityPerUnit: 1, referenceDesignator: "U1", placement: "through-hole", notes: "Main processor with display" },
      { productName: "RaceScale", componentId: cHX711, quantityPerUnit: 4, referenceDesignator: "U2-U5", placement: "through-hole", notes: "One per scale pad" },
      { productName: "RaceScale", componentId: cLoadCell50kg, quantityPerUnit: 16, referenceDesignator: "LC1-LC16", placement: "mechanical", notes: "4 per pad × 4 pads" },

      // --- Ride Height Sensor ---
      { productName: "Ride_Height_Sensor", componentId: cESP32C3, quantityPerUnit: 1, referenceDesignator: "U1", placement: "through-hole", notes: "BLE controller" },
      { productName: "Ride_Height_Sensor", componentId: cVL53L1X, quantityPerUnit: 1, referenceDesignator: "U2", placement: "through-hole", notes: "ToF laser distance" },
      { productName: "Ride_Height_Sensor", componentId: cTP4056, quantityPerUnit: 1, referenceDesignator: "U3", placement: "through-hole", notes: "Battery charging" },
      { productName: "Ride_Height_Sensor", componentId: cLipo500, quantityPerUnit: 1, referenceDesignator: "BT1", placement: "mechanical" },
      { productName: "Ride_Height_Sensor", componentId: cJSTConn, quantityPerUnit: 1, referenceDesignator: "J1", placement: "through-hole" },

      // --- Tire Temperature (gun / IR) ---
      { productName: "Tire_Temperature", componentId: cESP32S3, quantityPerUnit: 1, referenceDesignator: "U1", placement: "through-hole" },
      { productName: "Tire_Temperature", componentId: cMLX90614, quantityPerUnit: 1, referenceDesignator: "U2", placement: "through-hole", notes: "Non-contact IR sensor" },
      { productName: "Tire_Temperature", componentId: cDS18B20, quantityPerUnit: 3, referenceDesignator: "T1-T3", placement: "mechanical", notes: "Inner/middle/outer probes" },
      { productName: "Tire_Temperature", componentId: cTP4056, quantityPerUnit: 1, referenceDesignator: "U3", placement: "through-hole" },
      { productName: "Tire_Temperature", componentId: cProjectBox, quantityPerUnit: 1, referenceDesignator: "ENC1", placement: "mechanical" },

      // --- Tire-Temp-Probe (wired probe set) ---
      { productName: "Tire-Temp-Probe", componentId: cESP32C3, quantityPerUnit: 1, referenceDesignator: "U1", placement: "through-hole", notes: "BLE controller" },
      { productName: "Tire-Temp-Probe", componentId: cDS18B20, quantityPerUnit: 3, referenceDesignator: "T1-T3", placement: "mechanical", notes: "Inner/middle/outer tire probes" },
      { productName: "Tire-Temp-Probe", componentId: cTP4056, quantityPerUnit: 1, referenceDesignator: "U3", placement: "through-hole" },
      { productName: "Tire-Temp-Probe", componentId: cLipo500, quantityPerUnit: 1, referenceDesignator: "BT1", placement: "mechanical" },
      { productName: "Tire-Temp-Probe", componentId: cJSTConn, quantityPerUnit: 1, referenceDesignator: "J1", placement: "through-hole" },
    ];

    for (const bom of bomData) {
      await ctx.db.insert("bomEntries", {
        productName: bom.productName,
        componentId: bom.componentId,
        quantityPerUnit: bom.quantityPerUnit,
        referenceDesignator: bom.referenceDesignator,
        placement: bom.placement,
        isOptional: false,
        notes: bom.notes,
        bomVersion: "1.0",
        updatedAt: now,
      });
    }
    results.bomEntries = bomData.length;

    // ===========================================================
    // 6. TEST INVENTORY (fake quantities — clean out later)
    // ===========================================================
    const inventoryData = [
      // Dev boards on Shelf A
      { componentId: cESP32S3, locationId: locShelfA, quantity: 4, reservedQty: 0, minimumStock: 2, costPerUnit: 11.49 },
      { componentId: cESP32C3, locationId: locShelfA, quantity: 3, reservedQty: 0, minimumStock: 2, costPerUnit: 7.99 },
      { componentId: cESP32DevKit, locationId: locShelfA, quantity: 5, reservedQty: 1, minimumStock: 2, costPerUnit: 6.99 },
      { componentId: cWaveshare7, locationId: locShelfA, quantity: 2, reservedQty: 1, minimumStock: 1, costPerUnit: 52.99 },

      // Sensors on Shelf B
      { componentId: cMAX6675, locationId: locShelfB, quantity: 3, reservedQty: 0, minimumStock: 2, costPerUnit: 4.99 },
      { componentId: cVL53L1X, locationId: locShelfB, quantity: 4, reservedQty: 0, minimumStock: 2, costPerUnit: 4.25 },
      { componentId: cDS18B20, locationId: locShelfB, quantity: 8, reservedQty: 0, minimumStock: 6, costPerUnit: 2.99 },
      { componentId: cMLX90614, locationId: locShelfB, quantity: 2, reservedQty: 0, minimumStock: 1, costPerUnit: 12.99 },
      { componentId: cHX711, locationId: locShelfB, quantity: 6, reservedQty: 0, minimumStock: 4, costPerUnit: 1.99 },
      { componentId: cKTypeProbe, locationId: locShelfB, quantity: 2, reservedQty: 0, minimumStock: 2, costPerUnit: 6.99 },
      { componentId: cLoadCell50kg, locationId: locShelfB, quantity: 8, reservedQty: 0, minimumStock: 16, costPerUnit: 3.49 }, // LOW — need 16 per scale

      // Connectors on Shelf C
      { componentId: cJSTConn, locationId: locShelfC, quantity: 15, reservedQty: 0, minimumStock: 10, costPerUnit: 0.35 },
      { componentId: cUSBC, locationId: locShelfC, quantity: 3, reservedQty: 0, minimumStock: 2, costPerUnit: 1.99 },
      { componentId: cWire22, locationId: locShelfC, quantity: 100, reservedQty: 0, minimumStock: 50, costPerUnit: 0.10 },

      // Power on Shelf D
      { componentId: cTP4056, locationId: locShelfD, quantity: 3, reservedQty: 0, minimumStock: 3, costPerUnit: 2.33 },
      { componentId: cLipo500, locationId: locShelfD, quantity: 2, reservedQty: 0, minimumStock: 2, costPerUnit: 8.99 },
      { componentId: cSSR40A, locationId: locShelfD, quantity: 2, reservedQty: 0, minimumStock: 1, costPerUnit: 8.49 },

      // Enclosures and PCBs
      { componentId: cProjectBox, locationId: locEnclosures, quantity: 3, reservedQty: 0, minimumStock: 2, costPerUnit: 4.99 },
      { componentId: cProtoBoard, locationId: locBinPCB, quantity: 5, reservedQty: 0, minimumStock: 3, costPerUnit: 1.50 },
    ];

    function computeStatus(qty: number, min?: number): string {
      if (qty <= 0) return "out_of_stock";
      if (min && qty <= min) return "low_stock";
      return "in_stock";
    }

    for (const inv of inventoryData) {
      const available = inv.quantity - inv.reservedQty;
      await ctx.db.insert("inventory", {
        componentId: inv.componentId,
        locationId: inv.locationId,
        quantity: inv.quantity,
        reservedQty: inv.reservedQty,
        availableQty: available,
        minimumStock: inv.minimumStock,
        costPerUnit: inv.costPerUnit,
        status: computeStatus(inv.quantity, inv.minimumStock),
        updatedAt: now,
      });
    }
    results.inventory = inventoryData.length;

    // ===========================================================
    // 7. SAMPLE PURCHASE ORDER
    // ===========================================================
    const poId = await ctx.db.insert("purchaseOrders", {
      poNumber: "PO-2026-001",
      supplierId: supAmazon,
      status: "shipped",
      orderDate: now - 3 * 24 * 60 * 60 * 1000, // 3 days ago
      expectedDelivery: now + 1 * 24 * 60 * 60 * 1000, // tomorrow
      trackingNumber: "TBA612345678000",
      subtotal: 55.92,
      totalCost: 55.92,
      notes: "Restock load cells for RaceScale production run",
      createdBy: "Steve",
      updatedAt: now,
    });

    await ctx.db.insert("purchaseOrderLines", {
      purchaseOrderId: poId,
      componentId: cLoadCell50kg,
      quantityOrdered: 16,
      quantityReceived: 0,
      unitPrice: 3.49,
      lineTotal: 55.84,
      status: "pending",
      notes: "Full set for one 4-corner scale system",
      updatedAt: now,
    });

    results.purchaseOrders = 1;

    // ===========================================================
    // 8. SAMPLE BUILD ORDER
    // ===========================================================
    await ctx.db.insert("buildOrders", {
      buildNumber: "BUILD-OI-2026-001",
      productName: "Oil_Heater_Controller",
      quantity: 2,
      status: "planned",
      priority: "high",
      bomVersion: "1.0",
      assignedTo: "Steve",
      notes: "First production pair — one for testing, one for customer demo",
      createdBy: "Steve",
      updatedAt: now,
    });

    await ctx.db.insert("buildOrders", {
      buildNumber: "BUILD-RA-2026-001",
      productName: "RaceScale",
      quantity: 1,
      status: "planned",
      priority: "normal",
      bomVersion: "1.0",
      notes: "Prototype build — waiting on load cell delivery (PO-2026-001)",
      createdBy: "Steve",
      updatedAt: now,
    });

    results.buildOrders = 2;

    // ===========================================================
    // 9. SAMPLE ALERTS
    // ===========================================================
    await ctx.db.insert("alerts", {
      type: "low_stock",
      severity: "critical",
      title: "Load cells critically low for RaceScale",
      message: "Only 8 load cells in stock. Need 16 per RaceScale unit. PO-2026-001 is in transit with 16 more.",
      componentId: cLoadCell50kg,
      status: "active",
      agentGenerated: true,
      agentContext: JSON.stringify({ trigger: "inventory_check", threshold: 16, current: 8 }),
      updatedAt: now,
    });

    await ctx.db.insert("alerts", {
      type: "low_stock",
      severity: "warning",
      title: "TP4056 charger modules at minimum stock",
      message: "3 units in stock = minimum threshold. Used in 3 products. Consider reordering.",
      componentId: cTP4056,
      status: "active",
      agentGenerated: true,
      updatedAt: now,
    });

    await ctx.db.insert("alerts", {
      type: "low_stock",
      severity: "warning",
      title: "LiPo batteries at minimum stock",
      message: "2 units in stock = minimum threshold. Used in Ride_Height_Sensor and Tire-Temp-Probe.",
      componentId: cLipo500,
      status: "active",
      agentGenerated: true,
      updatedAt: now,
    });

    await ctx.db.insert("alerts", {
      type: "po_overdue",
      severity: "info",
      title: "PO-2026-001 arriving tomorrow",
      message: "Amazon order with 16x load cells expected delivery tomorrow. Track: TBA612345678000",
      purchaseOrderId: poId,
      status: "active",
      agentGenerated: true,
      updatedAt: now,
    });

    results.alerts = 4;

    // ===========================================================
    // 10. SAMPLE TASKS
    // ===========================================================
    await ctx.db.insert("tasks", {
      title: "Receive PO-2026-001 — Load cells from Amazon",
      description: "Package arriving tomorrow. Open, count 16x 50kg load cells, verify condition, update inventory, close PO.",
      type: "receive_shipment",
      priority: "high",
      status: "pending",
      dueAt: now + 1 * 24 * 60 * 60 * 1000,
      slaHours: 24,
      escalationLevel: 0,
      purchaseOrderId: poId,
      agentGenerated: true,
      agentContext: JSON.stringify({ trigger: "po_shipped", poNumber: "PO-2026-001" }),
      updatedAt: now,
    });

    await ctx.db.insert("tasks", {
      title: "Inventory count — Shelf B sensors",
      description: "Perform physical count of all sensor modules on Shelf B. Compare against system quantities. Report discrepancies.",
      type: "count_inventory",
      priority: "normal",
      status: "pending",
      assignedTo: "Nick",
      dueAt: now + 3 * 24 * 60 * 60 * 1000,
      slaHours: 72,
      escalationLevel: 0,
      locationId: locShelfB,
      agentGenerated: true,
      updatedAt: now,
    });

    await ctx.db.insert("tasks", {
      title: "Order more TP4056 charger modules",
      description: "At minimum stock (3 units). Used in 3 products. Recommend ordering 10 from Amazon. Draft PO when ready.",
      type: "general",
      priority: "normal",
      status: "pending",
      dueAt: now + 5 * 24 * 60 * 60 * 1000,
      slaHours: 120,
      escalationLevel: 0,
      componentId: cTP4056,
      agentGenerated: true,
      updatedAt: now,
    });

    await ctx.db.insert("tasks", {
      title: "Prep Oil Heater build — verify materials",
      description: "BUILD-OI-2026-001: Building 2 Oil Heater Controllers. Verify all BOM components are in stock and reserve materials. Check: ESP32 DevKit (need 2), Waveshare display (need 2), MAX6675 (need 2), K-type probe (need 2), SSR-40DA (need 2), project box (need 2).",
      type: "quality_check",
      priority: "high",
      status: "pending",
      assignedTo: "Steve",
      dueAt: now + 2 * 24 * 60 * 60 * 1000,
      slaHours: 48,
      escalationLevel: 0,
      agentGenerated: true,
      agentContext: JSON.stringify({ trigger: "build_order_planned", buildNumber: "BUILD-OI-2026-001" }),
      updatedAt: now,
    });

    results.tasks = 4;

    return {
      message: "🏁 CCS Operations database seeded successfully!",
      ...results,
    };
  },
});

// ============================================================
// CLEAR — Wipe all data (use before re-seeding)
// Run with: npx convex run seed:clear
// ============================================================
export const clear = mutation({
  handler: async (ctx) => {
    const tables = [
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
    ] as const;

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const rows = await ctx.db.query(table as any).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      counts[table] = rows.length;
    }

    return { message: "🧹 All operational data cleared.", deleted: counts };
  },
});
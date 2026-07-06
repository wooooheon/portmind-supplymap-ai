export function mockRecordsForSource(sourceCode: string, params: Record<string, unknown>): unknown[] {
  const query = String(params.query ?? params.hsCode ?? params.country ?? "").trim();

  if (sourceCode === "customs_hs_code") {
    return [
      {
        hsCode: query || "8518.21",
        koreanName: "단일 확성기",
        englishName: "Single loudspeakers, mounted in their enclosures"
      },
      {
        hsCode: "3304.99",
        koreanName: "기초화장용 제품류",
        englishName: "Beauty or make-up preparations"
      }
    ];
  }

  if (sourceCode === "customs_confirmation_items") {
    return [
      {
        hsCode: query || "3304.99",
        importExportType: "IMPORT",
        lawName: "화장품법",
        agencyName: "식품의약품안전처",
        requirementName: "수입 전 기능성/성분 확인 필요"
      }
    ];
  }

  if (sourceCode === "customs_trade_stats_by_hs_country") {
    return [
      {
        hsCode: String(params.hsCode ?? "8518"),
        country: String(params.country ?? "CN"),
        importAmountUsd: 12850000,
        exportAmountUsd: 842000,
        importWeightKg: 402100
      }
    ];
  }

  if (sourceCode === "safety_korea_cert_recall") {
    return [
      {
        certNumber: "KC-MOCK-2026-001",
        productName: query || "LED desk lamp",
        modelName: "TDL-2401",
        manufacturerName: "Shenzhen Lumina Electric Co., Ltd.",
        importerName: "Sample Import Korea",
        country: "CN",
        status: "인증 확인",
        issueDate: "2026-01-15"
      },
      {
        title: "리콜 모의 데이터",
        productName: "Portable heater",
        manufacturerName: "Foshan Heatwell Appliance Co., Ltd.",
        country: "CN",
        reason: "과열 가능성 모의 신호",
        severity: "HIGH"
      }
    ];
  }

  if (sourceCode === "rra_conformity") {
    return [
      {
        certNumber: "R-R-MCK-BTSPK-001",
        productName: query || "Bluetooth speaker",
        modelName: "BT-88",
        manufacturerName: "Dongguan Wave Audio Factory",
        country: "CN",
        status: "등록"
      }
    ];
  }

  if (sourceCode === "energy_efficiency_products") {
    return [
      {
        productName: query || "Dehumidifier",
        modelName: "EDH-2400",
        manufacturerName: "Ningbo CoolAir Appliance Co., Ltd.",
        importerName: "Sample Import Korea",
        country: "CN",
        certNumber: "ENERGY-MOCK-1",
        status: "효율등급 1등급 모의 데이터",
        efficiencyGrade: "1"
      }
    ];
  }

  if (sourceCode === "standby_power_products") {
    return [
      {
        productName: query || "Monitor",
        modelName: "MON-27E",
        manufacturerName: "Shenzhen Display Works",
        importerName: "Sample Import Korea",
        country: "CN",
        certNumber: "STANDBY-MOCK-1",
        status: "대기전력저감 우수제품 모의 데이터"
      }
    ];
  }

  if (sourceCode === "mfds_import_food_foreign_manufacturers") {
    return [
      {
        factoryName: "Qingdao Green Foods Co., Ltd.",
        country: "CN",
        province: "Shandong",
        city: "Qingdao",
        address: "Qingdao Economic and Technological Development Zone",
        productName: "Frozen vegetable"
      }
    ];
  }

  if (sourceCode === "mfds_import_food_suspended_manufacturers") {
    return [
      {
        factoryName: "Qingdao Bay Seafood Processing Co., Ltd.",
        country: "CN",
        city: "Qingdao",
        address: "Jiaozhou Bay Industrial Zone",
        title: "해외제조업소 수입중단 모의 데이터",
        reason: "위생점검 부적합 모의 신호",
        severity: "HIGH"
      }
    ];
  }

  if (sourceCode === "mfds_cosmetic_ingredients") {
    return [
      {
        INGR_KOR_NAME: query || "가지열매추출물",
        INGR_ENG_NAME: "Solanum Melongena (Eggplant) Fruit Extract",
        CAS_NO: "84012-19-1",
        ORIGIN_MAJOR_KOR_NAME: "이 원료는 가지의 열매에서 추출한 것이다.",
        INGR_SYNONYM: "가지추출물"
      }
    ];
  }

  if (sourceCode === "mfds_cosmetic_restricted_ingredients") {
    return [
      {
        REGULATE_TYPE: "금지",
        INGR_STD_NAME: query || "2,4,5-트라이메틸아닐린",
        INGR_ENG_NAME: "2,4,5-Trimethylaniline",
        CAS_NO: "137-17-7",
        INGR_SYNONYM: "2,4,5-TMA",
        COUNTRY_NAME: "아세안",
        NOTICE_INGR_NAME: "2,4,5-Trimethylaniline",
        LIMIT_COND: null
      }
    ];
  }

  if (sourceCode === "mfds_medical_device_items") {
    return [
      {
        certNumber: "MFDS-MD-MOCK-001",
        productName: query || "Digital thermometer",
        modelName: "DT-100",
        manufacturerName: "Suzhou MedCare Devices Co., Ltd.",
        country: "CN",
        status: "품목허가 확인 모의 데이터",
        itemClass: "2"
      }
    ];
  }

  return [
    {
      title: `${sourceCode} stub record`,
      sourceCode,
      query,
      note: "Mock mode placeholder. Replace endpoint or API key to enable live collection."
    }
  ];
}

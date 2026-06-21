/**
 * IFRS-compliant P&L Chart of Accounts seed
 * Based on: IAS 1, IAS 2, IAS 16, IAS 19, IAS 23, IAS 28, IAS 36, IAS 37,
 *           IAS 38, IFRS 9, IFRS 15, IFRS 16
 *
 * Run: npx tsx prisma/seed-ifrs.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ItemDef = {
  pnlKey: string;
  name: string;
  nameAr: string;
  type: "revenue" | "expense" | "profit";
  parentKey?: string;
  isTotal?: boolean;
  isSubtotal?: boolean;
  isCalculated?: boolean;
  sortOrder: number;
};

const ITEMS: ItemDef[] = [

  // ══════════════════════════════════════════════════════════════
  // SECTION 1 — REVENUE  (IAS 1 / IFRS 15)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "revenue", name: "Revenue", nameAr: "الإيرادات",
    type: "revenue", isTotal: true, sortOrder: 100,
  },
  {
    pnlKey: "contracts_revenue", name: "Revenue from Contracts with Customers",
    nameAr: "إيرادات عقود العملاء (IFRS 15)",
    type: "revenue", parentKey: "revenue", isSubtotal: true, sortOrder: 110,
  },
  {
    pnlKey: "sale_of_goods", name: "Revenue from Sale of Goods",
    nameAr: "إيرادات بيع البضائع والمنتجات",
    type: "revenue", parentKey: "contracts_revenue", sortOrder: 111,
  },
  {
    pnlKey: "rendering_of_services", name: "Revenue from Rendering of Services",
    nameAr: "إيرادات تقديم الخدمات",
    type: "revenue", parentKey: "contracts_revenue", sortOrder: 112,
  },
  {
    pnlKey: "construction_contracts", name: "Revenue from Construction Contracts",
    nameAr: "إيرادات عقود الإنشاء والمقاولات",
    type: "revenue", parentKey: "contracts_revenue", sortOrder: 113,
  },
  {
    pnlKey: "license_royalties", name: "License and Royalty Revenue",
    nameAr: "إيرادات التراخيص والامتيازات",
    type: "revenue", parentKey: "contracts_revenue", sortOrder: 114,
  },
  {
    pnlKey: "other_operating_income", name: "Other Operating Income",
    nameAr: "إيرادات التشغيل الأخرى",
    type: "revenue", parentKey: "revenue", isSubtotal: true, sortOrder: 120,
  },
  {
    pnlKey: "gain_on_disposal", name: "Gain on Disposal of Assets",
    nameAr: "أرباح التصرف في الأصول والاستثمارات",
    type: "revenue", parentKey: "other_operating_income", sortOrder: 121,
  },
  {
    pnlKey: "rental_income_ops", name: "Rental Income",
    nameAr: "إيرادات الإيجار التشغيلي",
    type: "revenue", parentKey: "other_operating_income", sortOrder: 122,
  },
  {
    pnlKey: "government_grants", name: "Government Grants (IAS 20)",
    nameAr: "المنح الحكومية (معيار IAS 20)",
    type: "revenue", parentKey: "other_operating_income", sortOrder: 123,
  },
  {
    pnlKey: "other_gains", name: "Other Miscellaneous Gains",
    nameAr: "أرباح ومكاسب متنوعة أخرى",
    type: "revenue", parentKey: "other_operating_income", sortOrder: 124,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 2 — COST OF SALES  (IAS 2)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "cost_of_sales", name: "Cost of Sales",
    nameAr: "تكلفة المبيعات (IAS 2)",
    type: "expense", isSubtotal: true, sortOrder: 200,
  },
  {
    pnlKey: "cost_of_goods_section", name: "Cost of Goods Sold",
    nameAr: "تكلفة البضائع المباعة",
    type: "expense", parentKey: "cost_of_sales", isSubtotal: true, sortOrder: 210,
  },
  {
    pnlKey: "raw_materials_consumed", name: "Raw Materials Consumed",
    nameAr: "المواد الخام والمستلزمات المستهلكة",
    type: "expense", parentKey: "cost_of_goods_section", sortOrder: 211,
  },
  {
    pnlKey: "direct_labor_cost", name: "Direct Labor Costs",
    nameAr: "أجور العمالة المباشرة",
    type: "expense", parentKey: "cost_of_goods_section", sortOrder: 212,
  },
  {
    pnlKey: "manufacturing_overhead", name: "Manufacturing Overhead",
    nameAr: "المصروفات الصناعية غير المباشرة",
    type: "expense", parentKey: "cost_of_goods_section", sortOrder: 213,
  },
  {
    pnlKey: "change_in_inventories", name: "Change in Inventories",
    nameAr: "التغير في أرصدة المخزون",
    type: "expense", parentKey: "cost_of_goods_section", sortOrder: 214,
  },
  {
    pnlKey: "cost_of_services_rendered", name: "Cost of Services Rendered",
    nameAr: "تكلفة الخدمات المقدمة",
    type: "expense", parentKey: "cost_of_sales", isSubtotal: true, sortOrder: 220,
  },
  {
    pnlKey: "service_staff_costs", name: "Service Staff Costs",
    nameAr: "تكاليف موظفي الخدمة المباشرين",
    type: "expense", parentKey: "cost_of_services_rendered", sortOrder: 221,
  },
  {
    pnlKey: "service_materials", name: "Service Materials and Supplies",
    nameAr: "مواد ومستلزمات تقديم الخدمات",
    type: "expense", parentKey: "cost_of_services_rendered", sortOrder: 222,
  },
  {
    pnlKey: "subcontractors", name: "Subcontractors and Third-Party Costs",
    nameAr: "مقاولون من الباطن وتكاليف الأطراف الخارجية",
    type: "expense", parentKey: "cost_of_services_rendered", sortOrder: 223,
  },

  // ══════════════════════════════════════════════════════════════
  // FORMULA ROW — GROSS PROFIT
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "gross_profit", name: "Gross Profit",
    nameAr: "إجمالي الربح",
    type: "profit", isSubtotal: true, isCalculated: true, sortOrder: 300,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 3 — SELLING & DISTRIBUTION EXPENSES
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "selling_distribution_expenses", name: "Selling and Distribution Expenses",
    nameAr: "مصروفات البيع والتوزيع",
    type: "expense", isSubtotal: true, sortOrder: 400,
  },
  {
    pnlKey: "advertising_marketing", name: "Advertising and Marketing",
    nameAr: "الإعلان والتسويق والدعاية",
    type: "expense", parentKey: "selling_distribution_expenses", sortOrder: 401,
  },
  {
    pnlKey: "sales_commissions", name: "Sales Commissions",
    nameAr: "عمولات فريق المبيعات",
    type: "expense", parentKey: "selling_distribution_expenses", sortOrder: 402,
  },
  {
    pnlKey: "delivery_shipping", name: "Delivery and Shipping Costs",
    nameAr: "مصروفات التوصيل والشحن والنقل",
    type: "expense", parentKey: "selling_distribution_expenses", sortOrder: 403,
  },
  {
    pnlKey: "customer_service_exp", name: "Customer Service Expenses",
    nameAr: "مصروفات خدمة العملاء وما بعد البيع",
    type: "expense", parentKey: "selling_distribution_expenses", sortOrder: 404,
  },
  {
    pnlKey: "exhibitions_events", name: "Trade Exhibitions and Events",
    nameAr: "المعارض والمؤتمرات والفعاليات التجارية",
    type: "expense", parentKey: "selling_distribution_expenses", sortOrder: 405,
  },
  {
    pnlKey: "sales_promotions", name: "Sales Promotions and Discounts",
    nameAr: "عروض المبيعات والخصومات التجارية",
    type: "expense", parentKey: "selling_distribution_expenses", sortOrder: 406,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 4 — GENERAL & ADMINISTRATIVE EXPENSES  (IAS 19)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "general_admin_expenses", name: "General and Administrative Expenses",
    nameAr: "المصروفات العمومية والإدارية",
    type: "expense", isSubtotal: true, sortOrder: 500,
  },

  // 4a — Employee Costs (IAS 19)
  {
    pnlKey: "employee_costs", name: "Employee Costs (IAS 19)",
    nameAr: "تكاليف الموظفين (معيار IAS 19)",
    type: "expense", parentKey: "general_admin_expenses", isSubtotal: true, sortOrder: 510,
  },
  {
    pnlKey: "salaries_wages", name: "Salaries and Wages",
    nameAr: "الرواتب والأجور الأساسية",
    type: "expense", parentKey: "employee_costs", sortOrder: 511,
  },
  {
    pnlKey: "end_of_service_benefits", name: "End of Service Benefits",
    nameAr: "مكافآت نهاية الخدمة",
    type: "expense", parentKey: "employee_costs", sortOrder: 512,
  },
  {
    pnlKey: "gosi_contributions", name: "GOSI / Social Insurance Contributions",
    nameAr: "اشتراكات التأمينات الاجتماعية (GOSI)",
    type: "expense", parentKey: "employee_costs", sortOrder: 513,
  },
  {
    pnlKey: "health_insurance", name: "Health Insurance and Medical Benefits",
    nameAr: "التأمين الصحي والمزايا الطبية",
    type: "expense", parentKey: "employee_costs", sortOrder: 514,
  },
  {
    pnlKey: "housing_transport_allowances", name: "Housing and Transportation Allowances",
    nameAr: "بدلات السكن والنقل والمواصلات",
    type: "expense", parentKey: "employee_costs", sortOrder: 515,
  },
  {
    pnlKey: "annual_leave_accrual", name: "Annual Leave Accrual",
    nameAr: "مستحقات الإجازات السنوية",
    type: "expense", parentKey: "employee_costs", sortOrder: 516,
  },
  {
    pnlKey: "other_employee_benefits", name: "Other Employee Benefits",
    nameAr: "مزايا وبدلات الموظفين الأخرى",
    type: "expense", parentKey: "employee_costs", sortOrder: 517,
  },

  // 4b — Occupancy & Facilities
  {
    pnlKey: "occupancy_facilities", name: "Occupancy and Facilities",
    nameAr: "تكاليف المقار والمرافق",
    type: "expense", parentKey: "general_admin_expenses", isSubtotal: true, sortOrder: 520,
  },
  {
    pnlKey: "rent_expense", name: "Rent Expense (IAS 17 / IFRS 16)",
    nameAr: "مصروف الإيجار (IAS 17 / IFRS 16)",
    type: "expense", parentKey: "occupancy_facilities", sortOrder: 521,
  },
  {
    pnlKey: "utilities", name: "Utilities (Electricity, Water, Gas)",
    nameAr: "المرافق (الكهرباء والماء والغاز)",
    type: "expense", parentKey: "occupancy_facilities", sortOrder: 522,
  },
  {
    pnlKey: "maintenance_repairs", name: "Maintenance and Repairs",
    nameAr: "الصيانة والإصلاحات",
    type: "expense", parentKey: "occupancy_facilities", sortOrder: 523,
  },
  {
    pnlKey: "security_cleaning", name: "Security and Cleaning Services",
    nameAr: "الحراسة والأمن وخدمات النظافة",
    type: "expense", parentKey: "occupancy_facilities", sortOrder: 524,
  },

  // 4c — Professional & Consultancy Fees
  {
    pnlKey: "professional_fees", name: "Professional and Consultancy Fees",
    nameAr: "الأتعاب المهنية والاستشارية",
    type: "expense", parentKey: "general_admin_expenses", isSubtotal: true, sortOrder: 530,
  },
  {
    pnlKey: "legal_fees", name: "Legal Fees and Litigation Costs",
    nameAr: "الأتعاب القانونية وتكاليف التقاضي",
    type: "expense", parentKey: "professional_fees", sortOrder: 531,
  },
  {
    pnlKey: "audit_fees", name: "Audit and Assurance Fees",
    nameAr: "أتعاب المراجعة والتدقيق الخارجي",
    type: "expense", parentKey: "professional_fees", sortOrder: 532,
  },
  {
    pnlKey: "financial_advisory", name: "Financial Advisory Fees",
    nameAr: "الاستشارات المالية والاستثمارية",
    type: "expense", parentKey: "professional_fees", sortOrder: 533,
  },
  {
    pnlKey: "management_consulting", name: "Management and Strategy Consulting",
    nameAr: "الاستشارات الإدارية والاستراتيجية",
    type: "expense", parentKey: "professional_fees", sortOrder: 534,
  },

  // 4d — General Administrative
  {
    pnlKey: "general_admin_other", name: "Other General Administrative Expenses",
    nameAr: "مصروفات إدارية عامة أخرى",
    type: "expense", parentKey: "general_admin_expenses", isSubtotal: true, sortOrder: 540,
  },
  {
    pnlKey: "communications", name: "Communications and Internet",
    nameAr: "الاتصالات والإنترنت والبريد",
    type: "expense", parentKey: "general_admin_other", sortOrder: 541,
  },
  {
    pnlKey: "it_software", name: "IT Systems and Software Subscriptions",
    nameAr: "أنظمة تقنية المعلومات والاشتراكات البرمجية",
    type: "expense", parentKey: "general_admin_other", sortOrder: 542,
  },
  {
    pnlKey: "insurance_general", name: "Insurance — General and Property",
    nameAr: "التأمين العام وتأمين الممتلكات",
    type: "expense", parentKey: "general_admin_other", sortOrder: 543,
  },
  {
    pnlKey: "travel_entertainment", name: "Travel and Business Entertainment",
    nameAr: "السفر والإقامة والضيافة التجارية",
    type: "expense", parentKey: "general_admin_other", sortOrder: 544,
  },
  {
    pnlKey: "stationery_office", name: "Stationery and Office Supplies",
    nameAr: "القرطاسية ومستلزمات المكتب",
    type: "expense", parentKey: "general_admin_other", sortOrder: 545,
  },
  {
    pnlKey: "licenses_govt_fees", name: "Licenses, Permits and Government Fees",
    nameAr: "التراخيص والتصاريح والرسوم الحكومية",
    type: "expense", parentKey: "general_admin_other", sortOrder: 546,
  },
  {
    pnlKey: "donations_subscriptions", name: "Donations and Memberships",
    nameAr: "التبرعات والاشتراكات في المنظمات",
    type: "expense", parentKey: "general_admin_other", sortOrder: 547,
  },

  // 4e — Credit Losses & Provisions (IFRS 9 / IAS 37)
  {
    pnlKey: "credit_losses_provisions", name: "Credit Losses and Provisions (IFRS 9 / IAS 37)",
    nameAr: "خسائر ائتمانية ومخصصات (IFRS 9 / IAS 37)",
    type: "expense", parentKey: "general_admin_expenses", isSubtotal: true, sortOrder: 550,
  },
  {
    pnlKey: "ecl_provision", name: "Expected Credit Loss Provision (IFRS 9)",
    nameAr: "مخصص الخسائر الائتمانية المتوقعة (IFRS 9)",
    type: "expense", parentKey: "credit_losses_provisions", sortOrder: 551,
  },
  {
    pnlKey: "receivables_writeoff", name: "Write-off of Uncollectible Receivables",
    nameAr: "إعدام الذمم المدينة غير القابلة للتحصيل",
    type: "expense", parentKey: "credit_losses_provisions", sortOrder: 552,
  },
  {
    pnlKey: "other_provisions", name: "Other Provisions and Contingencies (IAS 37)",
    nameAr: "مخصصات وارتباطات طارئة أخرى (IAS 37)",
    type: "expense", parentKey: "credit_losses_provisions", sortOrder: 553,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 5 — RESEARCH & DEVELOPMENT  (IAS 38)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "research_development", name: "Research and Development Expenses (IAS 38)",
    nameAr: "مصروفات البحث والتطوير (IAS 38)",
    type: "expense", isSubtotal: true, sortOrder: 600,
  },
  {
    pnlKey: "rd_personnel", name: "R&D Personnel Costs",
    nameAr: "تكاليف موظفي البحث والتطوير",
    type: "expense", parentKey: "research_development", sortOrder: 601,
  },
  {
    pnlKey: "rd_materials", name: "R&D Materials and Supplies",
    nameAr: "مواد ومستلزمات البحث والتطوير",
    type: "expense", parentKey: "research_development", sortOrder: 602,
  },
  {
    pnlKey: "contracted_research", name: "Contracted / Outsourced Research",
    nameAr: "أبحاث مستعان بها من خارج المنشأة",
    type: "expense", parentKey: "research_development", sortOrder: 603,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 6 — DEPRECIATION & AMORTIZATION  (IAS 16 / IAS 38 / IFRS 16)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "depreciation_amortization", name: "Depreciation and Amortization",
    nameAr: "الاستهلاك والإطفاء",
    type: "expense", isSubtotal: true, sortOrder: 700,
  },
  {
    pnlKey: "ppe_depreciation", name: "Depreciation of Property, Plant and Equipment (IAS 16)",
    nameAr: "استهلاك الممتلكات والمصانع والمعدات (IAS 16)",
    type: "expense", parentKey: "depreciation_amortization", isSubtotal: true, sortOrder: 710,
  },
  {
    pnlKey: "building_depreciation", name: "Building and Structures Depreciation",
    nameAr: "استهلاك المباني والإنشاءات",
    type: "expense", parentKey: "ppe_depreciation", sortOrder: 711,
  },
  {
    pnlKey: "plant_machinery_depreciation", name: "Plant and Machinery Depreciation",
    nameAr: "استهلاك المنشآت والآلات والمعدات",
    type: "expense", parentKey: "ppe_depreciation", sortOrder: 712,
  },
  {
    pnlKey: "vehicles_depreciation", name: "Vehicles and Fleet Depreciation",
    nameAr: "استهلاك السيارات والمركبات والأسطول",
    type: "expense", parentKey: "ppe_depreciation", sortOrder: 713,
  },
  {
    pnlKey: "furniture_fixtures_depreciation", name: "Furniture, Fixtures and Equipment Depreciation",
    nameAr: "استهلاك الأثاث والتجهيزات والأدوات",
    type: "expense", parentKey: "ppe_depreciation", sortOrder: 714,
  },
  {
    pnlKey: "rou_asset_depreciation", name: "Right-of-Use Asset Depreciation (IFRS 16)",
    nameAr: "استهلاك أصول حق الاستخدام (IFRS 16)",
    type: "expense", parentKey: "depreciation_amortization", sortOrder: 720,
  },
  {
    pnlKey: "intangible_amortization", name: "Amortization of Intangible Assets (IAS 38)",
    nameAr: "إطفاء الأصول غير الملموسة (IAS 38)",
    type: "expense", parentKey: "depreciation_amortization", isSubtotal: true, sortOrder: 730,
  },
  {
    pnlKey: "software_amortization", name: "Software and Systems Amortization",
    nameAr: "إطفاء البرامج والأنظمة والتطبيقات",
    type: "expense", parentKey: "intangible_amortization", sortOrder: 731,
  },
  {
    pnlKey: "patents_trademarks_amortization", name: "Patents and Trademarks Amortization",
    nameAr: "إطفاء براءات الاختراع والعلامات التجارية",
    type: "expense", parentKey: "intangible_amortization", sortOrder: 732,
  },
  {
    pnlKey: "customer_lists_amortization", name: "Customer Lists and Contracts Amortization",
    nameAr: "إطفاء قوائم العملاء والعقود المكتسبة",
    type: "expense", parentKey: "intangible_amortization", sortOrder: 733,
  },
  {
    pnlKey: "impairment_losses", name: "Impairment Losses (IAS 36)",
    nameAr: "خسائر الاضمحلال (IAS 36)",
    type: "expense", parentKey: "depreciation_amortization", isSubtotal: true, sortOrder: 740,
  },
  {
    pnlKey: "goodwill_impairment", name: "Goodwill Impairment (IFRS 3 / IAS 36)",
    nameAr: "اضمحلال الشهرة (IFRS 3 / IAS 36)",
    type: "expense", parentKey: "impairment_losses", sortOrder: 741,
  },
  {
    pnlKey: "other_asset_impairment", name: "Other Asset Impairment",
    nameAr: "اضمحلال أصول أخرى",
    type: "expense", parentKey: "impairment_losses", sortOrder: 742,
  },

  // ══════════════════════════════════════════════════════════════
  // FORMULA ROW — OPERATING INCOME (EBIT)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "operating_income", name: "Operating Income (EBIT)",
    nameAr: "الدخل التشغيلي (EBIT)",
    type: "profit", isSubtotal: true, isCalculated: true, sortOrder: 800,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 7 — FINANCE INCOME  (IFRS 9 / IAS 39)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "finance_income", name: "Finance and Investment Income",
    nameAr: "إيرادات التمويل والاستثمار",
    type: "revenue", isSubtotal: true, sortOrder: 850,
  },
  {
    pnlKey: "murabaha_investment_returns", name: "Murabaha and Islamic Investment Returns",
    nameAr: "عوائد المرابحة والاستثمار الإسلامي",
    type: "revenue", parentKey: "finance_income", sortOrder: 851,
  },
  {
    pnlKey: "dividend_income", name: "Dividend Income from Investments",
    nameAr: "إيرادات توزيعات أرباح الاستثمارات",
    type: "revenue", parentKey: "finance_income", sortOrder: 852,
  },
  {
    pnlKey: "capital_gains_investments", name: "Capital Gains on Investments",
    nameAr: "أرباح رأس المال من بيع الاستثمارات",
    type: "revenue", parentKey: "finance_income", sortOrder: 853,
  },
  {
    pnlKey: "fx_gains", name: "Foreign Exchange Gains",
    nameAr: "مكاسب فروق العملة الأجنبية",
    type: "revenue", parentKey: "finance_income", sortOrder: 854,
  },
  {
    pnlKey: "fair_value_gains", name: "Fair Value Gains on Financial Instruments (IFRS 9)",
    nameAr: "مكاسب القيمة العادلة للأدوات المالية (IFRS 9)",
    type: "revenue", parentKey: "finance_income", sortOrder: 855,
  },
  {
    pnlKey: "other_finance_income", name: "Other Finance Income",
    nameAr: "إيرادات تمويلية أخرى",
    type: "revenue", parentKey: "finance_income", sortOrder: 856,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 8 — FINANCE COSTS  (IAS 23 / IFRS 16)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "finance_costs", name: "Finance Costs",
    nameAr: "تكاليف التمويل",
    type: "expense", isSubtotal: true, sortOrder: 900,
  },
  {
    pnlKey: "islamic_finance_costs", name: "Islamic Finance Costs",
    nameAr: "تكاليف التمويل الإسلامي",
    type: "expense", parentKey: "finance_costs", isSubtotal: true, sortOrder: 910,
  },
  {
    pnlKey: "murabaha_cost", name: "Murabaha Finance Cost",
    nameAr: "تكلفة تمويل المرابحة",
    type: "expense", parentKey: "islamic_finance_costs", sortOrder: 911,
  },
  {
    pnlKey: "ijara_cost", name: "Ijara Finance Cost",
    nameAr: "تكلفة تمويل الإجارة والتأجير التمويلي",
    type: "expense", parentKey: "islamic_finance_costs", sortOrder: 912,
  },
  {
    pnlKey: "sukuk_costs", name: "Sukuk Issuance Costs",
    nameAr: "تكاليف إصدار وخدمة الصكوك",
    type: "expense", parentKey: "finance_costs", sortOrder: 920,
  },
  {
    pnlKey: "lease_liability_interest", name: "Lease Liability Interest (IFRS 16)",
    nameAr: "فوائد التزامات الإجارة (IFRS 16)",
    type: "expense", parentKey: "finance_costs", sortOrder: 930,
  },
  {
    pnlKey: "fx_losses", name: "Foreign Exchange Losses",
    nameAr: "خسائر فروق العملة الأجنبية",
    type: "expense", parentKey: "finance_costs", sortOrder: 940,
  },
  {
    pnlKey: "fair_value_losses", name: "Fair Value Losses on Financial Instruments",
    nameAr: "خسائر القيمة العادلة للأدوات المالية",
    type: "expense", parentKey: "finance_costs", sortOrder: 941,
  },
  {
    pnlKey: "bank_charges", name: "Bank Charges and Fees",
    nameAr: "الرسوم والمصاريف البنكية",
    type: "expense", parentKey: "finance_costs", sortOrder: 942,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 9 — SHARE OF PROFIT OF ASSOCIATES  (IAS 28)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "share_of_associates", name: "Share of Profit of Associates (IAS 28)",
    nameAr: "حصة في أرباح الشركات الزميلة (IAS 28)",
    type: "revenue", sortOrder: 950,
  },

  // ══════════════════════════════════════════════════════════════
  // FORMULA ROW — INCOME BEFORE ZAKAT
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "income_before_zakat", name: "Income Before Zakat",
    nameAr: "الدخل قبل الزكاة",
    type: "profit", isSubtotal: true, isCalculated: true, sortOrder: 960,
  },

  // ══════════════════════════════════════════════════════════════
  // ZAKAT EXPENSE
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "zakat_expense", name: "Zakat Expense (2.5% of Zakat Base)",
    nameAr: "مصروف الزكاة (2.5% من وعاء الزكاة)",
    type: "expense", sortOrder: 970,
  },

  // ══════════════════════════════════════════════════════════════
  // FORMULA ROW — NET INCOME / NET PROFIT
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "net_income", name: "Net Income for the Period",
    nameAr: "صافي الدخل للفترة",
    type: "profit", isTotal: true, isCalculated: true, sortOrder: 980,
  },

  // ══════════════════════════════════════════════════════════════
  // SECTION 10 — OTHER COMPREHENSIVE INCOME  (IAS 1)
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "other_comprehensive_income", name: "Other Comprehensive Income (IAS 1)",
    nameAr: "الدخل الشامل الآخر (IAS 1)",
    type: "profit", isSubtotal: true, sortOrder: 990,
  },
  {
    pnlKey: "oci_not_reclassified", name: "Items Not Reclassified to Profit or Loss",
    nameAr: "بنود لن تُعاد تصنيفها إلى قائمة الأرباح والخسائر",
    type: "profit", parentKey: "other_comprehensive_income", isSubtotal: true, sortOrder: 991,
  },
  {
    pnlKey: "revaluation_surplus", name: "Property Revaluation Surplus (IAS 16)",
    nameAr: "فائض إعادة تقييم الممتلكات (IAS 16)",
    type: "profit", parentKey: "oci_not_reclassified", sortOrder: 992,
  },
  {
    pnlKey: "remeasurement_defined_benefit", name: "Remeasurement of Defined Benefit Obligations (IAS 19)",
    nameAr: "إعادة قياس التزامات المزايا المحددة (IAS 19)",
    type: "profit", parentKey: "oci_not_reclassified", sortOrder: 993,
  },
  {
    pnlKey: "equity_fvoci", name: "Fair Value Changes — Equity Instruments at FVOCI (IFRS 9)",
    nameAr: "تغيرات القيمة العادلة لأدوات حقوق الملكية بالقيمة العادلة (IFRS 9)",
    type: "profit", parentKey: "oci_not_reclassified", sortOrder: 994,
  },
  {
    pnlKey: "oci_may_reclassify", name: "Items That May Be Reclassified to Profit or Loss",
    nameAr: "بنود قد تُعاد تصنيفها لاحقاً إلى قائمة الأرباح والخسائر",
    type: "profit", parentKey: "other_comprehensive_income", isSubtotal: true, sortOrder: 995,
  },
  {
    pnlKey: "fx_translation_differences", name: "Foreign Currency Translation Differences",
    nameAr: "فروق ترجمة العمليات الأجنبية",
    type: "profit", parentKey: "oci_may_reclassify", sortOrder: 996,
  },
  {
    pnlKey: "cash_flow_hedge", name: "Effective Portion of Cash Flow Hedges (IFRS 9)",
    nameAr: "الجزء الفعال من عمليات التحوط بالتدفق النقدي (IFRS 9)",
    type: "profit", parentKey: "oci_may_reclassify", sortOrder: 997,
  },
  {
    pnlKey: "oci_share_associates", name: "Share of OCI of Associates (IAS 28)",
    nameAr: "حصة في الدخل الشامل الآخر للشركات الزميلة (IAS 28)",
    type: "profit", parentKey: "oci_may_reclassify", sortOrder: 998,
  },

  // ══════════════════════════════════════════════════════════════
  // FORMULA ROW — TOTAL COMPREHENSIVE INCOME
  // ══════════════════════════════════════════════════════════════
  {
    pnlKey: "total_comprehensive_income", name: "Total Comprehensive Income for the Period",
    nameAr: "إجمالي الدخل الشامل للفترة",
    type: "profit", isTotal: true, isCalculated: true, sortOrder: 1000,
  },
];

// ─── Seed runner ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding IFRS P&L categories...");

  // Remove existing system-wide categories (companyId = null)
  const deleted = await prisma.category.deleteMany({ where: { companyId: null } });
  console.log(`   Removed ${deleted.count} existing system categories.`);

  const keyToId = new Map<string, string>();

  // Insert in two passes so parent IDs are always available
  const roots = ITEMS.filter((i) => !i.parentKey);
  const children = ITEMS.filter((i) => !!i.parentKey);

  for (const item of roots) {
    const created = await prisma.category.create({
      data: {
        name: item.name,
        nameAr: item.nameAr,
        type: item.type,
        pnlKey: item.pnlKey,
        sortOrder: item.sortOrder,
        isCalculated: item.isCalculated ?? false,
        isTotal: item.isTotal ?? false,
        isSubtotal: item.isSubtotal ?? false,
      },
    });
    keyToId.set(item.pnlKey, created.id);
  }

  // Multiple passes for deep nesting (up to 4 levels)
  let remaining = [...children];
  let maxPasses = 5;
  while (remaining.length > 0 && maxPasses-- > 0) {
    const nextRound: typeof remaining = [];
    for (const item of remaining) {
      const parentId = keyToId.get(item.parentKey!);
      if (!parentId) { nextRound.push(item); continue; }
      const created = await prisma.category.create({
        data: {
          name: item.name,
          nameAr: item.nameAr,
          type: item.type,
          parentId,
          pnlKey: item.pnlKey,
          sortOrder: item.sortOrder,
          isCalculated: item.isCalculated ?? false,
          isTotal: item.isTotal ?? false,
          isSubtotal: item.isSubtotal ?? false,
        },
      });
      keyToId.set(item.pnlKey, created.id);
    }
    remaining = nextRound;
  }

  if (remaining.length > 0) {
    console.warn(`⚠️  Could not insert ${remaining.length} items (parent not found):`,
      remaining.map((i) => i.pnlKey).join(", "));
  }

  const total = ITEMS.length - remaining.length;
  console.log(`✅  Seeded ${total} IFRS P&L categories across ${countLevels()} levels.`);

  function countLevels() {
    const maxDepth = Math.max(...ITEMS.map((i) => {
      let depth = 0; let key: string | undefined = i.parentKey;
      while (key) { depth++; key = ITEMS.find((x) => x.pnlKey === key)?.parentKey; }
      return depth;
    }));
    return maxDepth + 1;
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

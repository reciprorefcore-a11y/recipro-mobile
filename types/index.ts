import type { Timestamp } from "firebase/firestore";

export type CostSource = "estimated" | "recipro" | "user_confirmed";

export type PriceMode = "taxIncluded" | "taxExcluded";

export type GeneralSettings = {
  priceMode?: PriceMode;
  priceModeSetAt?: Timestamp;
};

export type OnboardingSettings = {
  onboardingStartedAt: Timestamp;
  onboardingCompletedAt?: Timestamp;
  onboardingSkippedAt?: Timestamp;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  completedSteps: {
    ingredientMaster: boolean;
    menuImport: boolean;
    confirmation: boolean;
    costEstimation?: boolean;
  };
};

export type QuantityValue = string | number;

export type Product = {
  id: string;
  companyId: string;
  name: string;
  nameKana: string;
  baseCost: number;
  currentCost: number;
  changedCost?: number;
  price: number;
  monthlySalesCount?: number;
  monthlySales?: number;
  salesCount?: number;
  soldCount?: number;
  monthlyQuantity?: number;
  monthlyOrderCount?: number;
  monthlyRevenue?: number;
  category?: string;
  ingredients?: string[];
  ingredientUsages?: ProductIngredientUsage[];
  posSourceId?: string; // 将来用: スマレジ等のPOS商品ID
  costSource?: CostSource;
  isEstimated?: boolean;
  source?: "ai" | "user_confirmed" | "manual";
  updatedAt: Timestamp;
  createdAt: Timestamp;
};

export type ProductIngredientUsage = {
  ingredientId: string;
  uniqueId?: string;
  ingredientName: string;
  quantity?: number;
  unit?: string;
  currentPrice?: number;
  changedPrice?: number;
};

export type UserProfile = {
  uid: string;
  email: string;
  companyName: string;
  storeName: string;
  role: "owner";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Ingredient = {
  id: string;
  uniqueId: string;
  companyId: string;
  ingredientName: string;
  ingredientNameKana?: string;
  myCatalogId?: string;
  smaregiCode?: string;
  smaregiDept?: string;
  supplier?: string;
  supplierKana?: string;
  spec?: string;
  unit: string;
  quantity?: QuantityValue;
  packQuantity?: QuantityValue;
  lotQuantity?: QuantityValue;
  inputQuantity?: QuantityValue;
  inputQuantityUnit?: string;
  caseQuantity?: QuantityValue;
  irisu?: QuantityValue;
  countPerUnit?: QuantityValue;
  outputQuantity?: QuantityValue;
  currentPrice: number;
  oldPrice?: number;
  globalCategory?: string;
  globalCategoryId?: string;
  category?: string;
  updatedAt?: string;
  isActive: boolean;
  reciproStoreID?: string;
};

export type IngredientWrite = Omit<
  Ingredient,
  "id" | "companyId" | "updatedAt" | "isActive"
> & {
  companyId?: string;
  updatedAt?: string;
  isActive?: boolean;
  nameNormalized?: string;
};

export type PriceHistory = {
  id?: string;
  ingredientId: string;
  ingredientName: string;
  price: number;
  quantity?: number | null; // 将来の数量分析用
  source?: "manual" | "receipt_ai" | "receipt_ai_new";
  recordedAt: Timestamp;
};

export type DetectedItem = {
  name: string;
  ingredientNameKana?: string; // AIが返却、なければ食材名をそのまま使用
  myCatalogId?: string;
  price: number;
  unit: string;
  quantity?: number; // 購入数量
  confidence: number;
  supplier?: string; // 仕入先
};

export type ReceiptAnalysisResult = {
  items: DetectedItem[];
  notes?: string;
};

export type AiMenuCandidate = {
  name: string;
  confidence: number;
  estimatedMonthlySales?: number;
  ingredients: string[];
  estimatedCost?: number;
  estimatedPrice?: number;
  costRate?: number;
};

export type AiImprovementCandidate = {
  title: string;
  description: string;
  impact?: number;
};

export type AiWorkflowResult = ReceiptAnalysisResult & {
  menuCandidates: AiMenuCandidate[];
  usageSummary: string;
  estimatedMonthlyLoss?: number;
  lossCauses: string[];
  highCostMenus: string[];
  priceChangeCandidates: AiImprovementCandidate[];
  ingredientChangeCandidates: AiImprovementCandidate[];
};

export type MatchedItem = DetectedItem & {
  matchedIngredient?: Ingredient;
  matchType: "exact" | "normalized" | "partial" | "new";
  oldPrice?: number;
  selected: boolean;
  isEditing: boolean; // 編集モード状態
};

export type CompanySettings = {
  general?: GeneralSettings;
  onboarding?: OnboardingSettings;
  reciproStoreID?: string;
  reciproApiKey?: string;
  reciproUploadEndpoint?: string;
  reciproEnvironment?: "production" | "staging" | "test";
};

export type Company = {
  id: string;
  name: string;
  settings?: CompanySettings;
  reciproStoreID?: string;
  reciproApiKey?: string;
  reciproUploadEndpoint?: string;
  reciproEnvironment?: "production" | "staging" | "test";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type RecipeItem = {
  name: string;
  myCatalogId?: number;
  amount: number | null;
  price: number;
  unit: string;
  cost: number;
  subRecipe: boolean | string;
};

export type Recipe = {
  id: string;
  recipeID?: string;
  reciproStoreID?: string;
  regiID?: number | string;
  name: string;
  kana: string;
  category: [string, string, string];
  cost: number;
  costRate: number;
  targetRate: number;
  price: number;
  serv: number;
  allergySeven: string[];
  allergyTwenty: string[];
  items: RecipeItem[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

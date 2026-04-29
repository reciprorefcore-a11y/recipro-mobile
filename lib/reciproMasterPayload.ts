import type { Ingredient } from "@/types";

export type ReciproMasterPayload = ReturnType<typeof buildReciproMasterPayload>;

export function buildReciproMasterPayload(params: {
  customerID: string;
  storeID: string;
  ingredients: Ingredient[];
}) {
  const activeIngredients = params.ingredients.filter((item) => item.isActive);

  const setData = activeIngredients.map((item) => ({
    "［マイカタログID］": item.myCatalogId ?? "",
    "［食品小分類コード］": "",
    "［食品大分類名］": "",
    "［食品中分類名］": "",
    "［食品小分類名］": "",
    "［商品システムコード］": item.smaregiCode ?? "",
    "［商品名］": item.ingredientName ?? "",
    "［規格］": item.spec ?? "",
    "［入数単位］": item.unit ?? "",
    "［単価］": String(item.currentPrice ?? ""),
    "［旧単価］": String(item.oldPrice ?? ""),
    "［取引先名］": item.supplier ?? "",
    "［単価変更日］": "",
    "［自社管理入数］": "",
    "［自社管理入数単位］": "",
    "［発注単価］": "",
    "［発注単位］": "",
    "［マイカタログ単価］": "",
    "［マイカタログ旧単価］": "",
    "［マイカタログ単位］": "",
    "［マイカタログ変更日］": "",
    "［食品大分類コード］": "",
    "［食品中分類コード］": "",
    "［取引先名カナ］": item.supplierKana ?? "",
    "［商品名カナ］": item.ingredientNameKana ?? "",
    "［入数］": "\r",
  }));

  return {
    data: {
      customerID: params.customerID,
      storeID: params.storeID,
      setData,
    },
  };
}

export async function sendReciproMasterPayload(
  payload: ReciproMasterPayload,
  token: string
) {
  return fetch(
    "https://asia-northeast1-recipro-project-fafd0.cloudfunctions.net/setAdminMaster",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
}

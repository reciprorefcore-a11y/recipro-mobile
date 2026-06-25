export function assertCustomerAllowed(customerID: string): void {
  const raw = process.env.NEXT_PUBLIC_ALLOWED_CUSTOMER_IDS ?? "";
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (allowed.length === 0) {
    throw new Error(
      "NEXT_PUBLIC_ALLOWED_CUSTOMER_IDS が未設定です。" +
        ".env.local に反映を許可する customerID を設定してください。"
    );
  }
  if (!allowed.includes(customerID)) {
    throw new Error(
      `customerID "${customerID}" への反映は許可されていません。` +
        `現在許可されているのは: ${allowed.join(", ")}`
    );
  }
}

export function getAllowedCustomerIds(): string[] {
  const raw = process.env.NEXT_PUBLIC_ALLOWED_CUSTOMER_IDS ?? "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// utils/formatNumbers.js

// List of fields that should be formatted as currency
const moneyFields = [
  "total_amount",
  "amount",
  "exam_amount",
  "examination_breakdown_amount_naira"
];

// Format numbers with commas + ₦ sign
const formatCurrency = (value) => {
  if (value === null || value === undefined) return value;
  if (isNaN(value)) return value; // skip non-numbers
  return "₦" + Number(value).toLocaleString("en-NG", { minimumFractionDigits: 2 });
};

// Recursively walk through object/array and format only money fields
export const formatNumbersInResponse = (data) => {
  if (Array.isArray(data)) {
    return data.map(formatNumbersInResponse);
  } else if (typeof data === "object" && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([key, val]) => {
        if (moneyFields.includes(key) && (typeof val === "number" || !isNaN(val))) {
          return [key, formatCurrency(val)];
        }
        return [key, formatNumbersInResponse(val)];
      })
    );
  }
  return data;
};

export const validateFields = (fields) => {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") {
      return `${key} is required.`;
    }
  }
  return null;
};

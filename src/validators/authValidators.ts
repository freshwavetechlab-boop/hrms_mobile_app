export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidEmployeeIdentifier = isValidEmail;

export const isValidPassword = (value: string) => value.length >= 6;

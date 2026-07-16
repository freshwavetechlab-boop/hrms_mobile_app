export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidEmployeeIdentifier = (value: string) => {
  const normalized = value.trim();
  const hasControlCharacter = Array.from(normalized).some(character => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  return normalized.length > 0 && normalized.length <= 190 && !hasControlCharacter;
};

export const isValidPassword = (value: string) => value.length >= 6;

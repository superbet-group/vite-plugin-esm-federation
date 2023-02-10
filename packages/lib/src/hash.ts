// returns string representation of a hash
export const hash = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }

  return hash.toString(32);
};

/** Preserve JSON values while escaping characters that can control a terminal. */
export function serializeCliJson(value: object): string {
  return JSON.stringify(value, null, 2).replace(
    /[\u007f-\u009f\p{Cf}\p{Zl}\p{Zp}]/gu,
    (character) => {
      let escaped = "";
      for (let index = 0; index < character.length; index++) {
        escaped += `\\u${character.charCodeAt(index).toString(16).padStart(4, "0")}`;
      }
      return escaped;
    },
  );
}
